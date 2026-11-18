"""Video detection service — temporal deepfake detection via frame sampling.

Honest approach: DeepForge does not currently run a dedicated video
deepfake model. Instead, video files are sampled at uniform intervals
and each frame is run through the EfficientNet-B0 face-swap detector.
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

    def is_available(self) -> bool:
        """Video detection is available iff the image detector is loaded."""
        return detection_service.is_available

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
        if not detection_service.is_available:
            raise ModelNotAvailableError(
                detection_service.load_error or "image detection model not loaded"
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

                result = detection_service.run_detection(pil_image)
                frame_results.append(
                    {
                        "frame_index": int(idx),
                        "label": result["label"],
                        "raw_score": result["raw_score"],
                        "calibrated_confidence": result.get("calibrated_confidence"),
                    }
                )
                fake_probs.append(result["raw_score"])
                if result.get("calibrated_confidence") is not None:
                    calibrated_confs.append(result["calibrated_confidence"])

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
                "model": "Xicor9/efficientnet-b0-ffpp-c23",
                "method": "uniform_frame_sampling",
                "architecture": "EfficientNet-B0",
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

        Convenience wrapper around run_detection that returns a dict compatible
        with the analysis service's expectations.

        Returns a dict with keys:
            label, raw_score, calibrated_confidence, processing_time_ms,
            frames_analyzed, frame_results, details
        """
        return self.run_detection(video_path)


# Module-level singleton
video_detection_service = VideoDetectionService()
