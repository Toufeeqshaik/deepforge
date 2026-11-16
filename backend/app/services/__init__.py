"""DeepForge backend services."""

from app.services.analysis_service import analysis_service
from app.services.detection_service import detection_service

# file_service is a module, not a singleton instance
from app import services as file_service_module

__all__ = ["analysis_service", "detection_service", "file_service_module"]
