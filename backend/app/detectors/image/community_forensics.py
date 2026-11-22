"""Community Forensics image detection adapter.

Modified to fix probability calibration issue that was causing false positives/negatives.
"""

import time
import base64
import torch
import torch.nn as nn
import torchvision
import torchvision.transforms as transforms
import numpy as np
from PIL import Image
from pathlib import Path
from typing import Literal, Dict, Any, Optional
from io import BytesIO
from app.core.config import settings
from app.core.exceptions import ModelNotAvailableError
from app.detectors.image.base import ImageDetectionResult, ImageDetector
from app.detectors.image import preprocessing as preprocessor
from app.detectors.image.registry import get_model_entry

# ---------------------------------------------------------------------------
# Grad-CAM helpers
# ---------------------------------------------------------------------------

class GradCAM:
    """Gradient-weighted Class Activation Mapping for a target model layer.
  
    Produces a heatmap highlighting the regions of the input image that
    most influence the predicted class score.
    """

    def __init__(self, model: nn.Module, target_layer: nn.Module) -> None:
        self.model = model
        self.target_layer = target_layer
        # Buffers to capture activation and gradient during forward/backward
        self.activation: Optional[torch.Tensor] = None
        self.gradient: Optional[torch.Tensor] = None

        # Register forward pass hook to capture activations
        self._forward_handle = target_layer.register_forward_hook(
            self._get_activation(register_forward=True)
        )
        # Register backward pass hook to capture gradients
        self._backward_handle = target_layer.register_full_backward_hook(
            self._get_activation(register_forward=False)
        )

    def _get_activation(self, register_forward: bool = True):
        """Return a hook function that captures activations or gradients."""

        def hook(module: nn.Module, input: tuple, output: torch.Tensor, *, forward: bool = True) -> None:
            if forward:
                self.activation = output.detach()
            else:
                self.gradient = input[0].detach() if input[0] is not None else None

        return hook

    def remove_hooks(self) -> None:
        """Remove the registered hooks."""
        if self._forward_handle is not None:
            self._forward_handle.remove()
        if self._backward_handle is not None:
            self._backward_handle.remove()
        self._forward_handle = None
        self._backward_handle = None

    def __del__(self) -> None:
        self.remove_hooks()

    def compute_heatmap(self, input_tensor: torch.Tensor, target_index: int) -> np.ndarray:
        """Compute the Grad-CAM heatmap for the given input and target class index.

        Returns a numpy array of shape (H, W) with values in [0, 1].
        """

        # Zero out any existing activations/gradients
        self.activation = None
        self.gradient = None

        # Forward pass
        with torch.set_grad_enabled(True):
            _ = self.model(input_tensor)

        # Backward pass — pull the gradient for the target class
        if self.gradient is None or self.activation is None:
            return np.zeros((1, 1), dtype=np.float32)

        self.model.zero_grad()
        # Select the output neuron for the target class
        output = self.model(input_tensor)
        if target_index >= output.shape[1]:
            target_index = output.shape[1] - 1
        if target_index < 0:
            target_index = 0
        target_score = output[0, target_index]
        target_score.backward()

        # Retrieve gradient and activation
        grad = self.gradient  # shape: (1, C, H, W) or (C, H, W)
        act = self.activation  # shape: (1, C, H, W) or (C, H, W)

        # Global average pool of gradients → weights (one per channel)
        grad = grad.mean(dim=[2, 3], keepdim=False)  # shape: (1, C) or (C,)

        # Weighted combination of feature maps
        # act shape: (1, C, H, W) → squeeze channel dim for broadcasting
        weighted = (grad[:, :, None, None] * act).sum(dim=1, keepdim=False)  # shape: (1, H, W)

        # ReLU — only positive contributions matter
        heatmap = torch.clamp(weighted, min=0)

        # Upsample to input image size
        # input_tensor typically (1, 3, 224, 224); heatmap should match (1, H, W)
        input_size = input_tensor.shape[2:]  # (H, W)
        heatmap = torch.nn.functional.interpolate(
            heatmap.unsqueeze(0).unsqueeze(0),  # (1, 1, H, W)
            size=input_size,
            mode="bilinear",
            align_corners=False,
        ).squeeze()  # (H, W)

        # Normalize to [0, 1]
        if heatmap.max() - heatmap.min() > 0:
            heatmap = (heatmap - heatmap.min()) / (heatmap.max() - heatmap.min())
        else:
            heatmap = torch.zeros_like(heatmap)

        return heatmap.cpu().numpy()  # shape: (H, W), values in [0, 1]  # shape: (H, W), values in [0, 1]


