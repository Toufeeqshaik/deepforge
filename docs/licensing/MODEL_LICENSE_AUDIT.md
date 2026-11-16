# DeepForge — Model & Dataset Licence Audit (Phase 2)

**Date:** 2026-11-16  
**Auditor:** Software Licensing Compliance Engineer  
**Repository:** `/home/toufeeq/Downloads/deepforge`  
**Status:** Complete  

> **Rule reminder:** Never bundle a model with UNKNOWN or REJECTED redistribution status. Do not use non-commercial weights in a commercially intended distribution. Do not redistribute restricted datasets. Preserve upstream attribution and notices. Do not remove third-party copyright information. Do not invent legal permissions. If permission is unclear, stop integration and report the blocker.

---

## Status values used

| Value | Meaning |
|-------|---------|
| APPROVED | Cleared for use, redistribution, and commercial distribution |
| CONDITIONAL | Cleared with conditions (e.g., attribution, researcher agreement, not bundled) |
| NON-COMMERCIAL | Research/educational only — do not use in commercial distribution |
| UNKNOWN | Cannot verify — do not bundle, use placeholder adapter |
| REJECTED | Explicitly prohibited |

---

## Audited candidates

### 1. Image detection — Community Forensics (preferred)

| Field | Finding |
|-------|---------|
| Source repository | https://github.com/JeongsooP/Community-Forensics |
| Source-code licence | **MIT** (verified: `LICENSE`, Jeongsoo Park, 2025) — permits use, modification, distribution, sale |
| Pretrained-weight licence | **UNKNOWN** — Hugging Face model `JeongsooP/CommunityForensics` returns HTTP 401 (gated/restricted); `LICENSE` and `README.md` not accessible without authentication |
| Checkpoint redistribution | Cannot be verified — HF model is gated |
| Commercial-use permission | Cannot be verified — weight licence unknown |
| Training dataset licence | Not identified in accessible sources |
| Third-party backbone | EfficientNet-family (architecture); licence not yet pinned |
| Required attribution | MIT copyright notice (Jeongsoo Park, 2025) — if integrated |
| **Status** | **UNKNOWN** |

**Decision:** Do NOT bundle Community Forensics weights. Use a placeholder adapter until a compliant checkpoint with a verifiable weight licence is available. The source code (MIT) may be adapted for inference, but weights must not be downloaded or committed.

---

### 2. Video detection — EfficientNet-B0 + custom temporal head

| Field | Finding |
|-------|---------|
| Backbone | EfficientNet-B0 (torchvision) — Apache-2.0 for torchvision package; ImageNet-pretrained backbone weights subject to torchvision licence |
| Temporal head | To be trained by DeepForge — no existing checkpoint |
| Training dataset | Must be legally cleared (FaceForens++ NOT cleared for redistribution — see below) |
| Commercial-use permission | Backbone OK; temporal head (DeepForge-authored) OK; depends on cleared training data |
| Checkpoint redistribution | N/A (head not yet trained) |
| **Status** | **CONDITIONAL** — contingent on using a legally cleared training dataset for the temporal head |

**Decision:** Proceed with architecture only. Train temporal head exclusively on a dataset with verified commercial/redistribution permissions. Do not use FaceForens++ for training unless a researcher agreement permits derivative commercial use.

---

### 3. Audio detection — AASIST

| Field | Finding |
|-------|---------|
| Source repository | https://github.com/clovaai/aasist |
| Source-code licence | **MIT** (verified: NAVER Corp., 2021-present) |
| Pretrained-weight licence | **MIT** (verified: HF `SpeechAntiSpoofingBenchmarks/AASIST` README states "MIT (inherited from clovaai/aasist)"; `LICENSE` present) |
| Checkpoint redistribution | Permitted under MIT with attribution |
| Commercial-use permission | Permitted (MIT) |
| Training dataset | ASVspoof 2019 LA — complicated: paper states CC BY-NC-ND 4.0, but database released via **Open Data Commons Attribution License (ODC-By)** which permits commercial use and redistribution with attribution |
| Third-party backbone | RawNet2-style + graph attention (AASIST-authored, MIT) |
| Required attribution | NAVER Corp. copyright notice; ASVspoof attribution per ODC-By |
| **Status** | **CONDITIONAL** |

