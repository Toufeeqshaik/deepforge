"""Model registry for image deepfake detectors.

Add a new entry here to make a new model available to the detection service.
Nothing else needs to change — the service iterates this list at startup.

Each entry describes:
  name          Human-readable identifier used in API responses.
  hf_model_id   Hugging Face model repo (owner/repo).  Set to None for
                models loaded from a local checkpoint only.
  targets       List of manipulation types this model was trained to detect.
  preprocessing Dict describing the expected input format so callers know
                what transforms to apply before passing tensors to the model.
  fake_label    Which output index (int) or label (str) the model uses to
                signal that an image is fake.  The runner checks this to
                turn raw logits into a "real / fake" decision.
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
        # EfficientNet-B0 fine-tuned on FaceForensics++ C23
        # Source: https://huggingface.co/Xicor9/efficientnet-b0-ffpp-c23
        # Detects: face-swap deepfakes (video-origin manipulations)
        # ----------------------------------------------------------------
        "name": "Xicor9/efficientnet-b0-ffpp-c23",
        "hf_model_id": "Xicor9/efficientnet-b0-ffpp-c23",
        "targets": [
            "DeepFake",       # deep-learning face swap
            "FaceSwap",       # automated face replacement
            "Face2Face",      # facial reenactment
            "NeuralTextures", # texture-level manipulation
        ],
        "preprocessing": {
            "resize": (224, 224),
            "mean": [0.485, 0.456, 0.406],
            "std":  [0.229, 0.224, 0.225],
        },
        "fake_label": 1,
        "loader": "community_forensics",
    },
    {
        # ----------------------------------------------------------------
        # Imager-1-Pro — ConvNeXt-Base AI-generated image detector
        # Source: https://huggingface.co/Imagers/imager-1-pro
        # Detects: AI-generated images (DALL·E 3, Midjourney v6, SDXL, SD3)
        # ----------------------------------------------------------------
        "name": "Imagers/imager-1-pro",
        "hf_model_id": "Imagers/imager-1-pro",
        "targets": [
            "DALL·E 3",
            "Midjourney v6",
            "SDXL",
            "Stable Diffusion 3",
        ],
        "preprocessing": {
            "resize_shortest_edge": 256,
            "crop_size": (224, 224),
            "mean": [0.485, 0.456, 0.406],
            "std":  [0.229, 0.224, 0.225],
        },
        "fake_label": 1,
        "loader": "transformers_convnext",
    },
    {
        # ----------------------------------------------------------------
        # Audio Deepfake Detector — wav2vec2-based classifier
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
