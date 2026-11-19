"""Common interface for image detection services."""
from typing import Dict, Literal, Optional, TypedDict, Any
from PIL import Image
import abc

class ImageDetectionResult(TypedDict):
    prediction: Literal["real", "fake"]
    confidence: Optional[float]  # Only when genuine inference is performed
    model_name: str
    model_version: str
    processing_time_ms: float
    device_used: Literal["cpu", "cuda"]
    model_available: bool
    warnings: list[str]
    error_details: Optional[str]

class ImageDetector(abc.ABC):
    """Base interface for image detection services."""

    @abc.abstractmethod
    def is_available(self) -> bool:
        """Check if the detector is available and loaded."""

    @abc.abstractmethod
    def run_detection(self, image: Image.Image) -> ImageDetectionResult:
        """Run detection on a PIL Image and return results."""

    @abc.abstractmethod
    def get_model_info(self) -> Dict[str, Any]:
        """Return model metadata including name, version, and availability."""