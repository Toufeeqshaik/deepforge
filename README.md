# DeepForge

**AI-Powered Digital Media Forensics & Deepfake Intelligence Platform**

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Python](https://img.shields.io/badge/python-3.15%2B-blue.svg)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg)
![React](https://img.shields.io/badge/React-19-61dafb.svg)
![Vite](https://img.shields.io/badge/Vite-8-646cff.svg)

---

## Overview

DeepForge is an AI-powered digital media forensics platform for analyzing images, video, and audio. It provides explainable, evidence-oriented results and treats model outputs as forensic indicators—not absolute proof.

### Current image detection (default)

- **SimLBR-aigc** — CVPR 2026 SimLBR detector (AIGC pretrained variant)
- **SimLBR-genimage** — CVPR 2026 SimLBR detector (GenImage pretrained variant)
- **Ensemble** — backend averages available model scores into a combined verdict

> Results are probabilistic forensic signals. They should not be treated as legal proof.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python, FastAPI, PyTorch, Transformers |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS |
| Image Models | SimLBR (AIGC + GenImage), DINOv3 ViT-L/16 backbone |
| Optional/Legacy | Community Forensics, Smaug, FF++ adapters present in registry (disabled by default) |

---

## Quick Start

### Prerequisites

- Python 3.11+ (project currently tested with Python 3.15 venv)
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

# SimLBR is a research repo (not a packaged pip project) - clone it locally:
mkdir -p third_party
git clone https://github.com/mvrl/SimLBR.git third_party/SimLBR
```

The SimLBR adapter auto-detects `backend/third_party/SimLBR`.

### 3. Frontend setup

```bash
cd ../frontend
npm install
```

### 4. Run

**Terminal 1 - Backend:**
```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

Open **http://localhost:5173**.

---

## DINOv3 Backbone Note

SimLBR uses a frozen DINOv3 ViT-L/16 backbone. Official DINOv3 weights may be gated.

- **Default fallback in this repo**: if `DINO_V3_KEY` is not set, the SimLBR adapter patches SimLBR to load DINOv3 via Transformers from the public mirror `samttran/dinov3-vitl16-pretrain-lvd1689m`.
- **Official path**: set `DINO_V3_KEY` to a local DINOv3 checkpoint path/URL supported by the upstream SimLBR loader.

```bash
export DINO_V3_KEY=/path/to/dinov3_vitl16_pretrain.pth
```

Use the official path when you have licensed/access-approved weights and want upstream parity.

---

## How Image Analysis Works

1. **Upload** - user submits an image.
2. **Validation** - backend validates type/size.
3. **Model inference** - enabled image detectors run (default: SimLBR AIGC + GenImage).
4. **Aggregation** - available model confidences are averaged into `combined_score`.
5. **Verdict** - mapped to likely authentic / uncertain / likely manipulated / inconclusive based on thresholds and availability.
6. **Report** - UI/API return per-model results, combined verdict, and limitations.

---

## Important Notes

### What this is NOT

- ❌ **Not legal evidence** — forensic indicator only.
- ❌ **Not 100% accurate** — false positives and false negatives are possible.
- ❌ **Not universal** — performance varies by generator, edits, compression, and domain.

### Known limitations

- **AI detection is probabilistic**. Some real images may be flagged uncertain/fake; some AI images may be missed.
- **Compression/resizing** can remove or distort forensic cues.
- **Video/audio routes exist**, but capabilities and model maturity vary by modality.
- **Public DINOv3 mirror fallback** is for practical testing; verify license/provenance for your deployment.

### Privacy

- Uploaded files are stored under `backend/uploads/` for analysis workflows.
- Do not treat local storage as a compliance boundary; review deployment settings before production use.

---

## Development

```bash
# Backend
cd backend
source .venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Frontend
cd frontend
npm run dev
```

### Checks

```bash
# Frontend
cd frontend
npx tsc --noEmit
npm run build

# Backend syntax (quick)
cd ..
python -m py_compile backend/app/detectors/image/simlbr_adapter.py backend/app/detectors/image/registry.py backend/app/detectors/image/service.py
```

---

## Project Structure

```
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
| DINOv3 public mirror fallback | https://huggingface.co/samttran/dinov3-vitl16-pretrain-lvd1689m | Used only as fallback when `DINO_V3_KEY` is not set; verify provenance/license for your use |

---

## License

MIT License - See [LICENSE](LICENSE) for details. Third-party models/repos have their own licenses and terms.