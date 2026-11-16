import axios from "axios";

/* ---- API contract types ---- */

export type AnalysisStatus = "pending" | "processing" | "completed" | "failed";

export type AnalysisType = "image" | "video" | "audio";

export type OverallVerdict =
  | "likely_authentic"
  | "uncertain"
  | "potentially_manipulated"
  | "likely_manipulated"
  | "inconclusive";

export interface DetectorResult {
  detector_name: string;
  detector_version: string;
  verdict: string;
  raw_score: number;
  calibrated_confidence: number | null;
  processing_time_ms: number;
  details: Record<string, unknown>;
  limitations: string[];
}

export interface AnalysisReport {
  analysis_id: string;
  status: AnalysisStatus;
  analysis_type: AnalysisType;
  created_at: string;
  completed_at: string | null;
  file_name: string;
  file_size_bytes: number;
  file_type: string;
  overall_verdict: OverallVerdict;
  summary: string;
  detector_results: DetectorResult[];
  forensic_indicators: string[];
  limitations: string[];
  processing_time_ms: number;
  metadata: Record<string, unknown>;
}

export interface HealthResponse {
  status: string;
  version: string;
  models_loaded: string[];
  uptime_seconds: number;
}

/* ---- Typed client ---- */

const client = axios.create({
  baseURL: "/api",
  timeout: 120_000,
});

export async function getHealth(): Promise<HealthResponse> {
  const { data } = await client.get<HealthResponse>("/health");
  return data;
}

export async function analyzeImage(file: File): Promise<AnalysisReport> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await client.post<AnalysisReport>("/analyze/image", form);
  return data;
}

export async function analyzeVideo(file: File): Promise<AnalysisReport> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await client.post<AnalysisReport>("/analyze/video", form);
  return data;
}

export async function analyzeAudio(file: File): Promise<AnalysisReport> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await client.post<AnalysisReport>("/analyze/audio", form);
  return data;
}

export async function getAnalysis(id: string): Promise<AnalysisReport> {
  const { data } = await client.get<AnalysisReport>(`/analysis/${id}`);
  return data;
}

export async function getAnalyses(): Promise<AnalysisReport[]> {
  const { data } = await client.get<AnalysisReport[]>("/analyses");
  return data;
}

/** Human-readable message from an unknown axios/network error. */
export function apiErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const detail =
      (err.response?.data as { detail?: string; message?: string } | undefined)
        ?.detail ??
      (err.response?.data as { message?: string } | undefined)?.message;
    if (typeof detail === "string" && detail.length > 0) return detail;
    if (err.response) return `Server responded with status ${err.response.status}.`;
    if (err.request) return "Could not reach the analysis service. Is the backend running?";
  }
  if (err instanceof Error && err.message) return err.message;
  return "Something went wrong.";
}
