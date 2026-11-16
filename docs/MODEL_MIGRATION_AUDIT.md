# DeepForge — Model Migration Audit (Phase 1)

**Date:** 2026-11-16  
**Auditor:** Senior ML / Backend / MLOps / Licensing Engineer  
**Repository:** `/home/toufeeq/Downloads/deepforge`  
**Status:** Complete — no existing models deleted or overwritten

---

## 1. Existing Architecture

### Frontend
| Item | Detail |
|------|--------|
| Framework | React 19 + TypeScript (strict) |
| Build tool | Vite 8.x |
| Styling | Tailwind CSS v4 |
| Animations | Framer Motion |
| Routing | react-router-dom 7.x |
| HTTP client | axios |
| Icons | lucide-react |
| Linter | oxc / oxlint |
| Source root | `frontend/src/` |
| Entry | `frontend/src/main.tsx` |
| Routes | `frontend/src/App.tsx` |

### Backend
| Item | Detail |
|------|--------|
| Framework | FastAPI (Python) |
| Python version | 3.15.0 (Fedora 45) |
| ASGI server | uvicorn 0.54.0 |
| ML stack | PyTorch 2.15.0 (+cpu), torchvision 0.29.2, transformers 5.23.0 |
| Media libs | opencv-python-headless, librosa, soundfile, Pillow |
| Config | pydantic-settings |
| Source root | `backend/app/` |
| Entry | `backend/app/main.py` |

### Deployment target (stated)
- Primary: ASUS ExpertBook P3, Intel Core Ultra 7 255H, 16 GB RAM, integrated graphics, **CPU-first inference**
- Future training: NVIDIA DGX server (optional CUDA backend)

---

## 2. Existing API Endpoints

All endpoints live under `/api` prefix (`backend/app/api/routes.py`):

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/` | GET | Welcome / docs link |
| `/api/health` | GET | Health, loaded models, uptime |
| `/api/analyze/image` | POST | Image upload → face-swap detection |
| `/api/analyze/video` | POST | Video upload → frame sampling + EfficientNet-B0 |
| `/api/analyze/audio` | POST | Audio upload → experimental spectral heuristics |
| `/analysis/{id}` | GET | Retrieve a single analysis report |
| `/analyses` | GET | List all analyses (most recent first) |
| `/analysis/{id}/report` | GET | Full report (PDF planned) |

Response shape: `AnalysisReport` (`backend/app/schemas/analysis.py`) — analysis_id, status, analysis_type, verdict, summary, detector_results[], forensic_indicators[], limitations[], processing_time_ms, metadata.

---

## 3. Existing Models

### 3.1 Image detection — Xicor9/efficientnet-b0-ffpp-c23
- **File:** `backend/models/efficientnet_b0_ffpp_c23.pth` (15.6 MB, present locally)
- **Architecture:** EfficientNet-B0, classifier head replaced with `nn.Linear(in_features, 2)`
- **Weights source:** `https://huggingface.co/Xicor9/efficientnet-b0-ffpp-c23/resolve/main/efficientnet_b0_ffpp_c23.pth`
- **Dataset:** FaceForensics++ C23 (DeepFake, FaceSwap, Face2Face, NeuralTextures)
- **Classes:** 0 = real, 1 = fake
- **Preprocessing:** Resize 224×224, ToTensor, ImageNet normalization (mean/std)
- **Inference:** `torch.no_grad()`, softmax, class-1 probability = fake score
- **Calibration:** Logistic stretch `(fake_prob - 0.5) * 10` → sigmoid
- **Verdict thresholds:** ≥0.85 likely_manipulated; ≥0.70 potentially_manipulated; ≥0.40 uncertain; <0.40 likely_authentic
- **Threads:** `torch.set_num_threads(8)` (tuned for Core Ultra 7)
- **Device:** CPU (`settings.MODEL_DEVICE = "cpu"`)
- **Service:** `backend/app/services/detection_service.py` — `ImageDetectionService`
- **Load behaviour:** Attempted at FastAPI startup; falls back gracefully if unavailable (inconclusive results)

