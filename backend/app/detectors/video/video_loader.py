"""Video loading and preprocessing utilities for DeepForge video detection."""

import time
import logging
from pathlib import Path
from typing import Literal, Dict, Any, Optional
from app.core.config import settings
from app.core.exceptions import VideoValidationError

logger = logging.getLogger(__name__)

class VideoLoader:
    """Handle video file loading and initial validation."""
    
    @staticmethod
    def validate_video_file(file_path: Path) -> bool:
        """Validate video file exists and is readable."""
        if not file_path.exists():
            logger.error(f"Video file not found: {file_path}")
            return False
        if not file_path.is_file():
            logger.error(f"Path is not a file: {file_path}")
            return False
        return True
    
    @staticmethod
    def validate_video_size(file_path: Path, max_size_bytes: int = 500 * 1024 * 1024) -> bool:
        """Check if video file size is within limits."""
        try:
            return file_path.stat().st_size <= max_size_bytes
        except OSError:
            return False
    
    @staticmethod
    def validate_video_duration(file_path: Path, max_duration_seconds: int = 3600) -> bool:
        """Check if video duration is within limits."""
        try:
            import subprocess
            result = subprocess.run(
                ['ffprobe', '-v', 'error', '-show_entries', 'format=duration', 
                 '-of', 'default=noprint_wrappers=1:nokey=1', str(file_path)],
                capture_output=True, text=True, timeout=10
            )
            if result.returncode != 0:
                logger.error(f"Failed to get video duration: {result.stderr}")
                return False
            duration = float(result.stdout.strip())
            return duration <= max_duration_seconds
        except Exception as e:
            logger.error(f"Failed to validate video duration: {e}")
            return False
    
    @staticmethod
    def get_video_duration(file_path: Path) -> Optional[float]:
        """Get video duration in seconds."""
        try:
            import subprocess
            result = subprocess.run(
                ['ffprobe', '-v', 'error', '-show_entries', 'format=duration', 
                 '-of', 'default=noprint_wrappers=1:nokey=1', str(file_path)],
                capture_output=True, text=True, timeout=10
            )
            if result.returncode == 0:
                return float(result.stdout.strip())
        except Exception as e:
            logger.error(f"Failed to get video duration: {e}")
        return None