from __future__ import annotations

import logging
import shutil
from pathlib import Path

import cv2
from fastapi import UploadFile
from PIL import Image

from app.core.config import settings
from app.core.exceptions import (
    FileTooLargeError,
    FileValidationError,
    UnsupportedFileTypeError,
)

logger = logging.getLogger(__name__)

# Try to import python-magic; fall back to extension-based detection.
try:
    import magic

    _HAS_MAGIC = True
except ImportError:
    _HAS_MAGIC = False
    logger.warning(
        "python-magic not available — MIME type detection will fall back to "
        "file extension checks"
    )


def _detect_mime_type(file_path: Path) -> str | None:
    """Detect the MIME type of a file using libmagic or extension fallback."""
    if _HAS_MAGIC:
        try:
            return magic.from_file(str(file_path), mime=True)
        except Exception:
            logger.warning("libmagic detection failed, falling back to extension")

    ext = file_path.suffix.lower()
    extension_map: dict[str, str] = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
        ".mp4": "video/mp4",
        ".webm": "video/webm",
        ".mov": "video/quicktime",
        ".mkv": "video/x-matroska",
        ".mp3": "audio/mpeg",
        ".wav": "audio/wav",
        ".ogg": "audio/ogg",
        ".m4a": "audio/mp4",
        ".aac": "audio/aac",
    }
    return extension_map.get(ext)


def _get_max_size_bytes(media_type: str) -> int:
    """Return the max upload size in bytes for a given media type."""
    if media_type == "video":
        return settings.max_video_size_bytes
    if media_type == "audio":
        return settings.max_audio_size_bytes
    return settings.max_file_size_bytes


async def validate_media_file(file: UploadFile, media_type: str) -> None:
    """Validate an uploaded media file (image, video, or audio).

    Args:
        file: The uploaded file.
        media_type: One of "image", "video", "audio".

    Raises:
        FileValidationError: If the filename is missing.
        UnsupportedFileTypeError: If the extension or MIME type is not allowed.
        FileTooLargeError: If the file exceeds the configured size limit.
    """
    if not file.filename:
        raise FileValidationError("Uploaded file has no filename")

    ext = Path(file.filename).suffix.lower()
    allowed_extensions: list[str]
    allowed_types: list[str]

    if media_type == "image":
        allowed_extensions = settings.ALLOWED_IMAGE_EXTENSIONS
        allowed_types = settings.ALLOWED_IMAGE_TYPES
    elif media_type == "video":
        allowed_extensions = settings.ALLOWED_VIDEO_EXTENSIONS
        allowed_types = settings.ALLOWED_VIDEO_TYPES
    elif media_type == "audio":
        allowed_extensions = settings.ALLOWED_AUDIO_EXTENSIONS
        allowed_types = settings.ALLOWED_AUDIO_TYPES
    else:
        raise FileValidationError(f"Unknown media type: {media_type}")

    if ext not in allowed_extensions:
        raise UnsupportedFileTypeError(
            f"File extension '{ext}' is not supported for {media_type}. "
            f"Allowed: {', '.join(allowed_extensions)}"
        )

    if file.content_type and file.content_type not in allowed_types:
        raise UnsupportedFileTypeError(
            f"Content type '{file.content_type}' is not supported for {media_type}. "
            f"Allowed: {', '.join(allowed_types)}"
        )

    # Read content to check size
    content = await file.read()
    max_size_bytes = _get_max_size_bytes(media_type)
    if len(content) > max_size_bytes:
        raise FileTooLargeError(
            f"File size ({len(content) / (1024 * 1024):.1f} MB) exceeds the "
            f"{max_size_bytes / (1024 * 1024):.0f} MB limit for {media_type}"
        )
    # Seek back so the file can be read again later
    await file.seek(0)


async def validate_image_file(file: UploadFile) -> None:
    """Validate that the upload is an acceptable image file."""
    await validate_media_file(file, "image")


async def validate_video_file(file: UploadFile) -> None:
    """Validate that the upload is an acceptable video file."""
    await validate_media_file(file, "video")


async def validate_audio_file(file: UploadFile) -> None:
    """Validate that the upload is an acceptable audio file."""
    await validate_media_file(file, "audio")


async def save_upload(file: UploadFile, analysis_id: str) -> Path:
    """Save an uploaded file to the uploads directory.

    Creates a subdirectory named after *analysis_id* inside the configured
    upload directory and writes the file content there.

    Returns:
        The ``Path`` to the saved file on disk.
    """
    upload_dir = Path(settings.UPLOAD_DIR) / analysis_id
    upload_dir.mkdir(parents=True, exist_ok=True)

    filename = file.filename or "upload"
    dest = upload_dir / filename

    content = await file.read()
    dest.write_bytes(content)

    logger.info("Saved upload to %s (%d bytes)", dest, len(content))
    return dest


def get_image_metadata(file_path: Path) -> dict:
    """Extract basic metadata from an image file using Pillow.

    Returns a dict with keys: ``width``, ``height``, ``format``, ``mode``,
    and ``mime_type``.
    """
    with Image.open(file_path) as img:
        metadata: dict = {
            "width": img.width,
            "height": img.height,
            "format": img.format,
            "mode": img.mode,
        }

    detected_mime = _detect_mime_type(file_path)
    if detected_mime:
        metadata["mime_type"] = detected_mime

    return metadata


def get_video_metadata(file_path: Path) -> dict:
    """Extract basic metadata from a video file using OpenCV.

    Returns a dict with keys: ``width``, ``height``, ``fps``,
    ``frame_count``, ``duration_sec``, ``codec``, and ``mime_type``.
    """
    cap = cv2.VideoCapture(str(file_path))
    if not cap.isOpened():
        return {"mime_type": _detect_mime_type(file_path)}

    try:
        metadata: dict = {
            "width": int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)),
            "height": int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)),
            "fps": round(cap.get(cv2.CAP_PROP_FPS) or 0.0, 2),
            "frame_count": int(cap.get(cv2.CAP_PROP_FRAME_COUNT)),
        }
        fps = cap.get(cv2.CAP_PROP_FPS) or 0.0
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        metadata["duration_sec"] = round(frame_count / fps, 2) if fps > 0 else 0.0
        metadata["codec"] = int(cap.get(cv2.CAP_PROP_FOURCC))
    finally:
        cap.release()

    detected_mime = _detect_mime_type(file_path)
    if detected_mime:
        metadata["mime_type"] = detected_mime

    return metadata


def get_audio_metadata(file_path: Path) -> dict:
    """Extract basic metadata from an audio file.

    Uses soundfile if available; otherwise returns extension-based info only.
    """
    metadata: dict = {
        "mime_type": _detect_mime_type(file_path),
    }

    try:
        import soundfile as sf

        info = sf.info(str(file_path))
        metadata.update(
            {
                "sample_rate": info.samplerate,
                "channels": info.channels,
                "format": info.format,
                "subtype": info.subtype,
                "duration_sec": round(info.duration, 2),
                "frames": info.frames,
            }
        )
    except ImportError:
        metadata["error"] = "soundfile not installed — limited audio metadata"
    except Exception as exc:  # noqa: BLE001
        metadata["error"] = f"Could not read audio metadata: {exc}"

    return metadata


def cleanup_analysis_files(analysis_id: str) -> None:
    """Remove temporary and uploaded files associated with an analysis."""
    for base_dir in (settings.UPLOAD_DIR, settings.TEMP_DIR):
        target = Path(base_dir) / analysis_id
        if target.exists():
            shutil.rmtree(target)
            logger.info("Cleaned up %s", target)