def overlay_heatmap_on_image(
    pil_image: Image.Image,
    heatmap: np.ndarray,
    alpha: float = 0.4,
) -> Image.Image:
    """Overlay a Grad-CAM heatmap on the original PIL image.

    Returns a new PIL Image with the heatmap overlaid.
    Uses a simple jet-like colormap applied manually so matplotlib is not
    required as a hard runtime dependency.
    """

    if heatmap is None or heatmap.size == 0:
        return pil_image

    # Convert heatmap to 0-255 RGB using a simple jet-like coloring
    heatmap = heatmap - heatmap.min()
    if heatmap.max() > 0:
        heatmap = heatmap / heatmap.max()
    heatmap = heatmap * 255.0
    heatmap = heatmap.astype(np.uint8)

    # Jet-like colormap approximation:
    # R = heat (yellow→red), G = green, B = blue (inverted)
    r = heatmap
    g = np.where(heatmap > 128, 255, np.interp(heatmap, [0, 128], [0, 255]))
    b = np.where(heatmap > 0, 255 - heatmap, 255)

    # Convert to 3-channel image
    heatmap_rgb = np.stack([r, g, b], axis=2)  # (H, W, 3)

    # Resize heatmap to match image size if needed
    if heatmap_rgb.shape[:2] != list(pil_image.size)[::-1]:
        from PIL import Image as PILImage
        heatmap_img = PILImage.fromarray(heatmap_rgb).resize(pil_image.size)
    else:
        heatmap_img = Image.fromarray(heatmap_rgb.astype(np.uint8), "RGB")

    # Blend with original image
    orig = pil_image.convert("RGB")
    blended = Image.blend(orig, heatmap_img, alpha=alpha)

    return blended


# ---------------------------------------------------------------------------
# CommunityForensicsAdapter
# ---------------------------------------------------------------------------

