"""Analysis orchestration service — DeepForge backbone.

Handles image analysis requests, coordinates detection models, and
produces standardized AnalysisReport outputs. Uses an in-memory store
(initially); swap to SQLite or another DB later without changing the API.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from pathlib import Path

from app.core.config import settings
from app.core.exceptions import AnalysisError, ModelNotAvailableError
from app.schemas.analysis import (
    AnalysisReport,
    AnalysisStatus,
    AnalysisType,
    DetectorResult,
    VerdictLevel,
)
from app.services.detection_service import detection_service
from app.services.file_service import get_image_metadata


class AnalysisService:
    """Manages image analysis jobs and results."""

    def __init__(self) -> None:
        self._analyses: dict[str, AnalysisReport] = {}
        self._load_time: float | None = None

    def start(self) -> None:
        """Called at FastAPI startup: pre-load the detection model."""
        start = datetime.now()
        try:
            detection_service.load()
            if detection_service.is_available:
                self._load_time = (datetime.now() - start).total_seconds()
        except Exception:
            pass

    def create_analysis(
        self,
        file_path: Path,
        file_name: str,
        file_size: int,
        file_type: str,
    ) -> AnalysisReport:
        """Create a new analysis record."""
        analysis_id = str(uuid.uuid4())
        report = AnalysisReport(
            analysis_id=analysis_id,
            status=AnalysisStatus.PENDING,
            analysis_type=AnalysisType.IMAGE,
            created_at=datetime.utcnow(),
            completed_at=None,
            file_name=file_name,
            file_size_bytes=file_size,
            file_type=file_type,
            overall_verdict=VerdictLevel.INCONCLUSIVE,
            summary="Analysis initialized.",
            detector_results=[],
            forensic_indicators=[],
            limitations=[],
            processing_time_ms=0.0,
            metadata={},
        )
        self._analyses[analysis_id] = report
        return report

    def run_image_analysis(self, analysis_id: str, file_path: Path) -> AnalysisReport:
        """Run a full image analysis pipeline."""
        report = self._analyses.get(analysis_id)
        if not report:
            raise AnalysisError(f"Analysis {analysis_id} not found")

        start_time = datetime.utcnow()
        report.status = AnalysisStatus.PROCESSING
        report.summary = "Validating file and preprocessing image..."

        try:
            # Get image metadata
            metadata = get_image_metadata(file_path)
            report.metadata = metadata
            report.summary = "Preprocessing complete. Running detection models..."

            # Run detection (only one model for v1)
            detector_result = self._run_single_detector(file_path)
            report.detector_results = [detector_result]

            # Determine overall verdict
            raw_score = detector_result.raw_score
            cal_conf = detector_result.calibrated_confidence

            # For face-swap deepfake detection (EfficientNet-B0 on FF++ C23):
            # - >= 0.85: likely_manipulated (strong evidence)
            # - >= 0.70: potentially_manipulated (moderate evidence)
            # - >= 0.40: uncertain (ambiguous)
            # - < 0.40: likely_authentic (likely real)
            if raw_score >= 0.85 and cal_conf and cal_conf >= 0.85:
                verdict = VerdictLevel.LIKELY_MANIPULATED
                summary = (
                    "The image shows strong indicators of being a face-swap deepfake. "
                    "Multiple forensic signals align with synthetic manipulation characteristics."
                )
            elif raw_score >= 0.70 and cal_conf and cal_conf >= 0.70:
                verdict = VerdictLevel.POTENTIALLY_MANIPULATED
                summary = (
                    "The image shows moderate indicators of being a face-swap deepfake. "
                    "Further verification is recommended before drawing conclusions."
                )
            elif raw_score >= 0.40 or (cal_conf and cal_conf >= 0.40):
                verdict = VerdictLevel.UNCERTAIN
                summary = (
                    "The analysis could not confidently determine authenticity. "
                    "Evidence is mixed or inconclusive."
                )
            else:
                verdict = VerdictLevel.LIKELY_AUTHENTIC
                summary = (
                    "The image shows no strong indicators of face-swap manipulation. "
                    "Based on this analysis, it is likely authentic."
                )

            # Build forensic indicators list
            indicators = []
            if detector_result.raw_score > 0.5:
                indicators.append(
                    f"Detected AI probability: {detector_result.raw_score:.0%}"
                )
            if metadata.get("dimensions"):
                indicators.append(
                    f"Image dimensions: {metadata['dimensions']}"
                )
            if metadata.get("format"):
                indicators.append(f"File format: {metadata['format']}")
            if not detection_service.is_available:
                indicators.append("No detection models loaded")

            # Build limitations list
            limitations = []
            if not detection_service.is_available:
                limitations.append(
                    "Detection models are not loaded. Results are unavailable."
                )
            else:
                limitations.append(
                    "Face-swap deepfake detector (EfficientNet-B0, FaceForensics++ C23)."
                )
                limitations.append(
                    "Accuracy: 85.2% (frame-level), 88%+ (video-level) on FF++ C23."
                )
                limitations.append(
                    "Cross-dataset accuracy drops on newer manipulations or heavily compressed images."
                )
                limitations.append(
                    "Confidence scores are calibrated indicators, not true probabilities."
                )

            elapsed_ms = (datetime.utcnow() - start_time).total_seconds() * 1000

            report.overall_verdict = verdict
            report.summary = summary
            report.forensic_indicators = indicators
            report.limitations = limitations
            report.processing_time_ms = round(elapsed_ms, 2)
            report.status = AnalysisStatus.COMPLETED
            report.completed_at = datetime.utcnow()

            return report

        except ModelNotAvailableError as e:
            elapsed_ms = (datetime.utcnow() - start_time).total_seconds() * 1000
            report.overall_verdict = VerdictLevel.INCONCLUSIVE
            report.summary = (
                "Detection models are not yet integrated. Image was successfully "
                "uploaded and validated, but no AI analysis could be performed."
            )
            report.limitations = [
                f"Model error: {e.message}",
                "No detection models currently loaded",
            ]
            report.processing_time_ms = round(elapsed_ms, 2)
            report.status = AnalysisStatus.FAILED
            report.completed_at = datetime.utcnow()
            return report

        except Exception as e:
            report.overall_verdict = VerdictLevel.INCONCLUSIVE
            report.summary = f"Analysis failed: {e}"
            report.limitations = ["Unexpected error during analysis"]
            report.status = AnalysisStatus.FAILED
            report.completed_at = datetime.utcnow()
            return report

    def _run_single_detector(self, file_path: Path) -> DetectorResult:
        """Run the detection model and return a DetectorResult."""
        from PIL import Image

        image = Image.open(file_path)
        score = detection_service.run_detection(image)

        verdict = detection_service.classify_verdict(
            score["raw_score"],
            score.get("calibrated_confidence"),
        )

        return DetectorResult(
            detector_name="Xicor9/efficientnet-b0-ffpp-c23",
            detector_version="v1.0",
            verdict=verdict,
            raw_score=score["raw_score"],
            calibrated_confidence=score.get("calibrated_confidence"),
            processing_time_ms=score["processing_time_ms"],
            details=score["details"],
            limitations=[
                "EfficientNet-B0 fine-tuned on FaceForensics++ C23",
                "Detects face-swap deepfakes (DeepFake, FaceSwap, Face2Face, NeuralTextures)",
            ],
        )

    def get_analysis(self, analysis_id: str) -> AnalysisReport | None:
        """Get a specific analysis report."""
        return self._analyses.get(analysis_id)

    def get_all_analyses(self) -> list[AnalysisReport]:
        """Get all analyses, most recent first."""
        return sorted(
            self._analyses.values(),
            key=lambda a: a.created_at,
            reverse=True,
        )


# Module-level singleton
analysis_service = AnalysisService()
