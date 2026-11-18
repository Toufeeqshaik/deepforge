"""Analysis orchestration service — DeepForge backbone.

Handles image analysis requests, coordinates detection models, and
produces standardized AnalysisReport outputs. Uses an in-memory store
(initially); swap to SQLite or another DB later without changing the API.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from pathlib import Path
from typing import Literal, Dict, Any, Optional, List

from app.core.config import settings
from app.core.exceptions import AnalysisError, VideoValidationError
from app.schemas.analysis import (
    AnalysisReport,
    AnalysisStatus,
    AnalysisType,
    DetectorResult,
    VerdictLevel,
)
from app.services.detection_service import detection_service
from app.detectors.image.registry import MODEL_REGISTRY
from app.services.file_service import (
    save_upload,
    validate_image_file,
    validate_video_file,
    validate_audio_file,
)
from app.services.video_detection_service import video_detection_service
from app.detectors.video import (
    VideoDetectionService,
    FaceExtractor,
    FrameSampler,
    FrameAnalyzer,
    TemporalAnalyzer,
)

class AnalysisService:
    """Manages analysis jobs and results."""

    def __init__(self) -> None:
        self._analyses: dict[str, AnalysisReport] = {}
        self._load_time: float | None = None
        self._video_service_initialized = False
        self._image_detector_service = None
        self._video_service = None

    def start(self) -> None:
        """Called at FastAPI startup: pre-load the detection model."""
        start = datetime.now()
        try:
            detection_service.load()
            if detection_service.is_available:
                self._load_time = (datetime.now() - start).total_seconds()
                
                # Initialize video service
                self._initialize_video_service()
                
        except Exception:
            pass

    def _initialize_video_service(self) -> None:
        """Initialize the video detection service."""
        if self._video_service_initialized:
            return
            
        try:
            # Initialize video components
            self._video_service = VideoDetectionService(
                image_detector_service=detection_service,
                face_extractor=FaceExtractor(),
                frame_sampler=FrameSampler(
                    max_frames=16,
                    sampling_interval_sec=1.0,
                    resize_width=224,
                    resize_height=224
                ),
                temporal_analyzer=TemporalAnalyzer(
                    min_frames_for_analysis=5,
                    similarity_threshold=0.7,
                    max_velocity=5.0
                )
            )
            self._video_service.initialize()
            self._video_service_initialized = True
            logger.info("Video detection service initialized")
            
        except Exception as exc:
            logger.error(f"Failed to initialize video service: {exc}")
            raise

    def create_analysis(
        self,
        file_path: Path,
        file_name: str,
        file_size: int,
        file_type: str,
        analysis_type: AnalysisType = AnalysisType.IMAGE,
    ) -> AnalysisReport:
        """Create a new analysis record."""
        analysis_id = str(uuid.uuid4())
        report = AnalysisReport(
            analysis_id=analysis_id,
            status=AnalysisStatus.PENDING,
            analysis_type=analysis_type,
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

            # Determine overall verdict using combined score from multi-model detection
            raw_score = detector_result.raw_score
            cal_conf = detector_result.calibrated_confidence

            # Use the combined verdict from the detector if available,
            # otherwise fall back to the original single-model logic
            if detector_result.details and detector_result.details.get("combined_verdict"):
                combined_v = detector_result.details["combined_verdict"]
                if combined_v == "likely_manipulated":
                    verdict = VerdictLevel.LIKELY_MANIPULATED
                    summary = (
                        "The image shows strong indicators of being AI-generated or "
                        "face-swapped deepfake. Multiple forensic signals from diverse "
                        "models align with synthetic manipulation characteristics."
                    )
                elif combined_v == "likely_authentic":
                    verdict = VerdictLevel.LIKELY_AUTHENTIC
                    summary = (
                        "The image shows no strong indicators of AI-generation or "
                        "face-swap manipulation. Based on this analysis, it is likely authentic."
                    )
                elif combined_v == "uncertain":
                    verdict = VerdictLevel.UNCERTAIN
                    summary = (
                        "The analysis could not confidently determine authenticity. "
                        "Evidence is mixed or inconclusive across the available models."
                    )
                else:
                    verdict = VerdictLevel.INCONCLUSIVE
                    summary = "Analysis inconclusive."
            else:
                # Original single-model fallback logic
                # For face-swap deepfake detection (EfficientNet-B0 on FF++ C23):
                # - >= 0.85: likely_manipulated (strong evidence)
                # - >= 0.70: potentially_manipulated (moderate evidence)
                # - >= 0.40: uncertain (ambiguous)
                # - < 0.40: likely_authentic (likely authentic)
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
                    "Face-swap deepfake detector (EfficientNet-B0, CommunityForensics++ C23)."
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
        """Run the detection model and return a DetectorResult.

        ImageDetectionResult keys used here:
          "prediction"        -> "real" | "fake" | "uncertain"
          "confidence"        -> float | None  (calibrated; None when model unavailable)
          "processing_time_ms"-> float
          "model_name"        -> str  (from registry via adapter)
          "warnings"          -> list[str]
        """
        from PIL import Image

        image = Image.open(file_path)
        score = detection_service.detect(image)

        # "confidence" is the calibrated probability; use it as raw_score too.
        # The new detect() returns combined_score and combined_verdict from all models.
        raw = score["combined_score"] if score["combined_score"] is not None else 0.0
        combined_verdict = score["combined_verdict"]
        model_count = score["model_count"]

        verdict = detection_service.classify_verdict(
            raw_score=raw,
            calibrated_confidence=score["confidence"] if isinstance(score.get("confidence"), float) else None,
        )

        # Pull the canonical model name from the registry entry
        registry_name = MODEL_REGISTRY[0]["name"] if MODEL_REGISTRY else "unknown"

        # Build details with per-model info
        per_model = score.get("per_model_results", [])
        model_details = []
        for mres in per_model:
            if mres.get("model_available") and mres.get("confidence") is not None:
                model_details.append(
                    f"{mres.get('model_name', 'unknown')}: {mres['confidence']:.2f}"
                )
        details_str = "; ".join(model_details) if model_details else ""

        return DetectorResult(
            detector_name=registry_name,
            detector_version="v1.0",
            verdict=combined_verdict if combined_verdict != "inconclusive" else verdict,
            raw_score=raw,
            calibrated_confidence=score["confidence"] if score["confidence"] is not None else None,
            processing_time_ms=score.get("per_model_results", [{}])[0].get("processing_time_ms", score["processing_time_ms"])
            if score.get("per_model_results")
            else score.get("processing_time_ms", 0.0),
            details={
                "prediction": score.get("per_model_results", [{}])[0].get("prediction", "unknown")
                if score.get("per_model_results")
                else "unknown",
                "model_available": score.get("model_available", False),
                "device_used": score.get("per_model_results", [{}])[0].get("device_used", "cpu")
                if score.get("per_model_results")
                else "cpu",
                "combined_score": score["combined_score"],
                "combined_verdict": score["combined_verdict"],
                "model_count": model_count,
                "per_model_details": details_str,
            },
            limitations=[
                "Multi-model detection: EfficientNet-B0 (CommunityForensics) + Imager-1-Pro (ConvNeXt-Base)",
                "Combined score is a simple average of individual model confidences",
                "Confidence scores are calibrated indicators, not true probabilities",
                f"Number of models contributing: {model_count}",
            ],
        )

    def run_video_analysis(self, analysis_id: str, file_path: Path) -> AnalysisReport:
        """Run a video analysis pipeline."""
        report = self._analyses.get(analysis_id)
        if not report:
            raise AnalysisError(f"Analysis {analysis_id} not found")

        start_time = datetime.utcnow()
        report.status = AnalysisStatus.PROCESSING
        report.summary = "Validating video and sampling frames..."

        try:
            # Get video metadata
            metadata = get_video_metadata(file_path)
            report.metadata = metadata
            report.summary = "Sampling frames and running face-swap detector..."

            # Run video detection
            video_result = self._video_service.analyze_video(str(file_path))
            report.detector_results = [self._convert_video_result(video_result)]
            
            # Update temporal evidence
            result = self._temporal_analyzer.analyze()
            report.forensic_indicators.extend(result.get("temporal_evidence", []))
            report.warnings.extend(result.get("warnings", []))
            if result.get("error_details"):
                report.limitations.append(f"Video analysis error: {result['error_details']}")
                
            # Update report metadata and timing
            report.processing_time_ms = result["processing_time_ms"]
            report.status = AnalysisStatus.COMPLETED
            report.completed_at = datetime.utcnow()
            
            return report

        except VideoValidationError as e:
            elapsed_ms = (datetime.utcnow() - start_time).total_seconds() * 1000
            report.overall_verdict = VerdictLevel.INCONCLUSIVE
            report.summary = (
                "Detection models are not yet integrated. Video was uploaded and "
                "validated, but no AI analysis could be performed."
            )
            report.limitations = [f"Model error: {e.message}", "No detection models loaded"]
            report.processing_time_ms = round(elapsed_ms, 2)
            report.status = AnalysisStatus.FAILED
            report.completed_at = datetime.utcnow()
            return report

        except Exception as e:
            report.overall_verdict = VerdictLevel.INCONCLUSIVE
            report.summary = f"Video analysis failed: {e}"
            report.limitations = ["Unexpected error during video analysis"]
            report.status = AnalysisStatus.FAILED
            report.completed_at = datetime.utcnow()
            return report

    def _convert_video_result(self, video_result: VideoDetectionResult) -> DetectorResult:
        """Convert VideoDetectionResult to DetectorResult for API compatibility."""
        return DetectorResult(
            detector_name="EfficientNet-B0 + uniform frame sampling",
            detector_version="1.0",
            verdict=video_result["video_verdict"] if video_result["video_verdict"] in ["likely_authentic", "potentially_manipulated", "uncertain"] else "inconclusive",
            raw_score=video_result["confidence"] if video_result["confidence"] is not None else 0.0,
            calibrated_confidence=video_result["confidence"],
            processing_time_ms=video_result["processing_time_ms"],
            details={
                "frames_analyzed": video_result["frames_analyzed"],
                "faces_detected": video_result["faces_detected"],
                "frames_with_faces": video_result["frames_with_faces"],
                "temporal_evidence_summary": "; ".join(video_result["temporal_evidence"][:3])  # Summary of first 3 points
            },
            limitations=[
                "Frame sampling, not a dedicated video model",
                "No optical-flow / temporal-consistency analysis",
                "EfficientNet-B0 fine-tuned on FaceForensics++ C23",
                "Temporal analysis based on frame sampling consistency",
            ],
        )

    def run_audio_analysis(self, analysis_id: str, file_path: Path) -> AnalysisReport:
        """Run an audio analysis pipeline (experimental spectral heuristics)."""
        report = self._analyses.get(analysis_id)
        if not report:
            raise AnalysisError(f"Analysis {analysis_id} not found")

        start_time = datetime.utcnow()
        report.status = AnalysisStatus.PROCESSING
        report.summary = "Validating audio and computing spectral features..."

        try:
            # Get audio metadata
            metadata = get_audio_metadata(file_path)
            report.metadata = metadata
            report.summary = "Computing spectral indicators..."

            # Run audio detection
            detector_result = self._run_audio_detector(file_path)
            report.detector_results = [detector_result]

            # Determine overall verdict
            raw_score = detector_result.raw_score

            if raw_score >= 0.75:
                verdict = VerdictLevel.POTENTIALLY_MANIPULATED
                summary = (
                    "Audio spectral analysis produced synthetic-speech indicators "
                    f"(score {raw_score:.3f}). This is an experimental heuristic — "
                    "not a validated deepfake detector."
                )
            elif raw_score >= 0.40:
                verdict = VerdictLevel.UNCERTAIN
                summary = (
                    "Audio score falls in the ambiguous band. "
                    "Evidence does not support a confident conclusion."
                )
            else:
                verdict = VerdictLevel.LIKELY_AUTHENTIC
                summary = (
                    "No strong synthetic-speech indicators found. "
                    "Not proof of authenticity — this is an experimental heuristic."
                )

            indicators = [
                f"Duration: {metadata.get('duration_sec', 'unknown')}s",
                f"Sample rate: {metadata.get('sample_rate', 'unknown')} Hz",
                f"Spectral centroid: {metadata.get('spectral_centroid_hz', 'unknown')} Hz",
                f"Raw synthetic indicator score: {raw_score:.3f}",
            ]

            limitations = [
                "No dedicated audio deepfake model (e.g., RawNet2, AASIST).",
                "Experimental spectral heuristics only — not validated for detection.",
                "No speaker-verification embedding or prosody analysis.",
                "Results should be treated as weak signals only.",
            ]

            elapsed_ms = (datetime.utcnow() - start_time).total_seconds() * 1000

            report.overall_verdict = verdict
            report.summary = summary
            report.forensic_indicators = indicators
            report.limitations = limitations
            report.processing_time_ms = round(elapsed_ms, 2)
            report.status = AnalysisStatus.COMPLETED
            report.completed_at = datetime.utcnow()

            return report

        except Exception as e:
            report.overall_verdict = VerdictLevel.INCONCLUSIVE
            report.summary = f"Audio analysis failed: {e}"
            report.limitations = ["Unexpected error during audio analysis"]
            report.status = AnalysisStatus.FAILED
            report.completed_at = datetime.utcnow()
            return report

    def _run_video_detector(self, file_path: Path) -> DetectorResult:
        """Run the video detection service and return a DetectorResult."""
        video_result = self._video_service.analyze_video(str(file_path))
        return self._convert_video_result(video_result)

    def _convert_video_result(self, video_result: VideoDetectionResult) -> DetectorResult:
        """Convert VideoDetectionResult to DetectorResult for API compatibility."""
        return DetectorResult(
            detector_name="EfficientNet-B0 + uniform frame sampling",
            detector_version="1.0",
            verdict=video_result["video_verdict"] if video_result["video_verdict"] in ["likely_authentic", "potentially_manipulated", "uncertain"] else "inconclusive",
            raw_score=video_result["confidence"] if video_result["confidence"] is not None else 0.0,
            calibrated_confidence=video_result["confidence"],
            processing_time_ms=video_result["processing_time_ms"],
            details={
                "frames_analyzed": video_result["frames_analyzed"],
                "faces_detected": video_result["faces_detected"],
                "frames_with_faces": video_result["frames_with_faces"],
                "temporal_evidence_summary": "; ".join(video_result["temporal_evidence"][:3])  # Summary of first 3 points
            },
            limitations=[
                "Frame sampling, not a dedicated video model",
                "No temporal-consistency analysis",
                "EfficientNet-B0 fine-tuned on FaceForensics++ C23",
                "Temporal analysis based on frame sampling consistency",
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