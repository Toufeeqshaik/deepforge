# DeepForge Image Detection Engine

## Current State

DeepForge image detection uses a pluggable detector registry/service under `backend/app/detectors/image/`.

### Default active models

| Model | Loader | Status | Purpose |
|---|---|---|---|
| `SimLBR-aigc` | `simlbr` | Enabled | AI-generated image detection (AIGC variant) |
| `SimLBR-genimage` | `simlbr` | Enabled | AI-generated image detection (GenImage variant) |

Legacy/optional adapters remain in the codebase/registry (Community Forensics, Smaug, FF++ EfficientNet) but are disabled by default.

## Architecture

```
backend/app/detectors/image/
├── base.py                  # ImageDetector interface + result shape
├── registry.py              # Model registry (enable/disable, loader, metadata)
├── service.py               # Loads enabled detectors, runs ensemble, aggregates score
├── simlbr_adapter.py        # SimLBR adapter (default active)
├── community_forensics.py   # Legacy/optional
├── smaug_adapter.py         # Legacy/optional
├── transformers_adapter.py  # Legacy/optional
└── fallback.py              # Last-resort fallback
```

## SimLBR Integration

- Source repo: https://github.com/mvrl/SimLBR
- Local clone expected at: `backend/third_party/SimLBR` (gitignored)
- Adapter: `backend/app/detectors/image/simlbr_adapter.py`
- Pretrained heads: loaded via `SimLBR.from_pretrained("aigc"|"genimage")` from `MVRL/SimLBR`

### DINOv3 backbone

Upstream SimLBR loads DINOv3 ViT-L/16 via torch hub and expects `DINO_V3_KEY`. In this repo, the adapter adds a practical fallback:

- If `DINO_V3_KEY` is set: upstream behavior can be used.
- If `DINO_V3_KEY` is not set: adapter monkeypatches SimLBR backbone to load `samttran/dinov3-vitl16-pretrain-lvd1689m` through Transformers.

Set `SIMLBR_DINOV3_MODEL` to override the fallback mirror model.

## Aggregation

`ImageDetectionService.detect()`:

1. Runs all enabled/available detectors.
2. Collects per-model results.
3. Computes `combined_score` as average of available model confidences.
4. Maps combined score to verdict:
   - `< 0.35` → `likely_authentic`
   - `0.35 - 0.65` → `uncertain`
   - `> 0.65` → `likely_manipulated`
   - no scores → `inconclusive`

## Operational Notes

- First run may download SimLBR heads and DINOv3 weights.
- CPU inference works but is slower; GPU used when available/configured.
- Third-party SimLBR clone is ignored by git; keep local environment setup documented.
- Model outputs are forensic indicators, not legal proof.