"""Video detection service — temporal deepfake detection via frame sampling.

Honest approach: DeepForge does not currently run a dedicated video
deepfake model. Instead, video files are sampled at uniform intervals
and each sampled frame is analyzed by the configured image detection service.
Results are aggregated (max, mean, count of frames above threshold) so
the user gets a temporal signal without fabricating a dedicated video
model.

Limitations:
- No optical-flow / temporal-consistency model
- No audio-visual fusion
- Results are frame-level inferences aggregated over sampled frames
"""

from __future__ import annotations

import time
from pathlib import Path
from typing import Literal

import cv2
import numpy as np
from PIL import Image

from app.core.config import settings
from app.core.exceptions import ModelNotAvailableError
from app.services.detection_service import detection_service


class VideoDetectionService:
    """Temporal video detection via uniform frame sampling."""

    def __init__(self) -> None:
        self._device: Literal["cpu", "cuda"] = settings.MODEL_DEVICE  # type: ignore[assignment]

    def initialize(self) -> None:
        """Initialize the video detection service (no-op, image detector loaded separately)."""
        pass

    def is_available(self) -> bool:
        """Video detection is available iff the image detector is loaded."""
        return detection_service.is_available()

    def run_detection(self, video_path: Path) -> dict:
        """Sample frames from a video and run face-swap detection on each.

        Returns a dict with:
        - label: "fake" if any sampled frame is classified fake
        - raw_score: max fake probability across sampled frames
        - calibrated_confidence: mean calibrated confidence across frames
        - processing_time_ms: total inference time
        - frames_analyzed: number of frames actually sampled
        - frame_results: per-frame detection details
        - details: aggregation metadata
        """
        if not detection_service.is_available():
            raise ModelNotAvailableError(
                getattr(detection_service, '_load_error', None) or "image detection model not loaded"
            )

        start = time.perf_counter()

        cap = cv2.VideoCapture(str(video_path))
        if not cap.isOpened():
            raise ValueError("Could not open video file")

        try:
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            fps = cap.get(cv2.CAP_PROP_FPS) or 0.0
            duration_sec = (total_frames / fps) if fps > 0 else 0.0

            # Uniformly sample up to VIDEO_FRAME_SAMPLE_COUNT frames
            sample_count = min(settings.VIDEO_FRAME_SAMPLE_COUNT, max(total_frames, 1))
            frame_indices = (
                np.linspace(0, total_frames - 1, sample_count).astype(int)
                if total_frames > 0
                else np.array([0])
            )

            frame_results = []
            fake_probs = []
            calibrated_confs = []

            for idx in frame_indices:
                cap.set(cv2.CAP_PROP_POS_FRAMES, int(idx))
                ret, frame = cap.read()
                if not ret:
                    continue

                # BGR -> RGB -> PIL
                frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                pil_image = Image.fromarray(frame_rgb)

                result = detection_service.detect(pil_image)
                
                # Extract frame-level info from per_model_results
                per_model = result.get("per_model_results", [])
                frame_conf = 0.0
                frame_pred = "unknown"
                if per_model:
                    # Use the first available model's result
                    for mres in per_model:
                        if mres.get("model_available") and mres.get("confidence") is not None:
                            frame_conf = mres["confidence"]
                            frame_pred = mres.get("prediction", "unknown")
                            break
                
                frame_results.append(
                    {
                        "frame_index": int(idx),
                        "label": "fake" if frame_conf >= 0.5 else "real",
                        "raw_score": round(frame_conf, 4),
                        "calibrated_confidence": round(frame_conf, 4) if frame_conf > 0 else None,
                    }
                )
                fake_probs.append(frame_conf)
                if frame_conf > 0:
                    calibrated_confs.append(frame_conf)

        finally:
            cap.release()

        elapsed_ms = (time.perf_counter() - start) * 1000.0

        max_fake_prob = max(fake_probs) if fake_probs else 0.0
        mean_calibrated = (
            float(np.mean(calibrated_confs)) if calibrated_confs else None
        )

        # Label: fake if any frame exceeds 0.5
        label = "fake" if max_fake_prob >= 0.5 else "real"

        return {
            "label": label,
            "raw_score": round(max_fake_prob, 4),
            "calibrated_confidence": round(mean_calibrated, 4)
            if mean_calibrated is not None
            else None,
            "processing_time_ms": round(elapsed_ms, 2),
            "frames_analyzed": len(frame_results),
            "frame_results": frame_results,
            "details": {
                "total_frames": total_frames,
                "fps": round(fps, 2),
                "duration_sec": round(duration_sec, 2),
                "sample_count": sample_count,
                "device": self._device,
                "model": "configured-image-detector-ensemble",
                "method": "uniform_frame_sampling",
                "architecture": "SimLBR/ensemble (via image detection service)",
            },
        }

    def classify_verdict(
        self, raw_score: float, calibrated_confidence: float | None = None
    ) -> str:
        """Map aggregated video score to verdict enum."""
        conf = calibrated_confidence if calibrated_confidence is not None else raw_score

        if raw_score >= 0.85 and (conf is None or conf >= 0.85):
            return "likely_manipulated"
        if raw_score >= 0.70 and (conf is None or conf >= 0.70):
            return "potentially_manipulated"
        if raw_score >= 0.40 or (conf is not None and conf >= 0.40):
            return "uncertain"
        return "likely_authentic"

    def analyze_video(self, video_path: str) -> dict:
        """Analyze a video file by sampling frames and running face-swap detection.

        Returns a dict compatible with the analysis service's VideoDetectionResult expectations.
        """
        detection_result = self.run_detection(Path(video_path))
        
        # Compute aggregated verdict and confidence
        frame_results = detection_result.get("frame_results", [])
        frames_analyzed = len(frame_results)
        
        # Extract fake probabilities from frame results
        fake_probs = [fr.get("raw_score", 0.0) for fr in frame_results]
        max_fake_prob = max(fake_probs) if fake_probs else 0.0
        mean_fake_prob = sum(fake_probs) / len(fake_probs) if fake_probs else 0.0
        
        # Calibrated confidence (mean of calibrated confidences, or mean of raw if None)
        calibrated_confs = [fr.get("calibrated_confidence") for fr in frame_results if fr.get("calibrated_confidence") is not None]
        mean_calibrated = sum(calibrated_confs) / len(calibrated_confs) if calibrated_confs else mean_fake_prob
        
        # Determine video-level verdict
        video_verdict = self.classify_verdict(max_fake_prob, mean_calibrated)
        
        # Build temporal evidence
        temporal_evidence = []
        if frames_analyzed > 0:
            temporal_evidence.append(f"Analyzed {frames_analyzed} sampled frames")
            if max_fake_prob >= 0.5:
                temporal_evidence.append(f"Max frame fake probability: {max_fake_prob:.2f}")
            else:
                temporal_evidence.append(f"Max frame fake probability: {max_fake_prob:.2f} (below 0.5 threshold)")
        
        return {
            "status": "completed",
            "video_verdict": video_verdict,
            "confidence": round(mean_calibrated, 4) if mean_calibrated is not None else None,
            "model_name": "Image detector ensemble + uniform frame sampling",
            "model_version": "1.0",
            "processing_time_ms": detection_result.get("processing_time_ms", 0.0),
            "device_used": detection_result.get("details", {}).get("device", "cpu"),
            "video_metadata": detection_result.get("details", {}),
            "frames_analyzed": frames_analyzed,
            "faces_detected": 0,  # Not tracking faces in this version
            "frames_with_faces": 0,
            "frame_level_results": frame_results,
            "temporal_evidence": temporal_evidence,
            "warnings": [],
            "error_details": None,
        }


# Module-level singleton
video_detection_service = VideoDetectionService()
