# DeepForge Image Detection Engine

## Overview

This document describes the production-structured, replaceable image detection engine implemented for DeepForge.

### Key Objectives

1. **Replace** the existing Xicor9/efficientnet-b0-ffpp-c23 image detection with a modular, replaceable architecture
2. **Preserve** existing API contracts and application functionality
3. **Support** Community Forensics as the preferred model (with placeholder adapter)
4. **Maintain** CPU-first operation for Intel Core Ultra 7 / 16 GB RAM hardware
5. **Ensure** no fabricated predictions or fake confidence values

## Architecture

### Module Structure

```
backend/app/detectors/image/
├── __init__.py          # Module initialization
├── base.py              # Common detector interface (ImageDetector)
├── preprocessing.py     # Image validation, resizing, normalization
├── community_forensics.py  # Community Forensics adapter implementation
├── fallback.py          # Fallback implementation for unavailable models
└── service.py           # Detector orchestration and selection service
```

### Component Details

#### 1. `base.py` - Common Detector Interface
- Defines `ImageDetectionResult` TypedDict with standardized fields:
  - `prediction`: "real" or "fake" (only when genuine inference performed)
  - `confidence`: Optional[float] (calibrated confidence when available)
  - `model_name`: str (e.g., "CommunityForensics")
  - `model_version`: str (e.g., "1.0.0")
  - `processing_time_ms`: float
  - `device_used`: Literal["cpu", "cuda"]
  - `model_available`: bool
  - `warnings`: list[str]
  - `error_details`: Optional[str]
- `ImageDetector` abstract base class with:
  - `is_available()`: Check model availability
  - `run_detection()`: Execute inference on PIL Image
  - `get_model_info()`: Return metadata

#### 2. `preprocessing.py` - Image Processing Utilities
- `validate_image()`: Check file existence and readability
- `load_image()`: Load PIL Image with error handling
- `validate_format()`: Support .jpg, .jpeg, .png, .webp, .bmp, .tiff
- `validate_size()`: Max 50 MB file size limit
- `resize_image()`: Resize to 224x224 with LANCZOS resampling
- `to_tensor()`: Convert to normalized torch Tensor

#### 3. `community_forensics.py` - Model Adapter
- Loads locally supplied Community Forensics checkpoint
- Verifies checkpoint existence and compatibility
- Supports CPU (default) and CUDA (automatic)
- Handles invalid images and unsupported formats
- Returns `MODEL_NOT_AVAILABLE` status when checkpoint missing
- Never substitutes another model silently

#### 4. `fallback.py` - Unavailable Model Implementation
- Always available fallback detector
- Returns "uncertain" verdict when no model is loaded
- Built-in EfficientNet-B0 model for basic inference
- Never blocks processing - always returns valid result

#### 5. `service.py` - Orchestrator
- Manages detector selection between Community Forensics and fallback
- Ensures consistent API response format
- Handles model loading and initialization
- Provides unified `detect()` method for API consumption

## Model Adapter Requirements

### Community Forensics Adapter

- **Checkpoint Requirements**:
  - Must be locally supplied (not bundled with repo)
  - Must be licence-cleared (MIT source, ODC-By datasets)
  - File path: `backend/models/community_forensics.pth` (standard location)
  - Must be compatible with EfficientNet-B0 architecture

- **Loading Behavior**:
  - Attempts to load at startup
  - Can be manually loaded via `detector_service.initialize()`
  - Returns `MODEL_NOT_AVAILABLE` if checkpoint missing
  - Never substitutes another model

- **Inference Behavior**:
  - CPU-first operation (settings.MODEL_DEVICE = "cpu")
  - Automatic CUDA detection and use when available
  - Inference mode only (no training)
  - Memory management: temporary tensors released after use

## Standardized Output Format

All detectors return `ImageDetectionResult` with:

