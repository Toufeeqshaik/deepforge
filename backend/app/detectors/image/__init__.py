"""Image detection module for DeepForge.
Contains the standardized image detection interface and implementations.
"""

from app.detectors.image.base import ImageDetectionResult, ImageDetector
from app.detectors.image.community_forensics import CommunityForensicsAdapter
from app.detectors.image.fallback import FallbackImageDetector
from app.detectors.image.registry import MODEL_REGISTRY, get_model_entry
from app.detectors.image.service import ImageDetectionService

__all__ = [
    "ImageDetectionResult",
    "ImageDetector",
    "CommunityForensicsAdapter",
    "FallbackImageDetector",
    "MODEL_REGISTRY",
    "get_model_entry",
    "ImageDetectionService",
]
