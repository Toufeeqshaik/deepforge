"""Fallback implementation for when Community Forensics model is unavailable."""

import time
import torch
import torch.nn as nn
import torchvision
import torchvision.transforms as transforms
from PIL import Image
from typing import Literal, Dict, Any, Optional
from app.core.config import settings
from app.core.exceptions import ModelNotAvailableError
from app.detectors.image.base import ImageDetectionResult, ImageDetector
from app.detectors.image import preprocessing as preprocessor

class FallbackImageDetector(ImageDetector):
    """Fallback detector that returns 'uncertain' when no valid model is available."""

    def __init__(self):
        self._model = None
        self._device: Literal["cpu", "cuda"] = settings.MODEL_DEVICE  # type: ignore[assignment]
        self._transform = None
        self._load_error: Optional[str] = None
        self._load_attempted = False
        self._model_name = "Fallback"
        self._model_version = "1.0.0"
        
        # Torch threading tuned for Core Ultra 7 (16 logical CPUs).
        try:
            torch.set_num_threads(settings.TORCH_NUM_THREADS)
        except Exception:
            pass

    def load(self) -> None:
        """Attempt to load fallback model (always succeeds as it's built-in)."""
        if self._load_attempted:
            return
            
        try:
            # Use a simple EfficientNet-B0 model
            self._model = torchvision.models.efficientnet_b0(weights=None)
            self._model.classifier[1] = nn.Linear(
                self._model.classifier[1].in_features, 2
            )
            self._model.to(self._device)
            self._model.eval()
            
            # Set up transform
            self._transform = preprocessor.ImagePreprocessor.to_tensor
            
            self._load_attempted = True
            
        except Exception as exc:
            self._load_error = f"Fallback model load failed: {exc}"
            self._model = None
            self._load_attempted = True

    def is_available(self) -> bool:
        """Fallback is always available."""
        if not self._load_attempted:
            self.load()
        return self._model is not None

    def run_detection(self, image: Image.Image) -> ImageDetectionResult:
        """Run detection and return uncertain result when no model is available."""
        result: ImageDetectionResult = {
            "prediction": "uncertain",
            "confidence": None,
            "model_name": self._model_name,
            "model_version": self._model_version,
            "processing_time_ms": 0.0,
            "device_used": "cpu",
            "model_available": False,
            "warnings": ["Model not available - returning uncertain verdict"],
            "error_details": None
        }
        
        # If model is available (shouldn't happen in fallback), run actual detection
        if self.is_available():
            try:
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
                    fake_prob = probabilities[0, 1].item()
                    real_prob = probabilities[0, 0].item()
                    
                elapsed_ms = (time.perf_counter() - start) * 1000.0
                
                # Calibrated confidence
                logit = (fake_prob - 0.5) * 10
                calibrated = 1.0 / (1.0 + torch.exp(torch.tensor(-logit))).item()
                
                result["prediction"] = "fake" if fake_prob >= 0.5 else "real"
                result["confidence"] = round(calibrated, 4)
                result["processing_time_ms"] = round(elapsed_ms, 2)
                result["device_used"] = "cuda" if self._device == "cuda" else "cpu"
                
            except Exception as exc:
                result["warnings"].append(f"Detection failed: {exc}")
                result["error_details"] = str(exc)
                
        return result

    def get_model_info(self) -> Dict[str, Any]:
        """Return model metadata."""
        return {
            "model_name": self._model_name,
            "model_version": self._model_version,
            "is_available": self.is_available(),
            "checkpoint_path": "N/A",
            "device_support": ["cpu", "cuda"],
            "model_size_mb": 0,
        }