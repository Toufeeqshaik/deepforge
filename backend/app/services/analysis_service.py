"""Analysis orchestration service — DeepForge backbone.

Handles image analysis requests, coordinates detection models, and
produces standardized AnalysisReport outputs. Uses an in-memory store
(initially); swap to SQLite or another DB later without changing the API.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime
from pathlib import Path
from typing import Literal, Dict, Any, Optional, List

from app.core.config import settings
from app.core.exceptions import AnalysisError, VideoValidationError, ModelNotAvailableError

logger = logging.getLogger(__name__)
from app.detectors.video.base import VideoDetectionResult
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
    get_image_metadata,
    get_video_metadata,
    get_audio_metadata,
)
from app.services.video_detection_service import video_detection_service
from app.services.audio_detection_service import AudioDetectionService

# Module-level audio detection service singleton
_audio_detection_service = AudioDetectionService()

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
            detection_service.initialize()
            if detection_service.is_available():
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
            # Initialize the module-level video detection service
            video_detection_service.initialize()
            self._video_service = video_detection_service
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

            # Run multi-model image detection
            detector_results = self._run_image_detectors(file_path)
            report.detector_results = detector_results

            # Get full detection score for ensemble judgment
            from PIL import Image
            image = Image.open(file_path)
            score = detection_service.detect(image)

            # Determine overall verdict using improved multi-model ensemble judgment
            # Get per-model results from detection service
            per_model = score.get("per_model_results", [])
            
            # Extract individual model scores and verdicts
            simlbr_aigc_score = None
            simlbr_genimage_score = None
            efficientnet_score = None
            available_models = []
            
            for mres in per_model:
                name = mres.get("model_name", "")
                conf = mres.get("confidence")
                if conf is not None:
                    available_models.append(name)
                    if "SimLBR-aigc" in name:
                        simlbr_aigc_score = conf
                    elif "SimLBR-genimage" in name:
                        simlbr_genimage_score = conf
                    elif "efficientnet" in name.lower() or "EfficientNet" in name:
                        efficientnet_score = conf
            
            # Improved ensemble logic:
            # - SimLBR models: AI-generated/manipulated image detection (AIGC & GenImage)
            # - EfficientNet-B0: Face-swap/deepfake detection (FaceForensics++)
            # Weight SimLBR models higher for general AI detection, EfficientNet for face-specific
            
            model_scores = {
                "SimLBR-aigc": simlbr_aigc_score,
                "SimLBR-genimage": simlbr_genimage_score,
                "EfficientNet-B0": efficientnet_score,
            }
            
            # Filter available scores
            available_scores = {k: v for k, v in model_scores.items() if v is not None}
            
            # Calculate weighted ensemble score
            # SimLBR models: weight 1.0 each (general AI synthesis detection)
            # EfficientNet-B0: weight 1.0 (face-swap specific)
            # Combined = average of available
            ensemble_score = None
            if available_scores:
                ensemble_score = sum(available_scores.values()) / len(available_scores)
            
            # Determine verdict using ensemble with tiered thresholds
            # Also consider model agreement/disagreement
            high_confidence_count = sum(1 for v in available_scores.values() if v > 0.7)
            low_confidence_count = sum(1 for v in available_scores.values() if v < 0.3)
            mid_confidence_count = len(available_scores) - high_confidence_count - low_confidence_count
            
            # Strong consensus thresholds
            if ensemble_score is not None:
                if ensemble_score >= 0.65 or high_confidence_count >= 2:
                    # Strong manipulation signal from multiple models
                    verdict = VerdictLevel.LIKELY_MANIPULATED
                    summary = (
                        "The image shows strong indicators of being AI-generated or "
                        "manipulated. Multi-model ensemble analysis detected synthetic "
                        "generation artifacts across multiple detectors."
                    )
                elif ensemble_score <= 0.35 or low_confidence_count >= 2:
                    # Strong authentic signal from multiple models
                    verdict = VerdictLevel.LIKELY_AUTHENTIC
                    summary = (
                        "The image shows no strong indicators of AI-generation, "
                        "face-swap, or deepfake manipulation across the active detection "
                        "ensemble. Based on this analysis, it is likely authentic."
                    )
                elif ensemble_score >= 0.5 or high_confidence_count == 1:
                    # Moderate manipulation signal
                    verdict = VerdictLevel.POTENTIALLY_MANIPULATED
                    summary = (
                        "The image shows moderate indicators of potential manipulation. "
                        "One or more models detected suspicious patterns, but confidence "
                        "is not high enough for a definitive conclusion. Manual review recommended."
                    )
                elif ensemble_score <= 0.5 and mid_confidence_count > 0:
                    # Uncertain/mixed signals
                    verdict = VerdictLevel.UNCERTAIN
                    summary = (
                        "The analysis produced mixed signals across the detector ensemble. "
                        "Evidence is insufficient to confidently determine authenticity. "
                        "Additional forensic analysis recommended."
                    )
                else:
                    verdict = VerdictLevel.INCONCLUSIVE
                    summary = "Analysis inconclusive — insufficient model agreement."
            else:
                verdict = VerdictLevel.INCONCLUSIVE
                summary = "No detection models available for analysis."

            # Build forensic indicators list
            indicators = []
            if ensemble_score is not None:
                indicators.append(
                    f"Ensemble AI probability: {ensemble_score:.0%} (from {len(available_scores)} models)"
                )
                # Show individual model contributions
                for model_name, score in available_scores.items():
                    if model_name == "SimLBR-aigc":
                        indicators.append(f"SimLBR (AIGC): {score:.0%} — AI-generated image detection")
                    elif model_name == "SimLBR-genimage":
                        indicators.append(f"SimLBR (GenImage): {score:.0%} — AI-generated image detection")
                    elif model_name == "EfficientNet-B0":
                        indicators.append(f"EfficientNet-B0: {score:.0%} — Face-swap/deepfake detection")
            for d in detector_results:
                if d.raw_score > 0.5 and d.detector_name not in available_scores:
                    indicators.append(
                        f"{d.detector_name}: {d.raw_score:.0%} synthetic probability"
                    )
            if metadata.get("dimensions"):
                indicators.append(
                    f"Image dimensions: {metadata['dimensions']}"
                )
            if metadata.get("format"):
                indicators.append(f"File format: {metadata['format']}")
            if not detection_service.is_available():
                indicators.append("No detection models loaded")

            # Build limitations list
            limitations = []
            if not detection_service.is_available():
                limitations.append(
                    "Detection models are not loaded. Results are unavailable."
                )
            else:
                model_names = [m.get("model_name", "unknown") for m in per_model if m.get("model_available")]
                if model_names:
                    limitations.append(f"Active detection ensemble: {', '.join(model_names)}.")
                limitations.append(
                    "SimLBR-aigc: Targets AI-generated images (AIGC pretrained, CVPR 2026 latent blending regularization)."
                )
                limitations.append(
                    "SimLBR-genimage: Targets AI-generated images (GenImage pretrained, may over-flag some real images)."
                )
                limitations.append(
                    "EfficientNet-B0 (FaceForensics++ C23): Targets facial manipulations & face-swaps; best on face-centric frames."
                )
                limitations.append(
                    "Ensemble score is an average of available model confidences; treat as forensic indicator, not proof."
                )
                if high_confidence_count >= 2:
                    limitations.append("High consensus: Multiple models agree on manipulation indicators.")
                elif low_confidence_count >= 2:
                    limitations.append("High consensus: Multiple models agree on authenticity indicators.")
                elif high_confidence_count == 1 and low_confidence_count == 1:
                    limitations.append("Model disagreement: One model flags manipulation, another indicates authentic.")

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

    def _run_image_detectors(self, file_path: Path) -> list[DetectorResult]:
        """Run all active detection models on the image and return a DetectorResult per model."""
        from PIL import Image

        image = Image.open(file_path)
        score = detection_service.detect(image)

        combined_score = score["combined_score"]
        combined_verdict = score["combined_verdict"]
        model_count = score["model_count"]

        per_model = score.get("per_model_results", [])
        detector_results: list[DetectorResult] = []

        model_limitations_map = {
            "SimLBR-aigc": [
                "SimLBR (CVPR 2026) AIGC-pretrained detector using latent blending regularization.",
                "Targets AI-generated image signals; performance varies by generator/domain.",
                "Score is a model confidence indicator, not legal proof.",
            ],
            "SimLBR-genimage": [
                "SimLBR (CVPR 2026) GenImage-pretrained detector using latent blending regularization.",
                "Targets AI-generated image signals; may over-flag some real images as uncertain.",
                "Score is a model confidence indicator, not legal proof.",
            ],
            "Xicor9/efficientnet-b0-ffpp-c23": [
                "Trained on FaceForensics++ C23 for facial manipulation & face-swaps",
                "Frame-level AUC: 0.933, Video-level AUC: 0.94+",
                "Works best on face-centric frames; general scene manipulation detection is limited",
            ],
            "abacusai/Smaug-AI-Image-Detector": [
                "439M-parameter vision fine-tune of EmbeddingGemma-2 by Abacus.AI",
                "Specialized in detecting generative AI images (DALL-E, Midjourney, Stable Diffusion, FLUX)",
                "Full resolution multi-crop feature encoding",
            ],
            "Fallback": [
                "No detection models available; operating in degraded mode",
            ],
        }

        for mres in per_model:
            name = mres.get("model_name", "unknown")
            conf = mres.get("confidence")
            pred = mres.get("prediction", "uncertain")

            if conf is not None:
                m_verdict = (
                    VerdictLevel.LIKELY_MANIPULATED
                    if conf > 0.65
                    else VerdictLevel.LIKELY_AUTHENTIC
                    if conf < 0.35
                    else VerdictLevel.UNCERTAIN
                )
            else:
                m_verdict = VerdictLevel.INCONCLUSIVE

            limitations = model_limitations_map.get(
                name,
                [
                    "Multi-model ensemble member",
                    f"Combined score: {combined_score:.2f}" if combined_score is not None else "Inconclusive",
                ],
            )

            detector_results.append(
                DetectorResult(
                    detector_name=name,
                    detector_version=mres.get("model_version", "v1.0"),
                    verdict=m_verdict,
                    raw_score=conf if conf is not None else 0.0,
                    calibrated_confidence=conf,
                    processing_time_ms=mres.get("processing_time_ms", 0.0),
                    details={
                        "prediction": pred,
                        "model_available": mres.get("model_available", False),
                        "device_used": mres.get("device_used", "cpu"),
                        "combined_score": combined_score,
                        "combined_verdict": combined_verdict,
                        "model_count": model_count,
                        "heatmap_available": mres.get("heatmap_available", False),
                    },
                    limitations=limitations,
                )
            )

        if not detector_results:
            detector_results.append(
                DetectorResult(
                    detector_name="fallback",
                    detector_version="v1.0",
                    verdict=VerdictLevel.INCONCLUSIVE,
                    raw_score=0.0,
                    calibrated_confidence=None,
                    processing_time_ms=0.0,
                    details={"model_count": 0, "combined_verdict": "inconclusive"},
                    limitations=["No models available"],
                )
            )

        return detector_results

    def _run_single_detector(self, file_path: Path) -> DetectorResult:
        """Backward-compatible helper returning the primary detector result."""
        results = self._run_image_detectors(file_path)
        return results[0]

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

            # Run video detection using the video detection service
            video_result = self._video_service.analyze_video(str(file_path))
            report.detector_results = [self._convert_video_result(video_result)]
            
            # Update forensic indicators from video result
            report.forensic_indicators.extend(video_result.get("temporal_evidence", []))
            if video_result.get("error_details"):
                report.limitations.append(f"Video analysis error: {video_result['error_details']}")
                
            # Update report metadata and timing
            report.processing_time_ms = video_result.get("processing_time_ms", 0.0)
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

    def _run_audio_detector(self, file_path: Path) -> DetectorResult:
        """Run the audio detection service and return a DetectorResult."""
        audio_result = _audio_detection_service.run_detection(str(file_path))
        
        prediction = audio_result.get("prediction", "unknown")
        confidence = audio_result.get("confidence")
        fake_prob = audio_result.get("fake_prob")
        real_prob = audio_result.get("real_prob")
        processing_time_ms = audio_result.get("processing_time_ms", 0.0)
        model_available = audio_result.get("model_available", False)
        warnings = audio_result.get("warnings", [])
        
        # Use fake_prob as raw_score
        raw_score = fake_prob if fake_prob is not None else 0.0
        calibrated_confidence = confidence
        
        # Determine verdict based on score
        if raw_score >= 0.75:
            verdict = "potentially_manipulated"
        elif raw_score >= 0.40:
            verdict = "uncertain"
        else:
            verdict = "likely_authentic"
        
        return DetectorResult(
            detector_name="wav2vec2-base (abhishtagatya/wav2vec2-base-960h-itw-deepfake)",
            detector_version="1.0",
            verdict=verdict,
            raw_score=raw_score,
            calibrated_confidence=calibrated_confidence,
            processing_time_ms=processing_time_ms,
            details={
                "prediction": prediction,
                "fake_prob": fake_prob,
                "real_prob": real_prob,
                "model_available": model_available,
                "device_used": _audio_detection_service._device,
            },
            limitations=warnings + [
                "No dedicated audio deepfake model (e.g., RawNet2, AASIST).",
                "Experimental spectral heuristics only — not validated for detection.",
                "No speaker-verification embedding or prosody analysis.",
                "Results should be treated as weak signals only.",
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