| Field | Description | When Available |
|-------|-------------|----------------|
| `prediction` | "real" or "fake" | Only when genuine inference performed |
| `confidence` | Calibrated confidence score (0-1) | Only when genuine inference performed |
| `model_name` | Model identifier | Always |
| `model_version` | Version string | Always |
| `processing_time_ms` | Inference duration | Always |
| `device_used` | "cpu" or "cuda" | Always |
| `model_available` | Boolean availability flag | Always |
| `warnings` | List of warnings | When applicable |
| `error_details` | Error message if failed | When error occurs |

## Performance Requirements

### Target Hardware
- Intel Core Ultra 7 255H
- 16 GB RAM
- Integrated graphics
- CPU-first operation

### Optimization Requirements
- Avoid loading duplicate model instances
- Use inference mode only (`torch.no_grad()`)
- Release temporary image and tensor memory after use
- Avoid unnecessary image copies
- Handle large uploads safely (50 MB max)
- Configurable inference (thread count, batch size)

## Testing Requirements

Tests must verify:
- Valid image input processing
- Invalid image input handling
- Unsupported format rejection
- Missing checkpoint behavior
- Corrupt checkpoint handling
- CPU inference with valid checkpoint
- API response compatibility
- Model-unavailable fallback behavior

## Documentation Requirements

### `docs/IMAGE_ENGINE.md` - This File
- Architecture documentation
- Model requirements
- Checkpoint installation instructions
- Licence restrictions
- API response examples
- CPU/GPU behavior
- Testing instructions
- Known limitations

## Known Limitations

1. Community Forensics checkpoint must be manually downloaded and placed in `backend/models/`
2. No GPU acceleration support in current implementation (CPU-only)
3. No batch processing support (batch size 1 only)
4. No model versioning system (single model instance)
5. No model caching beyond initial load

## Installation Instructions

1. **Clone repository** (if not already done)
2. **Install dependencies**:
   ```bash
   cd /home/toufeeq/Downloads/deepforge
   pip install -r backend/requirements.txt
   ```
3. **Download Community Forensics checkpoint**:
   ```bash
   # Download from Hugging Face (requires authentication)
   huggingface-cli download JeongsooP/CommunityForensics --include "community_forensics.pth" --destination backend/models/
   ```
4. **Verify checkpoint**:
   ```bash
   ls backend/models/community_forensics.pth  # Should exist
   ```
5. **Run application**:
   ```bash
   # Start backend
   cd backend
   uvicorn app.main:app --host 0.0.0.0 --port 8000
   ```

## API Contract Compatibility

- **Preserved endpoints**: `/api/analyze/image`, `/api/analyze/video`, `/api/analyze/audio`
- **Response format**: Backward-compatible `AnalysisReport` schema
- **Verdict levels**: Maintained (LIKELY_AUTHENTIC, UNCERTAIN, POTENTIALLY_MANIPULATED, LIKELY_MANIPULATED, INCONCLUSIVE)
- **Error handling**: Same exception types, enhanced messages

## Migration Path

1. **Phase 1**: Implement Community Forensics adapter with placeholder checkpoint
2. **Phase 2**: Verify API compatibility with existing frontend
3. **Phase 3**: Replace Xicor9 model in production after validation
4. **Phase 4**: Support CUDA inference on NVIDIA systems (future)

## Testing Instructions

1. **Run backend tests**:
   ```bash
   cd /home/toufeeq/Downloads/deepforge/backend
   pytest tests/ -v
   ```
2. **Run frontend build**:
   ```bash
   cd frontend
   npm run build
   ```
3. **Manual testing**:
   - Upload valid image through `/analyze/image` endpoint
   - Verify response contains real/fake prediction with processing time
   - Test with invalid image formats
   - Test with missing checkpoint (should return uncertain verdict)

## Verification Checklist

- [ ] Backend test suite passes
- [ ] Frontend build succeeds
- [ ] Image analysis functionality works end-to-end
- [ ] Video and audio routes unchanged
- [ ] Git diff shows only intended changes
- [ ] All new/modified files documented
- [ ] No fabricated predictions or confidence values
- [ ] No unverified model downloads
- [ ] No breaking API changes
- [ ] No unrelated refactoring