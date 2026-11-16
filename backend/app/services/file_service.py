from __future__ import annotations

import logging
import shutil
from pathlib import Path

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
    }
    return extension_map.get(ext)


async def validate_image_file(file: UploadFile) -> None:
    """Validate that the upload is an acceptable image file.

    Checks the file extension, declared content type, and size against
    the configured limits.

    Raises:
        FileValidationError: If the filename is missing.
        UnsupportedFileTypeError: If the extension or MIME type is not allowed.
        FileTooLargeError: If the file exceeds the configured size limit.
    """
    if not file.filename:
        raise FileValidationError("Uploaded file has no filename")

    ext = Path(file.filename).suffix.lower()
    if ext not in settings.ALLOWED_IMAGE_EXTENSIONS:
        raise UnsupportedFileTypeError(
            f"File extension '{ext}' is not supported. "
            f"Allowed: {', '.join(settings.ALLOWED_IMAGE_EXTENSIONS)}"
        )

    if file.content_type and file.content_type not in settings.ALLOWED_IMAGE_TYPES:
        raise UnsupportedFileTypeError(
            f"Content type '{file.content_type}' is not supported. "
            f"Allowed: {', '.join(settings.ALLOWED_IMAGE_TYPES)}"
        )

    # Read content to check size
    content = await file.read()
    if len(content) > settings.max_file_size_bytes:
        raise FileTooLargeError(
            f"File size ({len(content) / (1024 * 1024):.1f} MB) exceeds the "
            f"{settings.MAX_FILE_SIZE_MB} MB limit"
        )
    # Seek back so the file can be read again later
    await file.seek(0)


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


def cleanup_analysis_files(analysis_id: str) -> None:
    """Remove temporary and uploaded files associated with an analysis."""
    for base_dir in (settings.UPLOAD_DIR, settings.TEMP_DIR):
        target = Path(base_dir) / analysis_id
        if target.exists():
            shutil.rmtree(target)
            logger.info("Cleaned up %s", target)
