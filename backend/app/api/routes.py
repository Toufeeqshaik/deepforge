from __future__ import annotations

import time

from fastapi import APIRouter, HTTPException, UploadFile

from app.core.exceptions import DeepForgeException
from app.schemas.analysis import AnalysisReport, HealthResponse
from app.services import analysis_service
from app.services.detection_service import detection_service
from app.services.file_service import (
    get_image_metadata,
    validate_image_file,
    save_upload,
)

router = APIRouter(prefix="/api")

# Populated by main.py at startup
_startup_time: float = 0.0


def set_startup_time(t: float) -> None:
    """Record application start timestamp (called once at startup)."""
    global _startup_time
    _startup_time = t


@router.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """Return platform health status, loaded models, and uptime."""
    models_loaded = []
    if detection_service.is_available:
        models_loaded.append("Xicor9/efficientnet-b0-ffpp-c23")  # Face-swap deepfake detector
    elif hasattr(detection_service, "_load_error") and detection_service._load_error:
        models_loaded.append(f"model_error:{detection_service._load_error}")

    return HealthResponse(
        status="healthy",
        version="0.1.0",
        models_loaded=models_loaded,
        uptime_seconds=round(time.time() - _startup_time, 2),
    )


@router.post("/analyze/image", response_model=AnalysisReport)
async def analyze_image(file: UploadFile) -> AnalysisReport:
    """Upload an image for deepfake / manipulation analysis.

    The file is validated, persisted, and then run through the analysis
    pipeline (placeholder until detection models are integrated).
    """
    try:
        await validate_image_file(file)

        content = await file.read()
        file_size = len(content)
        await file.seek(0)

        file_name = file.filename or "upload"
        file_type = file.content_type or "application/octet-stream"

        report = analysis_service.create_analysis(
            file_path=None,  # type: ignore[arg-type]
            file_name=file_name,
            file_size=file_size,
            file_type=file_type,
        )

        saved_path = await save_upload(file, report.analysis_id)

        report = analysis_service.run_image_analysis(report.analysis_id, saved_path)
        return report

    except DeepForgeException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/analysis/{analysis_id}", response_model=AnalysisReport)
async def get_analysis(analysis_id: str) -> AnalysisReport:
    """Retrieve the analysis report for a given analysis ID."""
    report = analysis_service.get_analysis(analysis_id)
    if report is None:
        raise HTTPException(status_code=404, detail="Analysis not found")
    return report


@router.get("/analyses", response_model=list[AnalysisReport])
async def list_analyses() -> list[AnalysisReport]:
    """List all analyses, most recent first."""
    return analysis_service.get_all_analyses()


@router.get("/analysis/{analysis_id}/report", response_model=AnalysisReport)
async def get_analysis_report(analysis_id: str) -> AnalysisReport:
    """Retrieve the full analysis report (PDF generation coming later)."""
    report = analysis_service.get_analysis(analysis_id)
    if report is None:
        raise HTTPException(status_code=404, detail="Analysis not found")
    return report
