"""Adapter for abacusai/Smaug-AI-Image-Detector.

Smaug AI Image Detector by Abacus.AI:
439M-parameter vision-only fine-tune of EmbeddingGemma-2 + linear classifier
specialized in detecting AI-generated images (DALL-E, Midjourney, Stable Diffusion, FLUX, etc.).
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


class SmaugImageDetectorAdapter(ImageDetector):
    """Adapter for abacusai/Smaug-AI-Image-Detector."""

    def __init__(self, registry_entry: Optional[Dict[str, Any]] = None):
        self._entry = registry_entry or {}
        self._detector = None
        self._repo_dir: Optional[str] = None
        self._device: str = (
            "cuda"
            if settings.MODEL_DEVICE == "cuda" and torch.cuda.is_available()
            else "cpu"
        )
        self._model_name = self._entry.get("name", "abacusai/Smaug-AI-Image-Detector")
        self._model_version = self._entry.get("version", "1.0.0")
        self._load_error: Optional[str] = None
        self._load_attempted = False
        preprocessing = self._entry.get("preprocessing", {})
        self._crops: int = preprocessing.get("crops", 1)

    def load(self) -> None:
        """Download snapshot and instantiate SmaugImageDetect."""
        if self._load_attempted:
            return

        try:
            from huggingface_hub import snapshot_download

            repo_id = self._entry.get("hf_model_id", "abacusai/Smaug-AI-Image-Detector")

            # Try local cache first for fast offline startup
            try:
                repo_dir = snapshot_download(repo_id, local_files_only=True)
            except Exception:
                logger.info(f"Downloading snapshot for {repo_id}...")
                repo_dir = snapshot_download(repo_id)

            self._repo_dir = str(repo_dir)

            if self._repo_dir not in sys.path:
                sys.path.insert(0, self._repo_dir)

            from smaug_image_detect import SmaugImageDetect

            logger.info(f"Loading SmaugImageDetect from {self._repo_dir} on {self._device}...")
            self._detector = SmaugImageDetect.from_pretrained(
                self._repo_dir, device=self._device
            )
            self._load_attempted = True
            logger.info("SmaugImageDetect loaded successfully.")

        except Exception as exc:
            self._load_error = f"Smaug model load failed: {exc}"
            self._detector = None
            self._load_attempted = True
            logger.error(self._load_error)

    def is_available(self) -> bool:
        """Check if Smaug detector is loaded and ready."""
        if self._detector is not None:
            return True
        if not self._load_attempted:
            self.load()
        return self._detector is not None

    def run_detection(self, image: Image.Image) -> ImageDetectionResult:
        """Run AI image detection on a PIL Image and return standardized result."""
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
            # Ensure PIL image is in RGB mode
            if image.mode != "RGB":
                image = image.convert("RGB")

            # Inference using SmaugImageDetect
            # Single PIL image returns float prob_ai in [0, 1]
            prob_ai = float(self._detector(image, crops=self._crops))

            elapsed_ms = (time.perf_counter() - start) * 1000.0

            prediction = "fake" if prob_ai >= 0.50 else "real"

            result.update({
                "prediction": prediction,
                "confidence": round(prob_ai, 4),
                "model_name": self._model_name,
                "model_version": self._model_version,
                "processing_time_ms": round(elapsed_ms, 2),
                "device_used": self._device,
                "model_available": True,
                "warnings": [],
                "error_details": None,
            })

        except Exception as exc:
            elapsed_ms = (time.perf_counter() - start) * 1000.0
            logger.error(f"Smaug detection failed: {exc}")
            result["warnings"].append(f"Detection failed: {exc}")
            result["error_details"] = str(exc)
            result["processing_time_ms"] = round(elapsed_ms, 2)

        return result

    def get_model_info(self) -> Dict[str, Any]:
        """Return model metadata."""
        return {
            "model_name": self._model_name,
            "model_version": self._model_version,
            "is_available": self.is_available(),
            "checkpoint_path": self._repo_dir or "HuggingFace Hub",
            "device_support": ["cpu", "cuda", "mps"],
            "model_size_mb": 837,
            "architecture": "EmbeddingGemma-2 + linear classifier (439M)",
        }