### 3.2 Video detection — EfficientNet-B0 + uniform frame sampling
- **Service:** `backend/app/services/video_detection_service.py` — `VideoDetectionService`
- **Method:** OpenCV `VideoCapture` → uniform `np.linspace` sampling (up to `VIDEO_FRAME_SAMPLE_COUNT = 8` frames) → each frame through `ImageDetectionService.run_detection`
- **Aggregation:** max fake probability across frames; mean calibrated confidence
- **Label:** "fake" if any sampled frame ≥ 0.5
- **Verdict thresholds:** same as image (0.85 / 0.70 / 0.40)
- **Limitations stated in code:** no optical-flow / temporal-consistency model; no audio-visual fusion; frame-level inferences only

### 3.3 Audio detection — experimental spectral heuristics
- **Service:** `backend/app/services/audio_detection_service.py` — `AudioDetectionService`
- **Method:** soundfile read → mono conversion → librosa spectral centroid, bandwidth, zero-crossing rate, spectral rolloff → heuristic score (0–1)
- **Model:** None (no weights, no download)
- **Heuristic rules:** ZCR < 0.05 (+0.25), centroid > 6000 Hz (+0.2), bandwidth < 1500 Hz (+0.2); capped at 1.0
- **Verdict thresholds:** ≥0.75 potentially_manipulated; ≥0.40 uncertain; <0.40 likely_authentic
- **Explicitly stated:** NOT a validated deepfake detector; weak signal only

---

## 4. Model Checkpoints and Locations

| Checkpoint | Path | Size | Status |
|------------|------|------|--------|
| `efficientnet_b0_ffpp_c23.pth` | `backend/models/efficientnet_b0_ffpp_c23.pth` | ~15.6 MB | Present locally; loaded successfully on CPU |
| Audio checkpoint | None | — | Not applicable (heuristic only) |
| Video checkpoint | None (reuses image weights) | — | Not applicable |

The checkpoint was downloaded from Hugging Face during local testing. It is **not** tracked in git (large binary); it lives in the local working copy only.

---

## 5. Preprocessing Pipelines

### Image
1. `PIL.Image.open(file_path)` → convert to RGB if needed
2. `transforms.Resize((224, 224))`
3. `transforms.ToTensor()`
4. `transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])`
5. `unsqueeze(0)` → CPU tensor → model forward → softmax

### Video
1. OpenCV `VideoCapture` → read total_frames, fps
2. `np.linspace(0, total_frames - 1, sample_count)` indices
3. Per frame: `cap.set(POS_FRAMES, idx)` → `cap.read()` → BGR→RGB → `PIL.Image.fromarray`
4. Same image pipeline as above per frame
5. Aggregate: max fake prob, mean calibrated confidence

### Audio
1. `soundfile.read(path)` → `(y, sr)`
2. Mono: `np.mean(y, axis=1)` if multi-channel
3. `librosa.feature.spectral_centroid`, `spectral_bandwidth`, `zero_crossing_rate`, `spectral_rolloff`
4. Heuristic scoring from feature thresholds

---

## 6. Dataset Dependencies

| Model | Dataset | Version | Use |
|-------|---------|---------|-----|
| Xicor9/efficientnet-b0-ffpp-c23 | FaceForensics++ | C23 compression | Training / fine-tuning |

FaceForensics++ is a **research dataset** with its own licence terms (see Phase 2). It is not bundled in the repo; only the fine-tuned weights are present locally.

No separate test/validation dataset is present in the repository.

---

## 7. Existing Inference Architecture

- **Service singletons:** `detection_service`, `video_detection_service`, `audio_detection_service` (module-level in `backend/app/services/`)
- **Orchestrator:** `analysis_service` (`AnalysisService`) — in-memory dict store of `AnalysisReport` objects
- **Startup:** `main.py` calls `analysis_service.start()` → `detection_service.load()` at FastAPI startup
- **Model loading:** Eager at startup (image model); graceful degradation if load fails
- **Concurrency:** None — synchronous CPU inference inside async route handlers (blocks event loop during inference)
- **Batching:** Batch size 1 only
- **Queueing:** None
- **Lazy loading:** None (model loaded at startup)
- **Model unloading:** None
- **ONNX:** Not used
- **Quantization:** Not used