**Decision:** AASIST code + checkpoint cleared (MIT). Implement the AASIST adapter but do **not** bundle the checkpoint in the repo; provide a download script that verifies the hash. Do not claim AASIST detects every kind of synthetic audio (per README, EER is high on in-the-wild datasets). ASVspoof training data is conditionally cleared via ODC-By with attribution.

---

### 4. Existing bundled model — Xicor9/efficientnet-b0-ffpp-c23 (already in repo)

| Field | Finding |
|-------|---------|
| File | `backend/models/efficientnet_b0_ffpp_c23.pth` (~15.6 MB), present locally |
| Source | https://huggingface.co/Xicor9/efficientnet-b0-ffpp-c23 |
| LICENSE file | **404 — none present** |
| Stated terms | README: "released strictly for research and educational purposes only"; "Not intended for real-world forensic, biometric, surveillance, or law-enforcement applications" |
| Training dataset | FaceForens++ C23 — database access requires researcher licence agreement |
| Commercial-use permission | **Not granted** — research/educational only |
| Checkpoint redistribution | Not cleared (no licence file, research-only statement) |
| **Status** | **NON-COMMERCIAL** |

**Decision:** This model is ALREADY present in the local working copy (downloaded during prior testing). Per the migration rules, do not delete existing models until replacements pass testing, but do NOT commit or redistribute this checkpoint. It must be replaced before any public/commercial release. Keep as local fallback only.

---

### 5. FaceForens++ dataset (training data for image/video models)

| Field | Finding |
|-------|---------|
| Source | https://github.com/ondyari/FaceForensics |
| Code licence | **MIT** (verified: `LICENSE`, Andreas Rössler et al., 2018) |
| Database access | Requires researcher licence agreement (asvspoof.org: "To download it, please visit our Licence page") |
| Redistribution | Restricted — not publicly redistributable without agreement |
| Commercial use | Restricted |
| **Status** | **CONDITIONAL** — researcher agreement required; do not bundle |

---

## Licence audit summary table

| Model | Source licence | Weight licence | Dataset licence | Commercial permission | Redistribution permission | Status |
|-------|---------------|----------------|-----------------|----------------------|--------------------------|--------|
| Community Forensics (image) | MIT | UNKNOWN (HF gated 401) | Not identified | UNKNOWN | UNKNOWN | UNKNOWN |
| EfficientNet-B0 + temporal head (video) | Apache-2.0 (torchvision) | N/A (head not trained) | TBD — must be cleared | Conditional | Conditional | CONDITIONAL |
| AASIST (audio) | MIT (NAVER) | MIT | ASVspoof 2019 (ODC-By / CC BY-NC-ND paper) | Yes (weights) | Yes (weights, w/ attribution) | CONDITIONAL |
| Xicor9 FF++ C23 (existing, bundled locally) | None (no LICENSE file) | None (research-only statement) | FaceForens++ C23 (researcher agreement) | No | No | NON-COMMERCIAL |
| FaceForens++ dataset | MIT (code) | N/A | Researcher agreement | Restricted | Restricted | CONDITIONAL |

---

## Required deliverables for public release

1. **LICENSE** — Apache-2.0 or MIT for original DeepForge code
2. **NOTICE** — third-party copyright & attribution (NAVER Corp., Jeongsoo Park, Rössler et al., ODC-By attribution)
3. **MODEL_LICENSES.md** — this audit + per-model licence text
4. **DATASET_LICENSES.md** — dataset terms (FaceForens++, ASVspoof)
5. **MODEL_CARD.md** — per-model intended use, limitations, performance claims with sources
6. **Download scripts** — for approved checkpoints only, with pinned versions + hash verification
7. **Never commit** restricted weights (`efficientnet_b0_ffpp_c23.pth`, AASIST.pth, Community Forensics weights)
8. **Never commit** API keys, tokens, or credentials

---

## Immediate next step

Proceed to **Phase 3** (image detection engine) using a placeholder adapter for Community Forensics until a compliant checkpoint is verified. Do not download or bundle Community Forensics weights.
