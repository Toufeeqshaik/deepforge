from __future__ import annotations


class DeepForgeException(Exception):
    """Base exception for the DeepForge platform."""

    def __init__(self, message: str, status_code: int = 500) -> None:
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class FileValidationError(DeepForgeException):
    """Raised when an uploaded file fails validation."""

    def __init__(self, message: str) -> None:
        super().__init__(message, status_code=400)


class FileTooLargeError(DeepForgeException):
    """Raised when an uploaded file exceeds the size limit."""

    def __init__(self, message: str) -> None:
        super().__init__(message, status_code=413)


class UnsupportedFileTypeError(DeepForgeException):
    """Raised when an uploaded file's type is not supported."""

    def __init__(self, message: str) -> None:
        super().__init__(message, status_code=415)


class AnalysisError(DeepForgeException):
    """Raised when an analysis operation fails."""

    def __init__(self, message: str) -> None:
        super().__init__(message, status_code=500)


class ModelNotAvailableError(DeepForgeException):
    """Raised when a required model is not loaded or available."""

    def __init__(self, message: str) -> None:
        super().__init__(message, status_code=503)
