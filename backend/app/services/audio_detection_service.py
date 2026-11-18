"""Audio detection service — HuggingFace wav2vec2-based deepfake detection.

Honest approach: DeepForge uses a HuggingFace audio model (abhishtagatya/
wav2vec2-base-960h-itw-deepfake) for binary deepfake classification:
0 = bona-fide (real), 1 = spoof (fake/AI-generated).

The model is loaded lazily; if unavailable the service returns honest
None confidence rather than fabricating scores.
"""

from __future__ import annotations

import time
from pathlib import Path
from typing import Dict, Any, Optional

import torch
import numpy as np
import librosa

from app.core.config import settings
from app.core.exceptions import ModelNotAvailableError
from app.detectors.audio.adapters import AudioAdapter

# Audio model from HuggingFace Hub
AUDIO_MODEL_ID = "abhishtagatya/wav2vec2-base-960h-itw-deepfake"

# Module-level singleton — one adapter per registry entry
_audio_adapter: Optional[AudioAdapter] = None


def get_audio_adapter() -> AudioAdapter:
    """Lazy singleton getter for the audio adapter."""
    global _audio_adapter
    if _audio_adapter is None:
        from app.detectors.audio.registry import get_model_entry

        entry = get_model_entry("abhishtagatya/wav2vec2-base-960h-itw-deepfake")
        _audio_adapter = AudioAdapter(entry or {})
        _audio_adapter.load()
    return _audio_adapter


class AudioDetectionService:
    """Audio deepfake detection via HuggingFace wav2vec2 model."""

    def __init__(self) -> None:
        self._device: str = settings.MODEL_DEVICE

    def is_available(self) -> bool:
        """Check if the audio model is loaded and ready."""
        adapter = get_audio_adapter()
        return adapter is not None and adapter.is_available()

    def run_detection(self, audio_path: str) -> Dict[str, Any]:
        """Run audio deepfake detection on a WAV/MP3 file.

        Steps:
          1. Load with librosa
          2. Resample to 16kHz mono
          3. Processor -> tensors
          4. Model inference -> logits -> softmax -> probabilities
          5. Use fake_label from registry to pick "spoof" class

        Returns a dict with:
            prediction: "fake" or "real"
            confidence: float 0-1 ( calibrated — fake prob for the fake class )
            fake_prob: float 0-1 ( raw model output for spoof/spoof class )
            real_prob: float 0-1 ( raw model output for bona-fide class )
            processing_time_ms: float
            model_available: bool
            warnings: list[str]
        """
        start = time.perf_counter()

        try:
            adapter = get_audio_adapter()

            if not adapter.is_available():
                elapsed_ms = (time.perf_counter() - start) * 1000.0
                return {
                    "prediction": "unknown",
                    "confidence": None,
                    "fake_prob": None,
                    "real_prob": None,
                    "processing_time_ms": round(elapsed_ms, 2),
                    "model_available": False,
                    "warnings": ["Audio model not loaded"],
                }

            result = adapter.run_detection(audio_path)

            # Ensure timing field is always present
            result["processing_time_ms"] = round(
                (time.perf_counter() - start) * 1000.0, 2
            )

            # Ensure model_available is set
            if result.get("model_available") is None:
                result["model_available"] = False

            return result

        except Exception as exc:
            elapsed_ms = (time.perf_counter() - start) * 1000.0
            return {
                "prediction": "unknown",
                "confidence": None,
                "fake_prob": None,
                "real_prob": None,
                "processing_time_ms": round(elapsed_ms, 2),
                "model_available": False,
                "warnings": [f"Audio detection failed: {exc}"],
            }

    def get_model_info(self) -> Dict[str, Any]:
        """Return audio model metadata."""
        adapter = get_audio_adapter()
        if adapter is None:
            return {
                "model_name": "Audio Deepfake Detector",
                "is_available": False,
                "hf_id": AUDIO_MODEL_ID,
            }
        return adapter.get_model_info()