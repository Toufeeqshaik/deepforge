from __future__ import annotations

from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables and .env file."""

    model_config = SettingsConfigDict(env_file=".env", env_prefix="DEEPFORGE_")

    APP_NAME: str = "DeepForge"
    APP_VERSION: str = "0.1.0"
    APP_DESCRIPTION: str = (
        "AI-Powered Digital Media Forensics & Deepfake Intelligence Platform"
    )
    DEBUG: bool = False

    UPLOAD_DIR: str = "uploads"
    TEMP_DIR: str = "temp"
    REPORTS_DIR: str = "reports"

    MAX_FILE_SIZE_MB: int = 50

    ALLOWED_IMAGE_TYPES: list[str] = [
        "image/jpeg",
        "image/png",
        "image/webp",
    ]
    ALLOWED_IMAGE_EXTENSIONS: list[str] = [
        ".jpg",
        ".jpeg",
        ".png",
        ".webp",
    ]

    ALLOWED_VIDEO_TYPES: list[str] = [
        "video/mp4",
        "video/webm",
        "video/quicktime",
        "video/x-matroska",
    ]
    ALLOWED_VIDEO_EXTENSIONS: list[str] = [
        ".mp4",
        ".webm",
        ".mov",
        ".mkv",
    ]

    ALLOWED_AUDIO_TYPES: list[str] = [
        "audio/mpeg",
        "audio/wav",
        "audio/ogg",
        "audio/mp4",
        "audio/x-m4a",
    ]
    ALLOWED_AUDIO_EXTENSIONS: list[str] = [
        ".mp3",
        ".wav",
        ".ogg",
        ".m4a",
        ".aac",
    ]

    MAX_VIDEO_SIZE_MB: int = 250
    MAX_AUDIO_SIZE_MB: int = 50

    # Video frame sampling (honest: temporal detection via sampled frames)
    VIDEO_FRAME_SAMPLE_COUNT: int = 8
    VIDEO_MAX_DURATION_SEC: int = 300

    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
    ]

    MODEL_DEVICE: str = "cpu"

    # AI Detection settings
    # Try the distilled model first (faster, smaller, works reliably)
    MODEL_NAME: str = "jacoballessio/ai-image-detect-distilled"
    DETECTION_TEMPERATURE: float = 0.5  # calibration factor
    TORCH_NUM_THREADS: int = 8

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: str | list[str]) -> list[str]:
        """Accept a comma-separated string or a list."""
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

    @property
    def max_file_size_bytes(self) -> int:
        return self.MAX_FILE_SIZE_MB * 1024 * 1024

    @property
    def max_video_size_bytes(self) -> int:
        return self.MAX_VIDEO_SIZE_MB * 1024 * 1024

    @property
    def max_audio_size_bytes(self) -> int:
        return self.MAX_AUDIO_SIZE_MB * 1024 * 1024


settings = Settings()

# Ensure required directories exist on import
for _dir in (settings.UPLOAD_DIR, settings.TEMP_DIR, settings.REPORTS_DIR):
    Path(_dir).mkdir(parents=True, exist_ok=True)
