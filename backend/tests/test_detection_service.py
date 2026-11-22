"""Tests for the image detection service and its probability semantics.

The service exposes an aggregated result from detect():

    {
        "per_model_results": [...],   # one entry per registered detector
        "combined_score": float|None, # average *fake probability* across active models
        "combined_verdict": str,      # REAL < 0.35 | UNCERTAIN 0.35-0.65 | FAKE > 0.65
        "model_count": int,           # number of models that produced a genuine score
    }

These tests verify the data contract AND the correctness of the probability
values (range [0, 1], threshold mapping, and honesty when no model is loaded).
"""

import io

import pytest
from PIL import Image

from app.services.detection_service import detection_service


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_image(color=(255, 0, 0)):
    """Create a deterministic solid-colour RGB image."""
    return Image.new("RGB", (224, 224), color=color)


# ---------------------------------------------------------------------------
# Result-shape tests
# ---------------------------------------------------------------------------

def test_valid_image_detection():
    """detect() returns the aggregated structure with a valid verdict."""
    result = detection_service.detect(make_image())

    assert result["combined_verdict"] in (
        "likely_authentic", "uncertain",
        "potentially_manipulated", "likely_manipulated", "inconclusive",
    )
    assert "processing_time_ms" in str(result) or "per_model_results" in result

    # At least one per-model result, with the standard keys
    per_model = result["per_model_results"]
    assert len(per_model) > 0
    first = per_model[0]
    for field in (
        "prediction", "confidence", "model_name", "model_version",
        "processing_time_ms", "device_used", "model_available", "warnings",
    ):
        assert field in first, f"Missing per-model field: {field}"


def test_invalid_image_format():
    """Non-PIL input must be rejected loudly instead of yielding a fake result."""
    fake_file = io.BytesIO(b"not an image")
    with pytest.raises((TypeError, ValueError, AttributeError)):
        detection_service.detect(fake_file)


def test_detection_result_structure():
    """The four top-level aggregation keys must always be present."""
    result = detection_service.detect(make_image(color=(0, 0, 255)))

    required_fields = [
        "per_model_results", "combined_score", "combined_verdict", "model_count",
    ]
    for field in required_fields:
        assert field in result, f"Missing field: {field}"

    assert isinstance(result["per_model_results"], list)
    assert isinstance(result["model_count"], int)
    assert result["model_count"] >= 0


def test_model_info():
    """Model info is returned correctly, including the backward-compatible alias."""
    info = detection_service.get_model_info()
    assert "models_available" in info
    assert isinstance(info["models_available"], dict)
    assert "models" in info
    assert isinstance(info["models"], dict)
    assert info["models"] == info["models_available"]


# ---------------------------------------------------------------------------
# Probability-specific tests
# ---------------------------------------------------------------------------

def test_combined_score_range_when_model_available():
    """A genuine combined_score must be a probability in [0, 1]."""
    detection_service.initialize()
    result = detection_service.detect(make_image())

    if result["model_count"] > 0:
        score = result["combined_score"]
        assert isinstance(score, float), f"Expected float, got {type(score)}"
        assert 0.0 <= score <= 1.0, f"Probability out of range: {score}"
    else:
        # Honesty: no active model means no fabricated score.
        assert result["combined_score"] is None


def test_per_model_confidence_range():
    """Every available model must report a confidence probability in [0, 1]."""
    result = detection_service.detect(make_image(color=(100, 149, 237)))

    for mres in result["per_model_results"]:
        if mres.get("model_available") and mres.get("confidence") is not None:
            confidence = mres["confidence"]
            assert isinstance(confidence, float)
            assert 0.0 <= confidence <= 1.0, (
                f"{mres['model_name']} confidence out of range: {confidence}"
            )


def test_combined_verdict_matches_score_thresholds():
    """combined_verdict must agree with the combined_score threshold bands."""
    result = detection_service.detect(make_image())
    score = result["combined_score"]
    verdict = result["combined_verdict"]

    if score is None:
        assert verdict == "inconclusive"
    elif score < 0.35:
        assert verdict == "likely_authentic"
    elif score <= 0.65:
        assert verdict == "uncertain"
    else:
        assert verdict in ("likely_manipulated", "potentially_manipulated")


def test_classify_verdict_threshold_boundaries():
    """classify_verdict maps the score bands to the correct verdict labels."""
    assert detection_service.classify_verdict(0.10) == "likely_authentic"
    assert detection_service.classify_verdict(0.3499) == "likely_authentic"
    assert detection_service.classify_verdict(0.35) == "uncertain"
    assert detection_service.classify_verdict(0.50) == "uncertain"
    assert detection_service.classify_verdict(0.65) == "uncertain"
    assert detection_service.classify_verdict(0.6501) == "likely_manipulated"
    assert detection_service.classify_verdict(0.95) == "likely_manipulated"


def test_combined_score_is_mean_of_model_scores():
    """combined_score must equal the mean of the available models' confidences."""
    result = detection_service.detect(make_image())

    available_scores = [
        m["confidence"]
        for m in result["per_model_results"]
        if m.get("model_available") and m.get("confidence") is not None
    ]
    assert result["model_count"] == len(available_scores)

    if available_scores:
        expected = round(sum(available_scores) / len(available_scores), 4)
        assert result["combined_score"] == pytest.approx(expected, abs=1e-4)
    else:
        assert result["combined_score"] is None


def test_missing_checkpoint_uses_fallback_without_crash():
    """The fallback detector is always available (honest degraded behaviour)."""
    from app.detectors.image.fallback import FallbackImageDetector

    fallback = FallbackImageDetector()
    assert fallback.is_available()
    result = fallback.run_detection(make_image())
    # Fallback must not fabricate a confidence probability.
    assert result["confidence"] is None
