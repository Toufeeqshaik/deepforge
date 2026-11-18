"""Model registry for audio deepfake detectors.

Add a new entry here to make a new audio model available to the detection service.
Nothing else needs to change — the service iterates this list at startup.

Each entry describes:
  name          Human-readable identifier used in API responses.
  hf_model_id   Hugging Face model repo (owner/repo).
  targets       List of manipulation types this model was trained to detect.
  preprocessing Dict describing the expected input format.
  fake_label    Which output index (int) the model uses to signal that audio
                is fake.  The runner checks this to turn raw logits into a
                "real / fake" decision.
  loader        Key that tells the service which adapter class to use.
"""

from __future__ import annotations

from typing import Any

# ---------------------------------------------------------------------------
# Registry — a plain list of dicts, one per model
# ---------------------------------------------------------------------------

MODEL_REGISTRY: list[dict[str, Any]] = [
    {
        # ----------------------------------------------------------------
        # wav2vec2-base-960h-itw-deepfake
        # Source: https://huggingface.co/abhishtagatya/wav2vec2-base-960h-itw-deepfake
        # Detects: synthetic speech vs bona-fide speech
        #   Labels: 0 = bona-fide (real), 1 = spoof (fake/AI-generated)
        # ----------------------------------------------------------------
        "name": "abhishtagatya/wav2vec2-base-960h-itw-deepfake",
        "hf_model_id": "abhishtagatya/wav2vec2-base-960h-itw-deepfake",
        "targets": [
            "synthetic_speech",
        ],
        "preprocessing": {
            "sample_rate": 16000,
            "channels": 1,
            "duration_sec": 10.0,
        },
        "fake_label": 1,  # index 1 = spoof class
        "loader": "transformers_audio",
    },
]


def get_model_entry(name: str) -> dict[str, Any] | None:
    """Return the registry entry for *name*, or None if not found."""
    for entry in MODEL_REGISTRY:
        if entry["name"] == name:
            return entry
    return None