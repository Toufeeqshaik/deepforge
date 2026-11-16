"""Audio detection service — acoustic deepfake indicators via spectral analysis.

Honest approach: DeepForge does not currently run a dedicated audio
deepfake model (e.g., RawNet2, AASIST, or voice-clone detector).
Instead, audio files are analyzed for basic spectral and statistical
indicators that may suggest synthetic or manipulated speech.

These indicators are heuristic and NOT a reliable deepfake detector.
Results are explicitly flagged as experimental / research-grade.

Limitations:
- No voice-clone / TTS detection model
- No speaker-verification embedding
- No prosody / micro-tremor analysis
- Results should be treated as weak signals only
"""

from __future__ import annotations

import time
from pathlib import Path
from typing import Literal

import numpy as np

from app.core.config import settings
from app.core.exceptions import ModelNotAvailableError


class AudioDetectionService:
    """Experimental audio analysis via spectral statistics."""

    def __init__(self) -> None:
        self._device: Literal["cpu", "cuda"] = "cpu"

    def is_available(self) -> bool:
        """Audio analysis does not require a model; always available."""
        return True

    def run_detection(self, audio_path: Path) -> dict:
        """Analyze an audio file for basic spectral indicators.

        Returns a dict with:
        - label: "synthetic_indicators" or "natural_indicators"
        - raw_score: heuristic score (0-1), higher = more synthetic-like
        - calibrated_confidence: None (no calibration model)
        - processing_time_ms: total analysis time
        - details: spectral metadata
        """
        start = time.perf_counter()

        try:
            import soundfile as sf
            import librosa
        except ImportError:
            # Fall back to a minimal heuristic without audio libraries
            elapsed_ms = (time.perf_counter() - start) * 1000.0
            return {
                "label": "uncertain",
                "raw_score": 0.5,
                "calibrated_confidence": None,
                "processing_time_ms": round(elapsed_ms, 2),
                "details": {
                    "error": "librosa/soundfile not installed — audio analysis unavailable",
                    "device": self._device,
                    "method": "unavailable",
                },
            }

        try:
            y, sr = sf.read(str(audio_path))
        except Exception as exc:
            elapsed_ms = (time.perf_counter() - start) * 1000.0
            return {
                "label": "uncertain",
                "raw_score": 0.5,
                "calibrated_confidence": None,
                "processing_time_ms": round(elapsed_ms, 2),
                "details": {
                    "error": f"Could not read audio file: {exc}",
                    "device": self._device,
                    "method": "unavailable",
                },
            }

        # Convert to mono
        if y.ndim > 1:
            y = np.mean(y, axis=1)

        duration_sec = len(y) / sr

        # --- Spectral features ---
        # Spectral centroid (brightness)
        spectral_centroid = float(
            np.mean(librosa.feature.spectral_centroid(y=y, sr=sr)[0])
        )

        # Spectral bandwidth
        spectral_bandwidth = float(
            np.mean(librosa.feature.spectral_bandwidth(y=y, sr=sr)[0])
        )

        # Zero crossing rate (rough voicing indicator)
        zcr = float(np.mean(librosa.feature.zero_crossing_rate(y)[0]))

        # Spectral rolloff
        rolloff = float(np.mean(librosa.feature.spectral_rolloff(y=y, sr=sr)[0]))

        # --- Heuristic score (experimental, not validated) ---
        # Synthetic speech often has unusually smooth spectral envelopes
        # and lower high-frequency energy. This is a weak signal.
        score = 0.0

        # Very low ZCR can indicate overly smooth (synthetic) speech
        if zcr < 0.05:
            score += 0.25
        # Unusually high spectral centroid can indicate synthetic artifacts
        if spectral_centroid > 6000:
            score += 0.2
        # Narrow bandwidth can indicate synthetic smoothing
        if spectral_bandwidth < 1500:
            score += 0.2

        score = min(score, 1.0)

        label = "synthetic_indicators" if score >= 0.4 else "natural_indicators"

        elapsed_ms = (time.perf_counter() - start) * 1000.0

        return {
            "label": label,
            "raw_score": round(score, 4),
            "calibrated_confidence": None,
            "processing_time_ms": round(elapsed_ms, 2),
            "details": {
                "duration_sec": round(duration_sec, 2),
                "sample_rate": sr,
                "spectral_centroid_hz": round(spectral_centroid, 1),
                "spectral_bandwidth_hz": round(spectral_bandwidth, 1),
                "zero_crossing_rate": round(zcr, 4),
                "spectral_rolloff_hz": round(rolloff, 1),
                "device": self._device,
                "method": "experimental_spectral_heuristics",
                "architecture": "none",
            },
        }

    def classify_verdict(
        self, raw_score: float, calibrated_confidence: float | None = None
    ) -> str:
        """Map audio heuristic score to verdict enum."""
        conf = calibrated_confidence if calibrated_confidence is not None else raw_score

        if raw_score >= 0.75:
            return "potentially_manipulated"
        if raw_score >= 0.40:
            return "uncertain"
        return "likely_authentic"


# Module-level singleton
audio_detection_service = AudioDetectionService()