---

## 8. Database Integration

**None.** Analysis records are held in an in-memory Python dict (`AnalysisService._analyses`). No SQLite, PostgreSQL, Supabase, or other persistent store. History is lost on server restart.

---

## 9. Authentication

**None.** No login, signup, JWT, session, or API-key middleware. All endpoints are publicly accessible (CORS restricted to `localhost:5173` / `localhost:3000`).

---

## 10. Existing Frontend Workflows

| Page | Route | Purpose |
|------|-------|---------|
| Home | `/` | Landing, feature overview, how-it-works |
| Analyze (image) | `/analyze` | Image upload → `analyzeImage()` → results |
| Video Analysis | `/video` | Video upload → `analyzeVideo()` → results |
| Audio Analysis | `/audio` | Audio upload → `analyzeAudio()` → results |
| Comparison | `/comparison` | Honest system comparison table |
| History | `/history` | List past analyses via `getAnalyses()` |
| Analysis Detail | `/analysis/:id` | Single report view |
| About | `/about` | Mission, philosophy, tech stack |

Key components:
- `UploadZone.tsx` — generalized drag/drop upload with accept + maxSizeMB props; image/video/audio icons
- `AnalysisResults.tsx` — simple/advanced mode toggle, verdict badge, detector rows, limitations, forensic indicators
- `VerdictBadge.tsx` — color-coded verdict pill (likely_authentic / uncertain / potentially_manipulated / likely_manipulated / inconclusive)
- `GlassCard.tsx` — glassmorphism card primitive
- `Layout.tsx` — top nav with NavLink items
- `lib/api.ts` — typed axios client (`analyzeImage`, `analyzeVideo`, `analyzeAudio`, `getHealth`, `getAnalysis`, `getAnalyses`)
- `lib/verdicts.ts` — verdict metadata mapping
- `lib/format.ts` — byte/duration/timestamp/score formatting

Design system: "liquid glass" dark theme, honest-uncertainty messaging, no hardcoded/demo results.

---

## 11. Existing Model Evaluation Results

**None documented.** The code comments cite "85.2% (frame-level), 88%+ (video-level) on FF++ C23" but there is:
- No evaluation script
- No test dataset
- No `docs/evaluation/`
- No benchmark results committed to the repo

These figures are unattributed claims in code comments/docstrings, not measured results from this repo.

---

## 12. Existing Model Licences (if known)

| Model | Stated licence (in code) | Notes |
|-------|-------------------------|-------|
| Xicor9/efficientnet-b0-ffpp-c23 | "Research/Educational only" (docstring) | Unverified — source-code repo licence vs. weight licence must be checked separately (Phase 2) |
| EfficientNet-B0 backbone (torchvision) | Apache-2.0 (torchvision) | Backbone architecture only |
| AASIST (candidate, not yet integrated) | — | Not yet audited |
| Community Forensics (candidate, not yet integrated) | — | Not yet audited |

**Important:** The docstring "Research/Educational only" is a self-declared restriction in a comment, not a verified legal licence. Phase 2 must verify the actual weight licence before any redistribution or commercial use.

---

## 13. Existing Dependencies

Full list in `backend/requirements.txt`:

```
fastapi==0.163.1
uvicorn[standard]==0.54.0
python-multipart==0.0.33
pydantic==2.14.3
pydantic-settings==2.16.3
aiofiles==25.1.0
Pillow==13.0.0
torch==2.15.0
torchvision==0.29.2
transformers==5.23.0
opencv-python-headless==5.0.0.93
librosa==1.0.1
soundfile==0.14.0
```

Frontend: `frontend/package.json` — React 19, Vite, Tailwind v4, Framer Motion, react-router-dom, axios, lucide-react, oxlint, TypeScript.

---

## 14. Features That Must Remain Operational

