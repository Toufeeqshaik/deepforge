"""AI image detection service — DeepForge face-swap deepfake detector.

Model: Xicor9/efficientnet-b0-ffpp-c23 (EfficientNet-B0 fine-tuned on FaceForensics++ C23)
- Architecture: EfficientNet-B0
- Dataset: FaceForensics++ C23 (DeepFake, FaceSwap, Face2Face, NeuralTextures)
- Accuracy: 85.2% (frame-level), 88%+ (video-level)
- License: Research/Educational only

CPU inference optimized for Core Ultra 7 with 8 threads.
"""

from __future__ import annotations

import time
from typing import Literal

import torch
import torch.nn as nn
from PIL import Image
from torchvision import models

from app.core.config import settings
from app.core.exceptions import ModelNotAvailableError


class ImageDetectionService:
    """Detection service for face-swap deepfake detection."""

    def __init__(self) -> None:
        self._model_name = "Xicor9/efficientnet-b0-ffpp-c23"
        self._device: Literal["cpu", "cuda"] = settings.MODEL_DEVICE  # type: ignore[assignment]
        self._model = None
        self._transform = None
        self._load_error: str | None = None
        self._load_attempted = False

        # Torch threading tuned for Core Ultra 7 (16 logical CPUs).
        try:
            torch.set_num_threads(settings.TORCH_NUM_THREADS)
        except Exception:
            pass

    def load(self) -> None:
        """Load the detection model. Call once at FastAPI startup."""
        try:
            # Rebuild EfficientNet-B0 architecture
            self._model = models.efficientnet_b0(weights=None)
            self._model.classifier[1] = nn.Linear(
                self._model.classifier[1].in_features, 2
            )

            # Download and load weights
            state_dict = torch.hub.load_state_dict_from_url(
                "https://huggingface.co/Xicor9/efficientnet-b0-ffpp-c23/resolve/main/efficientnet_b0_ffpp_c23.pth",
                map_location=self._device,
                model_dir="/run/media/toufeeq/External/deepforge-models",
                progress=True,
            )

            self._model.load_state_dict(state_dict)
            self._model.to(self._device)
            self._model.eval()

            # Image transform (same as training: resize to 224x224, normalize)
            from torchvision import transforms

            self._transform = transforms.Compose([
                transforms.Resize((224, 224)),
                transforms.ToTensor(),
                transforms.Normalize(
                    mean=[0.485, 0.456, 0.406],  # ImageNet stats
                    std=[0.229, 0.224, 0.225],
                ),
            ])
        except Exception as exc:
            self._load_error = f"Model load failed: {exc}"
            self._model = None

        self._load_attempted = True

    @property
    def is_available(self) -> bool:
        if self._model is not None:
            return True
        # Try to load once if not attempted yet
        if not self._load_attempted:
            self.load()
        return self._model is not None

    @property
    def load_error(self) -> str | None:
        return self._load_error

    def run_detection(self, image: Image.Image) -> dict:
        """Run detection on a PIL Image.

        Returns a dict with:
        - label: "real" or "fake"
        - raw_score: probability of being fake (0-1)
        - calibrated_confidence: calibrated indicator (0-1)
        - processing_time_ms: inference time
        - details: additional metadata
        """
        if self._model is None:
            raise ModelNotAvailableError(self._load_error or "model not loaded")

        start = time.perf_counter()

        # Preprocess image
        if image.mode != "RGB":
            image = image.convert("RGB")

        input_tensor = self._transform(image).unsqueeze(0)
        input_tensor = input_tensor.to(self._device)

        # Run inference
        with torch.no_grad():
            output = self._model(input_tensor)
            probabilities = torch.softmax(output, dim=1)
            fake_prob = probabilities[0, 1].item()  # Class 1 is "fake"
            real_prob = probabilities[0, 0].item()  # Class 0 is "real"

        elapsed_ms = (time.perf_counter() - start) * 1000.0

        # Calibrated confidence (simple logistic calibration)
        logit = (fake_prob - 0.5) * 10  # Stretch around 0.5
        calibrated = 1.0 / (1.0 + torch.exp(torch.tensor(-logit))).item()

        return {
            "label": "fake" if fake_prob >= 0.5 else "real",
            "raw_score": round(fake_prob, 4),
            "calibrated_confidence": round(calibrated, 4),
            "processing_time_ms": round(elapsed_ms, 2),
            "details": {
                "real_prob": round(real_prob, 4),
                "fake_prob": round(fake_prob, 4),
                "device": self._device,
                "model": self._model_name,
                "architecture": "EfficientNet-B0",
                "dataset": "FaceForensics++ C23",
            },
        }

    def classify_verdict(self, raw_score: float, calibrated_confidence: float | None = None) -> str:
        """Map detector output to verdict enum.

        Thresholds based on the model's 85.2% accuracy profile:
        - >= 0.85: likely_manipulated (strong evidence of deepfake)
        - >= 0.70: potentially_manipulated (moderate evidence)
        - >= 0.40: uncertain (ambiguous)
        - < 0.40: likely_authentic (likely real)
        """
        conf = calibrated_confidence if calibrated_confidence is not None else raw_score

        if raw_score >= 0.85 and conf >= 0.85:
            return "likely_manipulated"
        if raw_score >= 0.70 and conf >= 0.70:
            return "potentially_manipulated"
        if raw_score >= 0.40 or (conf is not None and conf >= 0.40):
            return "uncertain"
        return "likely_authentic"


# Module-level singleton - will load model on startup
detection_service = ImageDetectionService()
