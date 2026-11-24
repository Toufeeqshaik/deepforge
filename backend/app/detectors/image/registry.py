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
        # SimLBR — Latent Blending Regularization (CVPR 2026)
        # Source: https://github.com/mvrl/SimLBR
        # Detects: AI-generated images (AIGC / GenImage pretrained variants)
        # ----------------------------------------------------------------
        "name": "SimLBR-aigc",
        "hf_model_id": None,
        "enabled": True,
        "pretrained": "aigc",
        "targets": [
            "AI-Generated",
            "AIGC",
            "Diffusion",
            "GAN",
        ],
        "preprocessing": {
            "resize": (256, 256),
            "normalize": "dinov3",
        },
        "fake_label": 1,
        "loader": "simlbr",
    },
    {
        "name": "SimLBR-genimage",
        "hf_model_id": None,
        "enabled": True,
        "pretrained": "genimage",
        "targets": [
            "AI-Generated",
            "GenImage",
            "Diffusion",
            "GAN",
        ],
        "preprocessing": {
            "resize": (256, 256),
            "normalize": "dinov3",
        },
        "fake_label": 1,
        "loader": "simlbr",
    },
    {
        # ----------------------------------------------------------------
        # EfficientNet-B0 fine-tuned on FaceForensics++ C23
        # Source: https://huggingface.co/Xicor9/efficientnet-b0-ffpp-c23
        # Detects: face-swap deepfakes (video-origin manipulations)
        # ----------------------------------------------------------------
        "name": "Xicor9/efficientnet-b0-ffpp-c23",
        "hf_model_id": "Xicor9/efficientnet-b0-ffpp-c23",
        "enabled": True,
        "targets": [
            "DeepFake",       # deep-learning face swap
            "FaceSwap",       # automated face replacement
            "Face2Face",      # facial reenactment
            "NeuralTextures", # texture-level manipulation
        ],
        "preprocessing": {
            "resize": (224, 224),
            "normalize": False,
        },
        "fake_label": 1,
        "loader": "community_forensics",
    },
    {
        # ----------------------------------------------------------------
        # Smaug AI Image Detector — EmbeddingGemma-2 + linear classifier (439M)
        # Source: https://huggingface.co/abacusai/Smaug-AI-Image-Detector
        # Detects: AI-generated images (DALL·E, Midjourney, Stable Diffusion, FLUX)
        # ----------------------------------------------------------------
        "name": "abacusai/Smaug-AI-Image-Detector",
        "hf_model_id": "abacusai/Smaug-AI-Image-Detector",
        "enabled": False,
        "targets": [
            "AI-Generated",
            "Midjourney",
            "DALL·E",
            "Stable Diffusion",
            "FLUX",
            "Generative AI",
        ],
        "preprocessing": {
            "shorter_edge": 576,
            "crop_size": (528, 528),
            "crops": 1,
        },
        "fake_label": 1,
        "loader": "smaug_detector",
    },
    {
        # ----------------------------------------------------------------
        # Imager-1-Pro — ConvNeXt-Base AI-generated image detector
        # Source: https://huggingface.co/Imagers/imager-1-pro
        # Detects: AI-generated images (DALL·E 3, Midjourney v6, SDXL, SD3)
        # Note: Disabled by default unless local weights are provided
        # ----------------------------------------------------------------
        "name": "Imagers/imager-1-pro",
        "hf_model_id": "Imagers/imager-1-pro",
        "enabled": False,
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
]


def get_model_entry(name: str) -> dict[str, Any] | None:
    """Return the registry entry for *name*, or None if not found."""
    for entry in MODEL_REGISTRY:
        if entry["name"] == name:
            return entry
    return None
