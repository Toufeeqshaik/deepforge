from __future__ import annotations

import time
from fastapi import APIRouter, HTTPException, UploadFile

from app.core.exceptions import DeepForgeException
from app.schemas.analysis import AnalysisReport, AnalysisType, HealthResponse

router = APIRouter(prefix="/api")

# Populated by main.py at startup
_startup_time: float = 0.0


def set_startup_time(t: float) -> None:
    """Record application start timestamp (called once at startup)."""
    global _startup_time
    _startup_time = t


# Lazy singleton accessors — these are only called inside route handlers /
# startup, never at module import time, so a broken detector package cannot
# crash the whole service (including /api/health).
def _detection_service():
    from app.services.detection_service import detection_service
    return detection_service


def _analysis_service():
    from app.services import analysis_service
    return analysis_service


@router.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """Return platform health status, loaded models, and uptime."""
    models_loaded = []
    ds = _detection_service()
    if ds.is_available():
        model_info = ds.get_model_info()
        for name, info in model_info.get("models_available", {}).items():
            models_loaded.append(f"{name}: {info.get('model_name', 'Unknown')}")
    else:
        models_loaded.append("model_not_loaded")

    return HealthResponse(
        status="healthy",
        version="0.1.0",
        models_loaded=models_loaded,
        uptime_seconds=round(time.time() - _startup_time, 2),
    )


@router.post("/analyze/image", response_model=AnalysisReport)
async def analyze_image(file: UploadFile) -> AnalysisReport:
    """Upload an image for deepfake / manipulation analysis."""
    try:
        await validate_image_file(file)

        content = await file.read()
        file_size = len(content)
        await file.seek(0)

        file_name = file.filename or "upload"
        file_type = file.content_type or "application/octet-stream"

        asv = _analysis_service()
        report = asv.create_analysis(
            file_path=None,  # type: ignore[arg-type]
            file_name=file_name,
            file_size=file_size,
            file_type=file_type,
        )

        saved_path = await save_upload(file, report.analysis_id)

        report = asv.run_image_analysis(report.analysis_id, saved_path)
        return report

    except DeepForgeException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc