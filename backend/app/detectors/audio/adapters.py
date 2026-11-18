"""Audio detection adapters for HuggingFace audio models.

Provides a unified interface for running HuggingFace audio classification
models on mono 16kHz resampled audio.
"""

from __future__ import annotations

import time
import torch
import numpy as np
from typing import Dict, Any, Optional, Tuple
from pathlib import Path

from PIL import Image
import librosa

from app.core.config import settings
from app.detectors.image.base import ImageDetectionResult


class AudioAdapter:
    """Adapter for HuggingFace audio classification models.

    Supports models like wav2vec2-based deepfake detectors that output
    a binary label: 0 = bona-fide (real), 1 = spoof (fake/AI-generated).
    """

    def __init__(self, registry_entry: Dict[str, Any]):
        self._entry = registry_entry
        self._model = None
        self._processor = None
        self._device: str = settings.MODEL_DEVICE
        self._load_error: Optional[str] = None
        self._load_attempted = False

    def load(self) -> None:
        """Load model and processor from HuggingFace Hub."""
        if self._load_attempted:
            return

        try:
            model_id = self._entry["hf_model_id"]
            # Use AutoProcessor for standard Wav2Vec2 pipelines
            from transformers import AutoProcessor

            self._processor = AutoProcessor.from_pretrained(model_id)
            from transformers import AutoModelForAudioClassification

            self._model = AutoModelForAudioClassification.from_pretrained(model_id)
            self._model.to(self._device)
            self._model.eval()
            self._load_attempted = True
        except Exception as exc:
            self._load_error = f"Audio model load failed: {exc}"
            self._load_attempted = True

    def is_available(self) -> bool:
        """Check if the model is loaded and ready."""
        if not self._load_attempted:
            self.load()
        return self._model is not None

    def _resample_mono(self, audio: np.ndarray, orig_sr: int, target_sr: int = 16000) -> np.ndarray:
        """Resample audio to target sample rate, mono channel."""
        if orig_sr == target_sr:
            # Ensure mono by taking only first channel if stereo
            if audio.ndim > 1:
                audio = audio[:, 0]
            return audio

        # Use librosa resample
        audio_mono = audio[:, 0] if audio.ndim > 1 else audio
        resampled = librosa.resample(audio_mono, orig_sr=orig_sr, target_sr=target_sr)
        return resampled

    def run_detection(self, audio_path: str) -> Dict[str, Any]:
        """Run audio deepfake detection on a WAV/MP3 file.

        Steps:
          1. Load with librosa
          2. Resample to 16kHz mono
          3. Processor -> tensors
          4. Model inference -> logits -> softmax -> probabilities
          5. Use fake_label from registry to pick "spoof" class

        Returns a dict conforming to ImageDetectionResult format with
        extra audio-specific keys appended.

        Expected keys (subset used by ImageDetectionService):
            prediction  -> "fake" | "real" | "unknown"
            confidence  -> float | None  (calibrated; None when model unavailable)
            fake_prob   -> float | None  (raw model output for spoof class)
            real_prob   -> float | None  (raw model output for bona-fide class)
            processing_time_ms  -> float
            model_available   -> bool
            model_name        -> str  (from registry entry name)
            model_version     -> str  ("1.0.0")
            device_used       -> str  ("cpu" or "cuda")
            warnings          -> list[str]
        """
        if not self.is_available():
            return {
                "prediction": "unknown",
                "confidence": None,
                "fake_prob": None,
                "real_prob": None,
                "processing_time_ms": 0.0,
                "model_available": False,
                "model_name": self._entry.get("name", "unknown_audio"),
                "model_version": "1.0.0",
                "device_used": "cpu",
                "warnings": ["Model not loaded"],
            }

        start = time.perf_counter()

        try:
            # Load audio with librosa
            y, sr = librosa.load(audio_path, sr=None, mono=False)

            # Resample to 16kHz mono
            y_16k = self._resample_mono(y, sr, target_sr=16000)

            # Prepare inputs via processor
            inputs = self._processor(
                y_16k,
                sampling_rate=16000,
                return_tensors="pt",
                padding=True,
            )
            inputs = {k: v.to(self._device) for k, v in inputs.items()}

            with torch.no_grad():
                outputs = self._model(**inputs)
                logits = outputs.logits  # shape: (1, 2) for binary

            # Softmax to probabilities
            probs = torch.softmax(logits, dim=-1).cpu().numpy()[0]  # [bona-fide, spoof]

            fake_prob = float(probs[1])  # index 1 = spoof
            real_prob = float(probs[0])  # index 0 = bona-fide

            # Use registry fake_label to determine prediction
            fake_label = self._entry.get("fake_label", 1)  # 1 = fake/spoof
            prediction = "fake" if fake_prob >= 0.5 else "real"

            elapsed_ms = (time.perf_counter() - start) * 1000.0

            return {
                "prediction": prediction,
                "confidence": round(fake_prob, 4),
                "fake_prob": round(fake_prob, 4),
                "real_prob": round(real_prob, 4),
                "processing_time_ms": round(elapsed_ms, 2),
                "model_available": True,
                "warnings": [],
            }

        except Exception as exc:
            return {
                "prediction": "unknown",
                "confidence": None,
                "fake_prob": None,
                "real_prob": None,
                "processing_time_ms": 0.0,
                "model_available": True,
                "warnings": [f"Audio detection failed: {exc}"],
            }

    def get_model_info(self) -> Dict[str, Any]:
        """Return model metadata."""
        return {
            "model_name": self._entry.get("name", "unknown"),
            "is_available": self.is_available(),
            "hf_id": self._entry.get("hf_model_id", ""),
        }