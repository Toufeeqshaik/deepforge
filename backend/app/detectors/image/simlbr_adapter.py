"""Adapter for SimLBR (CVPR 2026) AI-generated image detector.

SimLBR learns a tight decision boundary around real images using latent
blending regularization. This adapter uses the official package API:
    SimLBR.from_pretrained("aigc" | "genimage")
"""

import logging
import sys
import time
from pathlib import Path
from typing import Any, Dict, Optional

import torch
from PIL import Image

from app.core.config import settings
from app.detectors.image.base import ImageDetectionResult, ImageDetector

logger = logging.getLogger(__name__)


class SimLBRAdapter(ImageDetector):
    """Adapter for mvrl/SimLBR pretrained detectors."""

    def __init__(self, registry_entry: Optional[Dict[str, Any]] = None):
        self._entry = registry_entry or {}
        self._model = None
        self._transform = None
        self._device: str = (
            "cuda"
            if settings.MODEL_DEVICE == "cuda" and torch.cuda.is_available()
            else "cpu"
        )
        self._model_name = self._entry.get("name", "SimLBR-aigc")
        self._model_version = self._entry.get("version", "1.0.0")
        self._pretrained = self._entry.get("pretrained", "aigc")
        self._load_error: Optional[str] = None
        self._load_attempted = False

    def _ensure_simlbr_importable(self) -> None:
        """Add local SimLBR repo clones to sys.path if the package isn't installed."""
        try:
            import simlbr  # noqa: F401
            return
        except Exception:
            pass

        here = Path(__file__).resolve()
        candidates = [
            Path.cwd() / "third_party" / "SimLBR",
            Path.cwd() / "backend" / "third_party" / "SimLBR",
            here.parents[4] / "third_party" / "SimLBR",  # repo/third_party/SimLBR
            here.parents[3] / "third_party" / "SimLBR",  # backend/third_party/SimLBR
        ]
        for candidate in candidates:
            if (candidate / "simlbr").is_dir():
                candidate_str = str(candidate)
                if candidate_str not in sys.path:
                    sys.path.insert(0, candidate_str)
                return

    def _patch_dinov3_backbone(self) -> None:
        """Use a public transformers DINOv3 mirror when official gated weights are unavailable."""
        import os

        if os.environ.get("DINO_V3_KEY"):
            return
        try:
            import simlbr.backbones as backbones

            if getattr(backbones, "_deepforge_patched", False):
                return

            import torch.nn as nn
            from transformers import AutoModel

            class _TransformersDINOv3Wrapper(nn.Module):
                def __init__(self, model):
                    super().__init__()
                    self.model = model

                def forward_features(self, x):
                    outputs = self.model(pixel_values=x)
                    cls_token = outputs.pooler_output
                    if cls_token is None:
                        cls_token = outputs.last_hidden_state[:, 0]
                    return {"x_norm_clstoken": cls_token}

            def _get_dinov3():
                hf_model = os.environ.get(
                    "SIMLBR_DINOV3_MODEL",
                    "samttran/dinov3-vitl16-pretrain-lvd1689m",
                )
                model = AutoModel.from_pretrained(hf_model)
                return _TransformersDINOv3Wrapper(model), 1024

            backbones.get_dinov3 = _get_dinov3
            backbones._deepforge_patched = True
        except Exception as exc:
            logger.warning("Could not patch SimLBR DINOv3 backbone: %s", exc)

    def load(self) -> None:
        """Load SimLBR model and transform."""
        if self._load_attempted:
            return
        try:
            self._ensure_simlbr_importable()
            self._patch_dinov3_backbone()
            from simlbr import SimLBR
            from simlbr.utils import make_dinov3_transform

            logger.info(
                "Loading SimLBR pretrained='%s' on %s...",
                self._pretrained,
                self._device,
            )
            self._model = SimLBR.from_pretrained(self._pretrained)
            self._model.to(self._device)
            self._model.eval()
            self._transform = make_dinov3_transform()
            self._load_attempted = True
            logger.info("SimLBR loaded successfully.")
        except Exception as exc:
            self._load_error = f"SimLBR load failed: {exc}"
            self._model = None
            self._transform = None
            self._load_attempted = True
            logger.error(self._load_error)

    def is_available(self) -> bool:
        if self._model is not None and self._transform is not None:
            return True
        if not self._load_attempted:
            self.load()
        return self._model is not None and self._transform is not None

    def run_detection(self, image: Image.Image) -> ImageDetectionResult:
        result: ImageDetectionResult = {
            "prediction": "uncertain",
            "confidence": None,
            "model_name": self._model_name,
            "model_version": self._model_version,
            "processing_time_ms": 0.0,
            "device_used": self._device,
            "model_available": False,
            "warnings": [],
            "error_details": None,
        }

        if not self.is_available():
            result["warnings"].append(f"Model not loaded: {self._load_error}")
            result["error_details"] = self._load_error
            return result

        start = time.perf_counter()
        try:
            if image.mode != "RGB":
                image = image.convert("RGB")

            tensor = self._transform(image).unsqueeze(0).to(self._device)
            with torch.no_grad():
                output = self._model(tensor)
                # SimLBR returns logits; sigmoid gives p(fake)
                if hasattr(output, "logits"):
                    logits = output.logits
                else:
                    logits = output
                if logits.ndim > 1:
                    logits = logits.squeeze(-1)
                prob_fake = torch.sigmoid(logits).flatten()[0].item()

            elapsed_ms = (time.perf_counter() - start) * 1000.0
            prediction = "fake" if prob_fake >= 0.5 else "real"
            result.update(
                {
                    "prediction": prediction,
                    "confidence": round(float(prob_fake), 4),
                    "processing_time_ms": round(elapsed_ms, 2),
                    "model_available": True,
                }
            )
        except Exception as exc:
            elapsed_ms = (time.perf_counter() - start) * 1000.0
            logger.error("SimLBR detection failed: %s", exc)
            result["warnings"].append(f"Detection failed: {exc}")
            result["error_details"] = str(exc)
            result["processing_time_ms"] = round(elapsed_ms, 2)

        return result

    def get_model_info(self) -> Dict[str, Any]:
        return {
            "model_name": self._model_name,
            "model_version": self._model_version,
            "is_available": self.is_available(),
            "pretrained": self._pretrained,
            "device_support": ["cpu", "cuda"],
            "architecture": "SimLBR (Latent Blending Regularization, DINOv3 backbone)",
        }
