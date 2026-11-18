"""HuggingFace Transformers adapter for image detection.

This adapter uses the transformers library to load models from the HF Hub.
It is used by the Imager-1-Pro detector.
"""

import time
import torch
from PIL import Image
from typing import Dict, Any, Optional
from transformers import AutoImageProcessor, AutoModelForImageClassification
from app.core.config import settings
from app.detectors.image.base import ImageDetectionResult, ImageDetector

class TransformersAdapter(ImageDetector):
    """Adapter for HuggingFace Transformers models."""

    def __init__(self, registry_entry: Dict[str, Any]):
        self._entry = registry_entry
        self._model = None
        self._processor = None
        self._device: str = settings.MODEL_DEVICE
        self._load_error: Optional[str] = None
        self._load_attempted = False

    def load(self) -> None:
        """Load model and processor from HuggingFace Hub."""
        if self._load_attempted:
            return
        
        try:
            model_id = self._entry["hf_model_id"]
            # Use the official HF Auto classes for loading
            self._processor = AutoImageProcessor.from_pretrained(model_id)
            self._model = AutoModelForImageClassification.from_pretrained(model_id)
            self._model.to(self._device)
            self._model.eval()
            self._load_attempted = True
        except Exception as exc:
            self._load_error = f"Transformer load failed: {exc}"
            self._load_attempted = True

    def is_available(self) -> bool:
        """Check if the model is loaded and ready."""
        if not self._load_attempted:
            self.load()
        return self._model is not None

    def run_detection(self, image: Image.Image) -> ImageDetectionResult:
        """Perform inference and return standardized result."""
        if not self.is_available():
            # Signal that model is missing; a warning will be added by the service
            return {
                "prediction": "unknown",
                "confidence": None,
                "model_name": self._entry["name"],
                "model_version": "1.0.0",
                "processing_time_ms": 0.0,
                "device_used": self._device,
                "model_available": False,
                "warnings": [f"Model not loaded: {self._load_error}"],
                "error_details": self._load_error,
            }

        start = time.perf_counter()
        
        try:
            # Standard Transformers pipeline: Image -> Tensors -> Model -> Logits
            inputs = self._processor(images=image, return_tensors="pt")
            inputs = {k: v.to(self._device) for k, v in inputs.items()}
            
            with torch.no_grad():
                outputs = self._model(**inputs)
                # Convert logits to probabilities using Softmax
                probabilities = torch.softmax(outputs.logits, dim=-1)
            
            # Determine fake probability using the registry's fake_label
            fake_label_idx = self._entry["fake_label"]
            fake_prob = probabilities[0, fake_label_idx].item()
            
            elapsed_ms = (time.perf_counter() - start) * 1000.0
            
            return {
                "prediction": "fake" if fake_prob >= 0.5 else "real",
                "confidence": round(fake_prob, 4),
                "model_name": self._entry["name"],
                "model_version": "1.0.0",
                "processing_time_ms": round(elapsed_ms, 2),
                "device_used": self._device,
                "model_available": True,
                "warnings": [],
                "error_details": None,
            }
        except Exception as exc:
            return {
                "prediction": "unknown",
                "confidence": None,
                "model_name": self._entry["name"],
                "model_version": "1.0.0",
                "processing_time_ms": 0.0,
                "device_used": self._device,
                "model_available": True,
                "warnings": [f"Inference failed: {exc}"],
                "error_details": str(exc),
            }

    def get_model_info(self) -> Dict[str, Any]:
        """Return model metadata."""
        return {
            "model_name": self._entry["name"],
            "is_available": self.is_available(),
            "hf_id": self._entry["hf_model_id"],
        }