1. Image upload + analysis (`/api/analyze/image`)
2. Video upload + analysis (`/api/analyze/video`)
3. Audio upload + analysis (`/api/analyze/audio`)
4. Health check (`/api/health`)
5. Retrieve single analysis (`/analysis/{id}`)
6. List analyses (`/analyses`)
7. Report endpoint (`/analysis/{id}/report`)
8. Frontend routes: `/`, `/analyze`, `/video`, `/audio`, `/comparison`, `/history`, `/analysis/:id`, `/about`
9. Frontend components: UploadZone, AnalysisResults, VerdictBadge, GlassCard, Layout
10. Honest "inconclusive" when models unavailable — no fabricated results
11. CORS to `localhost:5173` / `localhost:3000`
12. CPU-first inference on Core Ultra 7 / 16 GB RAM

---

## 15. Risks Associated with Migration

| Risk | Severity | Mitigation |
|------|----------|------------|
| Existing image model (Xicor9 FF++ C23) may have non-commercial weight licence | High | Phase 2 licence audit; replace with approved checkpoint or placeholder adapter |
| FaceForensics++ dataset licence may restrict redistribution/commercial use | High | Do not bundle dataset; document terms; train temporal head only on cleared data |
| AASIST / ASVspoof checkpoint may have restrictive terms | High | Verify before bundling; placeholder adapter if unclear |
| Community Forensics weights may be non-commercial | High | Verify Hugging Face model card + LICENSE before integration |
| Loss of existing 15.6 MB weights if overwritten | Medium | Do not delete during Phase 1; keep as fallback until replacement validated |
| No persistent DB — history lost on restart | Medium | Out of scope for model migration; document as limitation |
| CPU inference latency for video (8 frames × EfficientNet-B0) | Medium | Lazy loading, sequential CPU inference, configurable sampling |
| Frontend hardcoded references to "EfficientNet-B0 / FF++ C23" | Low | Update UI text when models change |
| Inaccurate accuracy claims (85.2% / 88%+) unattributed | Medium | Remove or re-source claims; produce own evaluation in Phase 11 |
| torch/torchvision version mismatch (seen during local setup) | Low | Pin CPU-specific wheels from PyTorch index |

---

## Phase 1 Status: Complete

No existing models were deleted or overwritten. The existing `backend/models/efficientnet_b0_ffpp_c23.pth` remains in place. The system currently runs end-to-end on localhost:8000 (backend) and localhost:5173 (frontend) with all three modalities functional.

---

## Proposed Migration Plan (High-Level)

| Phase | Goal | Gate |
|-------|------|------|
| 1 | Repository audit (this doc) | Complete |
| 2 | Licence & legal audit for candidate models (Community Forensics, EfficientNet-B0 temporal head, AASIST) | `docs/licensing/MODEL_LICENSE_AUDIT.md`; no UNKNOWN/REJECTED weights bundled |
| 3 | New image detection engine (Community Forensics preferred; fallback if not cleared) | Modular interface; CPU batch-1 |
| 4 | New video detection engine (EfficientNet-B0 + temporal head, trained on cleared data) | Modular interface; mean/median/attention/GRU aggregation |
| 5 | New audio detection engine (AASIST adapter; placeholder if checkpoint not cleared) | 16 kHz mono; chunked inference |
| 6 | Common model interface (`backend/inference/`) | Consistent prediction schema; LIKELY_AUTHENTIC / LIKELY_MANIPULATED / INCONCLUSIVE |
| 7 | CPU optimization (lazy load, unload, queues, thread limits, optional ONNX/INT8) | 16 GB RAM target |
| 8 | Multimodal fusion (only when multiple modalities present) | Calibrated uncertainty |
| 9 | Backend integration (preserve existing APIs) | Backward-compatible responses |
| 10 | Frontend integration (preserve liquid-glass UI) | Real backend results; no hardcoded scores |
| 11 | Testing & benchmarking (`docs/evaluation/RESULTS.md`) | Accuracy, precision, recall, F1, ROC-AUC, EER, CPU time, peak RAM |
| 12 | Public GitHub release (LICENSE, NOTICE, MODEL_CARD.md, download scripts) | No restricted weights committed; no credentials |
| 13 | Final validation | All routes + all modalities tested on CPU |

**Immediate next step:** Phase 2 — licence audit of Community Forensics, EfficientNet-B0 temporal head, and AASIST before any weights are downloaded or integrated.
