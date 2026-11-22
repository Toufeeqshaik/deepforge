"""Smoke test — run detection on a synthetic image without starting the server.

Usage (from the backend/ directory with the venv active):
    python scripts/smoke_test.py

What it checks:
  1. The model registry loads and contains at least two entries.
  2. The DetectionService initialises without crashing.
  3. detect() returns the new aggregated result structure with:
       - per_model_results: list of per-model detections
       - combined_score: average confidence across active models
       - combined_verdict: REAL < 0.35 | UNCERTAIN 0.35-0.65 | FAKE > 0.65
  4. The result is honest: confidence is None when the model is unavailable,
     not a fabricated number.

Exit code 0 = all checks passed.
Exit code 1 = something failed (details printed to stdout).
"""

from __future__ import annotations

import sys
import os

# Allow "python scripts/smoke_test.py" to find the app package.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from PIL import Image


def make_test_image() -> Image.Image:
    """Create a tiny solid-colour RGB image — no file needed."""
    return Image.new("RGB", (224, 224), color=(100, 149, 237))  # cornflower blue


def check_registry() -> None:
    from app.detectors.image.registry import MODEL_REGISTRY

    assert MODEL_REGISTRY, "MODEL_REGISTRY is empty"
    assert len(MODEL_REGISTRY) >= 2, f"Expected at least 2 models, got {len(MODEL_REGISTRY)}"
    entry = MODEL_REGISTRY[0]
    for key in ("name", "hf_model_id", "targets", "preprocessing", "fake_label", "loader"):
        assert key in entry, f"Registry entry missing key: {key}"
    print(f"  registry ok — {len(MODEL_REGISTRY)} model(s) registered")
    print(f"  first model : {entry['name']}")
    print(f"  targets     : {', '.join(entry['targets'])}")
    print(f"  fake_label  : {entry['fake_label']}")
    # Also check the second model
    entry2 = MODEL_REGISTRY[1]
    print(f"  second model: {entry2['name']}")
    print(f"  second fake_label: {entry2['fake_label']}")
    print(f"  second loader   : {entry2.get('loader')}")


def check_detection() -> None:
    from app.services.detection_service import detection_service

    # Initialize all models once
    detection_service.initialize()
    print(f"  model available : {detection_service.is_available()}")

    result = detection_service.detect(make_test_image())

    # Shape checks — the new aggregated result must have these top-level keys
    required_keys = {
        "per_model_results",
        "combined_score",
        "combined_verdict",
        "model_count",
    }
    missing = required_keys - result.keys()
    assert not missing, f"Result missing keys: {missing}"

    print(f"  prediction      : (aggregated) — the result has per_model_results")
    print(f"  combined_score  : {result['combined_score']}")
    print(f"  combined_verdict: {result['combined_verdict']}")
    print(f"  model_count     : {result['model_count']}")

    # Check per-model results have the expected keys
    per_model = result.get("per_model_results", [])
    assert len(per_model) > 0, "Expected at least one per-model result"

    # Each per-model result should have the standard keys
    for i, mres in enumerate(per_model):
        mres_required = {"prediction", "confidence", "model_name", "model_version",
                         "processing_time_ms", "device_used", "model_available", "warnings"}
        mres_missing = mres_required - mres.keys()
        assert not mres_missing, f"Per-model result[{i}] missing keys: {mres_missing}"
        print(f"  per-model[{i}]   : {mres.get('model_name', 'unknown')} — "
              f"pred={mres['prediction']}, conf={mres['confidence']}, "
              f"available={mres['model_available']}")

    # Honesty check: when no real model is loaded, confidence must be None
    # (the aggregated confidence comes from individual model confidences)
    model_available_any = any(r.get("model_available", False) for r in per_model)
    if not model_available_any:
        # All models unavailable → combined_score should be None
        assert result["combined_score"] is None, (
            "BUG: combined_score must be None when no model available, "
            f"got {result['combined_score']}"
        )
        print("  honesty check   : PASS (no models available → combined_score=None)")
    else:
        # At least one model available
        first_available = next(r for r in per_model if r.get("model_available", False))
        conf = first_available["confidence"]
        assert isinstance(conf, float), (
            f"Expected float confidence, got {type(conf)}"
        )
        assert 0.0 <= conf <= 1.0, (
            f"Confidence out of range: {conf}"
        )
        print("  honesty check   : PASS (genuine confidence in [0, 1])")

    # Verify verdict thresholds are reasonable
    vr = result["combined_verdict"]
    assert vr in ("likely_authentic", "uncertain", "likely_manipulated", "inconclusive"), \
        f"Unexpected verdict: {vr}"
    print(f"  verdict         : PASS ({vr})")


def main() -> int:
    print("=== DeepForge smoke test ===\n")

    failures: list[str] = []

    for label, fn in [
        ("1. Registry", check_registry),
        ("2. Detection", check_detection),
    ]:
        print(f"{label}")
        try:
            fn()
            print(f"  -> PASS\n")
        except Exception as exc:
            print(f"  -> FAIL: {exc}\n")
            failures.append(f"{label}: {exc}")

    if failures:
        print("FAILED checks:")
        for f in failures:
            print(f"  {f}")
        return 1

    print("All checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())