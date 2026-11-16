from __future__ import annotations

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class AnalysisStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class AnalysisType(str, Enum):
    IMAGE = "image"
    VIDEO = "video"
    AUDIO = "audio"


class MediaType(str, Enum):
    IMAGE = "image"
    VIDEO = "video"
    AUDIO = "audio"


class VerdictLevel(str, Enum):
    LIKELY_AUTHENTIC = "likely_authentic"
    UNCERTAIN = "uncertain"
    POTENTIALLY_MANIPULATED = "potentially_manipulated"
    LIKELY_MANIPULATED = "likely_manipulated"
    INCONCLUSIVE = "inconclusive"


class DetectorResult(BaseModel):
    detector_name: str
    detector_version: str
    verdict: VerdictLevel
    raw_score: float = Field(ge=0.0, le=1.0, description="Raw model output score")
    calibrated_confidence: float | None = Field(
        default=None, ge=0.0, le=1.0, description="Calibrated confidence, if available"
    )
    processing_time_ms: float
    details: dict = Field(default_factory=dict)
    limitations: list[str] = Field(default_factory=list)


class AnalysisReport(BaseModel):
    analysis_id: str
    status: AnalysisStatus
    analysis_type: AnalysisType
    created_at: datetime
    completed_at: datetime | None = None
    file_name: str
    file_size_bytes: int
    file_type: str
    overall_verdict: VerdictLevel
    summary: str
    detector_results: list[DetectorResult] = Field(default_factory=list)
    forensic_indicators: list[str] = Field(default_factory=list)
    limitations: list[str] = Field(default_factory=list)
    processing_time_ms: float
    metadata: dict = Field(default_factory=dict)


class AnalysisRequest(BaseModel):
    analysis_type: AnalysisType = AnalysisType.IMAGE
    options: dict = Field(default_factory=dict)


class AnalysisStatusResponse(BaseModel):
    analysis_id: str
    status: AnalysisStatus
    progress: float = Field(ge=0.0, le=100.0, default=0.0)
    message: str = ""


class HealthResponse(BaseModel):
    status: str
    version: str
    models_loaded: list[str] = Field(default_factory=list)
    uptime_seconds: float