class CommunityForensicsAdapter(ImageDetector):
    """Adapter for the Xicor9/efficientnet-b0-ffpp-c23 model.

    Reads model metadata from the registry so all model-specific constants
    (fake_label, preprocessing params, targets) live in one place.

    Requires a local checkpoint at backend/models/community_forensics.pth.
    If the checkpoint is missing the detector marks itself unavailable and
    the service falls back to FallbackImageDetector — no crash.
    """

    # Registry entry for this model
    _REGISTRY_NAME = "Xicor9/efficientnet-b0-ffpp-c23"

    def __init__(self, checkpoint_path: Optional[Path] = None):
        self._checkpoint_path = checkpoint_path
        self._model = None
        self._device: Literal["cpu", "cuda"] = settings.MODEL_DEVICE  # type: ignore[assignment]
        self._transform = None
        self._load_error: Optional[str] = None
        self._load_attempted = False
        self._model_name = "Xicor9/efficientnet-b0-ffpp-c23"
        self._model_version = "1.0.0"
        # Which output index counts as "fake" (from registry)
        self._fake_label: int = (get_model_entry(self._REGISTRY_NAME) or {}).get("fake_label", 1)

    def load(self) -> None:
        """Load the Community Forensics model checkpoint."""
        if self._load_attempted:
            return

        try:
            if self._checkpoint_path is None:
                # Try to find checkpoint in standard location
                standard_path = Path(settings.UPLOAD_DIR).parent / "models" / "efficientnet_b0_ffpp_c23.pth"
                if not standard_path.exists():
                    raise FileNotFoundError(f"Checkpoint not found at {standard_path}")
                
                self._checkpoint_path = standard_path

            # Verify checkpoint exists
            if not self._checkpoint_path.exists():
                raise FileNotFoundError(f"Checkpoint file not found: {self._checkpoint_path}")

            # Load model architecture — EfficientNet-B0 without pretrained weights
            self._model = torchvision.models.efficientnet_b0(weights=None)
            self._model.classifier[1] = nn.Linear(
                self._model.classifier[1].in_features, 2
            )

            # Load weights
            state_dict = torch.load(self._checkpoint_path, map_location=self._device)
            self._model.load_state_dict(state_dict)
            self._model.to(self._device)
            self._model.eval()

            # Set up transform from preprocessor
            self._transform = preprocessor.ImagePreprocessor.to_tensor

            self._load_attempted = True

        except Exception as exc:
            self._load_error = f"Model load failed: {exc}"
            self._model = None
            self._load_attempted = True

    def is_available(self) -> bool:
        """Check if the detector is available and loaded."""
        if self._model is not None:
            return True
        if not self._load_attempted:
            self.load()
        return self._model is not None

    def run_detection(self, image: Image.Image) -> ImageDetectionResult:
        """Run detection on a PIL Image and return results with optional Grad-CAM heatmap."""
        result: ImageDetectionResult = {
            "prediction": "unknown",
            "confidence": None,
            "model_name": self._model_name,
            "model_version": self._model_version,
            "processing_time_ms": 0.0,
            "device_used": "cpu",
            "model_available": False,
            "warnings": [],
            "error_details": None,
            "heatmap_b64": None,
            "heatmap_available": False,
        }

        # Check if model is available
        if not self.is_available():
            result["model_available"] = False
            result["warnings"].append("Model not loaded - using placeholder")
            return result

        result["model_available"] = True
        result["device_used"] = "cpu"  # Will be updated after inference

        try:
            start = time.perf_counter()

            # Preprocess image
            if image.mode != "RGB":
                image = image.convert("RGB")
                
            input_tensor = self._transform(image).unsqueeze(0)
            input_tensor = input_tensor.to(self._device)

            # --- Grad-CAM computation (EfficientNet-B0 features) ---
            # Target the last convolution block in features (layer4 bottleneck)
            try:
                # EfficientNet-B0 features: a sequential of inverted residuals.
                # The final downsample block is features[-1][-1] (last building block).
                # Its output has shape (1, last_channels, H, W) before global avg pool.
                target_layer = self._model.features[-1][-1]

                grad_cam = GradCAM(self._model, target_layer)
                # Target class: fake_label from the registry (1 = fake, 0 = real)
                target_idx = int(self._fake_label)

                # Compute heatmap and overlay
                heatmap = grad_cam.compute_heatmap(input_tensor, target_idx)
                pil_image_rgb = image.convert("RGB") if image.mode != "RGB" else image
                overlay = overlay_heatmap_on_image(pil_image_rgb, heatmap, alpha=0.35)

                # Convert overlay to base64 PNG
                buffered = BytesIO()
                overlay.save(buffered, format="PNG")
                heatmap_b64 = base64.b64encode(buffered.getvalue()).decode("utf-8")

                result["heatmap_b64"] = heatmap_b64
                result["heatmap_available"] = True

                # Clean up hooks
                grad_cam.remove_hooks()
            except Exception:
                # Grad-CAM not available for any reason — keep fields null
                result["heatmap_b64"] = None
                result["heatmap_available"] = False

            # Run inference
            with torch.no_grad():
                output = self._model(input_tensor)
                probabilities = torch.softmax(output, dim=1)
                # Use fake_label from the registry to pick the right class
                fake_prob = probabilities[0, self._fake_label].item()
                real_prob = probabilities[0, 1 - self._fake_label].item()

            elapsed_ms = (time.perf_counter() - start) * 1000.0

            # Use raw fake_prob as confidence (no calibration needed)
            calibrated = fake_prob

            # Determine prediction using 0.65 threshold (FAKE > 0.65)
            prediction = "fake" if fake_prob >= 0.65 else "real"

            result.update({
                "prediction": prediction,
                "confidence": round(calibrated, 4),
                "processing_time_ms": round(elapsed_ms, 2),
                "device_used": "cuda" if self._device == "cuda" else "cpu",
                "model_available": True,
                "warnings": [],
            })

        except Exception as exc:
            result["warnings"].append(f"Detection failed: {exc}")
            result["error_details"] = str(exc)
            # Ensure Grad-CAM fields exist even on error
            result.setdefault("heatmap_b64", None)
            result.setdefault("heatmap_available", False)

        return result

    def get_model_info(self) -> Dict[str, Any]:
        """Return model metadata including name, version, and availability."""
        return {
            "model_name": self._model_name,
            "model_version": self._model_version,
            "is_available": self.is_available(),
            "checkpoint_path": str(self._checkpoint_path) if self._checkpoint_path else "Not specified",
            "device_support": ["cpu", "cuda"],
            "model_size_mb": 0,  # Will be calculated if checkpoint is loaded
        }