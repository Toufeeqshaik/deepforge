# DeepForge

**AI-Powered Digital Media Forensics & Deepfake Intelligence Platform**

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Python](https://img.shields.io/badge/python-3.15%2B-blue.svg)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg)
![React](https://img.shields.io/badge/React-19-61dafb.svg)
![Vite](https://img.shields.io/badge/Vite-8-646cff.svg)

DeepForge is an AI-powered digital media forensics platform for analyzing images, video, and audio. It provides explainable, evidence-oriented results and treats model outputs as **forensic indicators, not proof**.

---

## What's New

- **New image detection model**: switched the default image analysis to a **SimLBR ensemble** (`SimLBR-aigc` + `SimLBR-genimage`, CVPR 2026 Latent Blending Regularization).
- **Ensemble scoring**: available image model confidences are averaged into a combined score/verdict.
- **DINOv3 fallback**: when `DINO_V3_KEY` is not set, the adapter falls back to the public Transformers mirror `samttran/dinov3-vitl16-pretrain-lvd1689m` for local testing.
- **Updated UI/docs**: stale EfficientNet/FF++ labels replaced with current SimLBR ensemble information.

---

## Features & Status

| Feature | Status | Notes |
|---|---|---|
| Image analysis (SimLBR ensemble) | ✅ Working | Default active path. Uses `SimLBR-aigc` + `SimLBR-genimage`. |
| Combined verdict & per-model scores | ✅ Working | Average of available model confidences. |
| Frontend upload/analyze UI | ✅ Working | Image flow tested locally. |
| Video analysis (frame sampling) | ⚠️ Limited / experimental | Samples frames and runs them through the configured image detector ensemble. **Not a dedicated video deepfake model.** |
| Audio analysis (spectral heuristic) | ⚠️ Experimental / not validated | Heuristic spectral indicators only. **Not a validated deepfake detector.** |
| Grad-CAM heatmap | ❌ Not working for current model | SimLBR/transformer-backed flow does not currently expose compatible Grad-CAM heatmaps in the UI. |
| Legacy detectors (FF++ EfficientNet, Smaug, Community Forensics) | ⚠️ Present but disabled by default | Adapters remain in registry/codebase; can be re-enabled manually if needed. |
| PDF/forensic report export | ❌ Not implemented / not verified | Do not rely on this as a current working feature. |
| Legal/court-grade attribution | ❌ Not supported | Outputs are probabilistic forensic indicators only. |

---

## Current Image Detection

### Default active models

| Model | Variant | Status | Purpose |
|---|---|---|---|
| SimLBR-aigc | AIGC pretrained | Enabled | AI-generated image detection |
| SimLBR-genimage | GenImage pretrained | Enabled | AI-generated image detection |

### Verdict mapping

- `< 0.35` → `likely_authentic`
- `0.35 - 0.65` → `uncertain`
- `> 0.65` → `likely_manipulated`
- No available model scores → `inconclusive`

> Scores are model confidence indicators, not calibrated legal probabilities.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python, FastAPI, PyTorch, Transformers |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS |
| Image Models | SimLBR (AIGC + GenImage), DINOv3 ViT-L/16 backbone |
| Optional/Legacy | Community Forensics, Smaug, FF++ adapters in registry (disabled by default) |

---

## Quick Start

### Prerequisites

- Python 3.11+ (tested with Python 3.15 venv)
- Node.js 20+
- Git

### 1. Clone

```bash
git clone https://github.com/Toufeeqshaik/deepforge.git
cd deepforge
```

### 2. Backend setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# SimLBR is a research repo (not a packaged pip project)
mkdir -p third_party
git clone https://github.com/mvrl/SimLBR.git third_party/SimLBR
```

The adapter auto-detects `backend/third_party/SimLBR`.

### 3. Frontend setup

```bash
cd ../frontend
npm install
```

### 4. Run

**Terminal 1 - Backend**
```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

**Terminal 2 - Frontend**
```bash
cd frontend
npm run dev
```

Open **http://localhost:5173**.

---

## DINOv3 Backbone Note

SimLBR uses a frozen DINOv3 ViT-L/16 backbone.

- **Fallback (current default behavior)**: if `DINO_V3_KEY` is not set, the adapter patches SimLBR to load DINOv3 via Transformers from the public mirror `samttran/dinov3-vitl16-pretrain-lvd1689m`.
- **Official path**: set `DINO_V3_KEY` to a local DINOv3 checkpoint path/URL supported by the upstream SimLBR loader.

```bash
export DINO_V3_KEY=/path/to/dinov3_vitl16_pretrain.pth
```

Use the official/licensed path for production or strict provenance requirements.

---

## Known Limitations / Not Working Yet

- **Heatmaps (Grad-CAM)**: not available for the current SimLBR ensemble.
- **Video detection**: limited frame-sampling pipeline; not a dedicated temporal video deepfake model.
- **Audio detection**: experimental spectral heuristic; not validated for real-world deepfake detection.
- **False positives/negatives**: real images can be flagged; some AI-generated images can be missed.
- **Compression/domain shift**: heavy compression, resizing, screenshots, or out-of-domain images can reduce accuracy.
- **Legal use**: not suitable as standalone legal evidence.

---

## Development Checks

```bash
# Frontend
cd frontend
npx tsc --noEmit
npm run build

# Backend quick syntax check
cd ..
python -m py_compile backend/app/detectors/image/simlbr_adapter.py backend/app/detectors/image/registry.py backend/app/detectors/image/service.py
```

---

## Project Structure

```text
deepforge/
├── backend/
│   ├── app/
│   │   ├── api/              # FastAPI routes
│   │   ├── core/             # Config, logging, exceptions
│   │   ├── detectors/image/  # Image detector adapters/registry/service
│   │   ├── services/         # Analysis orchestration
│   │   └── main.py
│   ├── third_party/          # Local SimLBR clone (gitignored)
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   └── lib/
│   └── package.json
└── docs/
```

---

## Model & License References

| Component | Source | Notes |
|---|---|---|
| SimLBR | https://github.com/mvrl/SimLBR | Research code/model; check upstream license/terms |
| SimLBR pretrained heads | https://huggingface.co/MVRL/SimLBR | Downloaded by SimLBR loader |
| DINOv3 ViT-L/16 (official) | https://huggingface.co/facebook/dinov3-vitl16-pretrain-lvd1689m | Gated; accept license/terms |
| DINOv3 public mirror fallback | https://huggingface.co/samttran/dinov3-vitl16-pretrain-lvd1689m | Used only when `DINO_V3_KEY` is not set; verify provenance/license for your use |

---

## License

MIT License - See [LICENSE](LICENSE) for details. Third-party models/repos have their own licenses and terms.