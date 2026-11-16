import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import VerdictBadge from "../components/VerdictBadge";
import GlassCard from "../components/GlassCard";
import { getAnalyses, apiErrorMessage } from "../lib/api";
import type { AnalysisReport } from "../lib/api";
import { formatDuration, formatTimestamp } from "../lib/format";

export default function History() {
  const [analyses, setAnalyses] = useState<AnalysisReport[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAnalyses()
      .then((data) => {
        if (!cancelled) setAnalyses(data);
      })
      .catch((err) => {
        if (!cancelled) setError(apiErrorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-8">
      <header className="pt-2 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          <span className="text-gradient">Analysis History</span>
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-text-secondary sm:text-base">
          Every analysis run through DeepForge appears here — open any card to revisit its full
          evidence report.
        </p>
      </header>

      {error && (
        <GlassCard role="alert" className="border-verdict-manipulated/30 p-6">
          <h2 className="text-base font-semibold text-verdict-manipulated">Could not load history</h2>
          <p className="mt-1 text-sm text-text-secondary">{error}</p>
        </GlassCard>
      )}

      {analyses === null && !error && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-live="polite">
          {[0, 1, 2].map((i) => (
            <GlassCard key={i} className="animate-pulse p-5" delay={i * 0.06}>
              <div className="h-4 w-3/4 rounded bg-white/10" />
              <div className="mt-3 h-5 w-28 rounded-full bg-white/10" />
              <div className="mt-4 h-3 w-1/2 rounded bg-white/5" />
            </GlassCard>
          ))}
        </div>
      )}

      {analyses !== null && analyses.length === 0 && (
        <GlassCard className="mx-auto max-w-xl p-8 text-center">
          <h2 className="text-base font-semibold text-text-primary">No analyses yet</h2>
          <p className="mt-2 text-sm text-text-secondary">
            Run your first analysis and it will appear here.
          </p>
          <Link
            to="/analyze"
            className="bg-accent-gradient mt-5 inline-block rounded-xl px-6 py-2.5 text-sm font-semibold text-black shadow-lg focus-visible:outline-2 focus-visible:outline-accent-cyan"
          >
            Analyze Media
          </Link>
        </GlassCard>
      )}

      {analyses !== null && analyses.length > 0 && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {analyses.map((analysis, i) => (
            <GlassCard key={analysis.analysis_id} hoverLift delay={Math.min(i, 6) * 0.05} className="p-5">
              <Link
                to={`/analysis/${analysis.analysis_id}`}
                className="flex h-full flex-col rounded-xl focus-visible:outline-2 focus-visible:outline-accent-cyan"
              >
                <p className="truncate text-sm font-medium text-text-primary" title={analysis.file_name}>
                  {analysis.file_name}
                </p>
                <div className="mt-3">
                  <VerdictBadge verdict={analysis.overall_verdict} size="sm" />
                </div>
                <div className="mt-4 flex items-end justify-between gap-3 pt-2">
                  <div className="space-y-0.5 text-xs text-text-muted">
                    <p>{formatTimestamp(analysis.created_at)}</p>
                    <p className="font-mono">processed in {formatDuration(analysis.processing_time_ms)}</p>
                  </div>
                  <span
                    aria-hidden="true"
                    className="text-accent-cyan transition-transform duration-200"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  </span>
                </div>
              </Link>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
