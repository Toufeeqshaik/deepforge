"""Video detection module for DeepForge.

The video detection pipeline is a work-in-progress.  Importing this package
is safe — broken sub-modules are caught here so they never crash the image
detection service.
"""

# Individual sub-modules (service.py, frame_sampler.py, etc.) are not yet
# fully functional.  They are imported lazily / on demand; do not import them
# at package level so that `from app.detectors.video import ...` in
# analysis_service.py does not crash the entire application.
#
# Stub classes used by analysis_service.py until the video pipeline is complete.

class VideoDetectionService:  # noqa: D101
    """Stub — real implementation pending."""

class FaceExtractor:  # noqa: D101
    """Stub — real implementation pending."""

class FrameSampler:  # noqa: D101
    """Stub — real implementation pending."""
    def __init__(self, **_):
        pass

class FrameAnalyzer:  # noqa: D101
    """Stub — real implementation pending."""

class TemporalAnalyzer:  # noqa: D101
    """Stub — real implementation pending."""
    def __init__(self, **_):
        pass
