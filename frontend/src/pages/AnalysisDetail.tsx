import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import AnalysisResults from "../components/AnalysisResults";
import GlassCard from "../components/GlassCard";
import { getAnalysis, apiErrorMessage } from "../lib/api";
import type { AnalysisReport } from "../lib/api";
import { formatBytes, formatTimestamp } from "../lib/format";
import { FileIcon, VideoIcon, MusicIcon, ChevronLeft, Copy, Download } from "lucide-react";

function getFileIcon(type: string) {
  if (type.startsWith("image/")) return <FileIcon className="w-4 h-4" aria-hidden="true" />;
  if (type.startsWith("video/")) return <VideoIcon className="w-4 h-4" aria-hidden="true" />;
  if (type.startsWith("audio/")) return <MusicIcon className="w-4 h-4" aria-hidden="true" />;
  return <FileIcon className="w-4 h-4" aria-hidden="true" />;
}

export default function AnalysisDetail() {
  const { id } = useParams<{ id: string }>();
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    getAnalysis(id)
      .then((data) => {
        if (!cancelled) setReport(data);
      })
      .catch((err) => {
        if (!cancelled) setError(apiErrorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between pt-2">
        <Link
          to="/history"
          className="btn-ghost"
        >
          <ChevronLeft className="w-4 h-4 mr-1" aria-hidden="true" />
          Back to history
        </Link>
        {id && (
          <div className="flex items-center gap-2">
            <span className="font-mono-tabular-xs text-text-muted">{id}</span>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(id)}
              className="btn-ghost p-1.5"
              title="Copy analysis ID"
            >
              <Copy className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      {error && (
        <GlassCard role="alert" className="border-verdict-manipulated/30 p-6 stagger-children">
          <h2 className="text-base font-semibold text-verdict-manipulated">Report unavailable</h2>
          <p className="mt-1 text-sm text-text-secondary">{error}</p>
          <Link to="/history" className="mt-4 btn-secondary inline-flex">
            <ChevronLeft className="w-4 h-4 mr-1" aria-hidden="true" />
            Back to history
          </Link>
        </GlassCard>
      )}

      {report && (
        <>
          {/* Report header */}
          <GlassCard className="p-5 sm:p-6 stagger-children">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="shrink-0 p-2.5 rounded-xl bg-white/5 border border-white/10">
                  {getFileIcon(report.file_type)}
                </div>
                <div>
                  <h1 className="text-lg font-semibold text-text-primary truncate">
                    {report.file_name}
                  </h1>
                  <p className="text-xs text-text-muted flex items-center gap-2">
                    <span className="font-mono-tabular-xs">{formatBytes(report.file_size_bytes)}</span>
                    <span>·</span>
                    <span className="status-pill status-pill-verified font-mono-tabular-xs">
                      {report.analysis_type.toUpperCase()}
                    </span>
                    <span>·</span>
                    <span>{formatTimestamp(report.created_at)}</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="btn-secondary"
                  title="Download report"
                >
                  <Download className="w-4 h-4 mr-1" aria-hidden="true" />
                  Export
                </button>
                <Link
                  to={`/analyze`}
                  className="btn-primary"
                >
                  New Analysis
                </Link>
              </div>
            </div>
          </GlassCard>

          {/* Analysis results */}
          <AnalysisResults
            report={report}
            analysisType={report.analysis_type as "image" | "video" | "audio"}
            phase="done"
            error={error}
            onNewAnalysis={() => {}}
          />
        </>
      )}
    </div>
  );
}