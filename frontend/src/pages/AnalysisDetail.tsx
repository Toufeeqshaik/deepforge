import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import AnalysisResults from "../components/AnalysisResults";
import GlassCard from "../components/GlassCard";
import { getAnalysis, apiErrorMessage } from "../lib/api";
import type { AnalysisReport } from "../lib/api";

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
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-text-secondary transition-colors hover:text-text-primary focus-visible:outline-2 focus-visible:outline-accent-cyan"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          Back to history
        </Link>
        {id && <span className="font-mono text-xs text-text-muted">{id}</span>}
      </div>

      <h1 className="sr-only">Analysis report for {report?.file_name ?? "analysis " + (id ?? "")}</h1>

      {error && (
        <GlassCard role="alert" className="border-verdict-manipulated/30 p-6">
          <h2 className="text-base font-semibold text-verdict-manipulated">Report unavailable</h2>
          <p className="mt-1 text-sm text-text-secondary">{error}</p>
        </GlassCard>
      )}

      {report && (
        <AnalysisResults
          report={report}
          analysisType={report.analysis_type as "image" | "video" | "audio"}
          phase="done"
          error={error}
          onNewAnalysis={() => {}}
        />
      )}
    </div>
  );
}
