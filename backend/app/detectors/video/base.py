"""Common interface for video detection services."""

from typing import Literal, Dict, Any, Optional, TypedDict
from PIL import Image
import abc

class VideoDetectionResult(TypedDict):
    status: Literal["completed", "incomplete", "insufficient_evidence", "model_unavailable"]
    video_verdict: Optional[Literal["likely_authentic", "potentially_manipulated", "uncertain", "inconclusive"]]
    confidence: Optional[float]  # Only when genuine inference is performed
    model_name: str
    model_version: str
    processing_time_ms: float
    device_used: Literal["cpu", "cuda"]
    video_metadata: Dict[str, Any]
    frames_analyzed: int
    faces_detected: int
    frames_with_faces: int
    frame_level_results: list
    temporal_evidence: list
    warnings: list
    error_details: Optional[str]

class VideoDetector(abc.ABC):
    """Base interface for video detection services."""

    @abc.abstractmethod
    def is_available(self) -> bool:
        """Check if the detector is available and loaded."""

    @abc.abstractmethod
    def analyze_video(self, video_path: str) -> VideoDetectionResult:
        """Analyze a video file and return detection results."""

    @abc.abstractmethod
    def get_model_info(self) -> Dict[str, Any]:
        """Return model metadata including name, version, and availability."""