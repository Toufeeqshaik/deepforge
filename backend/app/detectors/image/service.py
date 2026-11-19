"""Image/audio detection service orchestrator for DeepForge.

This service loads all models defined in the registry at startup and
computes a combined forensic score for each analysed image (or audio).
"""

import time
import logging
from pathlib import Path
from typing import Literal, Dict, Any, Optional, List
from PIL import Image

from app.core.config import settings
from app.detectors.image.base import ImageDetectionResult, ImageDetector
from app.detectors.image.community_forensics import CommunityForensicsAdapter
from app.detectors.image.fallback import FallbackImageDetector
from app.detectors.image.transformers_adapter import TransformersAdapter
from app.detectors.image.registry import MODEL_REGISTRY
from app.detectors.audio.adapters import AudioAdapter

logger = logging.getLogger(__name__)


class ImageDetectionService:
    """Orchestrates multiple image detection models and aggregates their results."""

    def __init__(self):
        self._detectors: Dict[str, ImageDetector] = {}
        self._initialized = False
        self._fallback_detector: Optional[FallbackImageDetector] = None

        try:
            import torch
            torch.set_num_threads(settings.TORCH_NUM_THREADS)
        except Exception:
            pass

    def initialize(self) -> None:
        """Initialize all registered detectors. Call once at startup."""
        if self._initialized:
            return

        try:
            # Initialize detectors based on the registry
            for entry in MODEL_REGISTRY:
                name = entry["name"]
                loader_type = entry.get("loader")

                if loader_type == "community_forensics":
                    detector = CommunityForensicsAdapter()
                elif loader_type == "transformers_convnext":
                    detector = TransformersAdapter(entry)
                elif loader_type == "transformers_audio":
                    from app.detectors.audio.adapters import AudioAdapter
                    detector = AudioAdapter(entry)
                else:
                    logger.warning(
                        f"Unknown loader type '{loader_type}' for model {name}. Skipping."
                    )
                    continue

                detector.load()
                self._detectors[name] = detector

            # Always ensure fallback is available as a last resort
            self._fallback_detector = FallbackImageDetector()
            self._fallback_detector.load()

            self._initialized = True
            logger.info(
                f"Image detection service initialized with {len(self._detectors)} models"
            )

        except Exception as exc:
            logger.error(f"Failed to initialize image detection service: {exc}")
            raise

    def is_available(self) -> bool:
        """True if at least one primary detector is loaded and ready."""
        if not self._initialized:
            self.initialize()
        return any(d.is_available() for d in self._detectors.values())

    def detect(self, image: Image.Image) -> Dict[str, Any]:
        """Run all available detectors and aggregate a combined score.

        Returns a dict with:
          - per_model_results: List of result dicts (one per model)
          - combined_score: Simple average of confidence scores from active models
          - combined_verdict: Verdict based on thresholds
                REAL < 0.35 | UNCERTAIN 0.35-0.65 | FAKE > 0.65
          - model_count: Number of models that contributed to the average
        """
        if not self._initialized:
            self.initialize()

        per_model_results: List[Dict[str, Any]] = []
        scores: List[float] = []

        # 1. Run all registered models
        for name, detector in self._detectors.items():
            try:
                res = detector.run_detection(image)
                per_model_results.append(res)
                # Only include genuine confidence scores in the average
                if res.get("model_available") and res.get("confidence") is not None:
                    scores.append(res["confidence"])
            except Exception as exc:
                logger.error(f"Detector {name} failed: {exc}")
                per_model_results.append(
                    {
                        "prediction": "unknown",
                        "confidence": None,
                        "model_name": name,
                        "model_version": "1.0.0",
                        "processing_time_ms": 0.0,
                        "device_used": "cpu",
                        "model_available": False,
                        "warnings": [str(exc)],
                        "error_details": str(exc),
                    }
                )

        # 2. Compute combined score (average)
        combined_score = sum(scores) / len(scores) if scores else None

        # 3. Determine combined verdict based on thresholds
        # REAL < 0.35 | UNCERTAIN 0.35-0.65 | FAKE > 0.65
        if combined_score is None:
            combined_verdict = "inconclusive"
        elif combined_score < 0.35:
            combined_verdict = "likely_authentic"
        elif combined_score > 0.65:
            combined_verdict = "likely_manipulated"
        else:
            combined_verdict = "uncertain"

        # 4. If no primary models loaded, try fallback and still report None combined
        if not scores and self._fallback_detector:
            fallback_res = self._fallback_detector.run_detection(image)
            if not per_model_results:
                per_model_results.append(fallback_res)

        return {
            "per_model_results": per_model_results,
            "combined_score": (
                round(combined_score, 4) if combined_score is not None else None
            ),
            "combined_verdict": combined_verdict,
            "model_count": len(scores),
        }

    def classify_verdict(self, raw_score: float, calibrated_confidence: Optional[float] = None) -> str:
        """Classify verdict based on score thresholds (for backward compatibility).
        
        REAL < 0.35 | UNCERTAIN 0.35-0.65 | FAKE > 0.65
        """
        score = calibrated_confidence if calibrated_confidence is not None else raw_score
        if score < 0.35:
            return "likely_authentic"
        elif score > 0.65:
            return "likely_manipulated"
        else:
            return "uncertain"

    def get_model_info(self) -> Dict[str, Any]:
        """Return information about all available models."""
        models_info: Dict[str, Any] = {}
        for name, detector in self._detectors.items():
            models_info[name] = detector.get_model_info()

        if self._fallback_detector:
            models_info["fallback"] = self._fallback_detector.get_model_info()

        return {
            "models_available": models_info,
            "total_detectors": len(models_info),
        }