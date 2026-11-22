"""Fallback implementation for when all real detectors are unavailable.

IMPORTANT: This is a degraded-mode stub, not a detection model. It must NEVER
fabricate a confidence probability. An earlier version loaded an EfficientNet-B0
with random weights (``weights=None``) and reported its meaningless output as a
genuine calibrated probability — that has been removed. When only the fallback
is present the honest result is ``confidence=None`` and an inconclusive verdict.
"""

from app.detectors.image.base import ImageDetectionResult, ImageDetector
from PIL import Image
from typing import Any, Dict


class FallbackImageDetector(ImageDetector):
    """Stub detector that returns an honest 'uncertain' result with no score."""

    def __init__(self):
        self._model_name = "Fallback"
        self._model_version = "1.0.0"

    def load(self) -> None:
        """No-op: the fallback never loads a model (no random-weight inference)."""
        return

    def is_available(self) -> bool:
        """The fallback stub is always present to handle requests gracefully."""
        return True

    def run_detection(self, image: Image.Image) -> ImageDetectionResult:
        """Return an honest degraded result — no fabricated probability."""
        return {
            "prediction": "uncertain",
            "confidence": None,
            "model_name": self._model_name,
            "model_version": self._model_version,
            "processing_time_ms": 0.0,
            "device_used": "cpu",
            "model_available": False,
            "warnings": [
                "No detection model available — returning an inconclusive result "
                "with no confidence score."
            ],
            "error_details": None,
        }

    def get_model_info(self) -> Dict[str, Any]:
        """Return fallback metadata."""
        return {
            "model_name": self._model_name,
            "model_version": self._model_version,
            "is_available": self.is_available(),
            "checkpoint_path": "N/A",
            "device_support": ["cpu", "cuda"],
            "model_size_mb": 0,
        }
