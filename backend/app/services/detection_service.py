"""DeepForge image detection service — FastAPI integration layer.

This module bridges the FastAPI routes with the modular detection
components defined in app/detectors/image/.  It owns the public API
surface that routes.py and analysis_service.py depend on.

Public API (unchanged from the original design):
  detection_service.is_available  -> bool
  detection_service.detect(image) -> ImageDetectionResult
  detection_service.classify_verdict(raw_score, calibrated_confidence) -> str
  detection_service.get_model_info() -> dict
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional

import torch
from PIL import Image

from app.core.config import settings
from app.core.exceptions import ModelNotAvailableError
from app.detectors.image.base import ImageDetectionResult
from app.detectors.image.registry import MODEL_REGISTRY
# Service orchestrator — handles all registry models, not just one
from app.detectors.image.service import ImageDetectionService

logger = logging.getLogger(__name__)

# Module-level singleton — imported by routes.py and analysis_service.py
detection_service = ImageDetectionService()