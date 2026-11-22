import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import VerdictBadge from "../components/VerdictBadge";
import GlassCard from "../components/GlassCard";
import { getAnalyses, apiErrorMessage } from "../lib/api";
import type { AnalysisReport } from "../lib/api";
import { formatDuration, formatTimestamp } from "../lib/format";
import { FileIcon, VideoIcon, MusicIcon, ChevronRight } from "lucide-react";

function getFileIcon(type: string) {
  if (type.startsWith("image/")) return <FileIcon className="w-4 h-4" aria-hidden="true" />;
  if (type.startsWith("video/")) return <VideoIcon className="w-4 h-4" aria-hidden="true" />;
  if (type.startsWith("audio/")) return <MusicIcon className="w-4 h-4" aria-hidden="true" />;
  return <FileIcon className="w-4 h-4" aria-hidden="true" />;
}

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
        <GlassCard role="alert" className="border-verdict-manipulated/30 p-6 stagger-children">
          <h2 className="text-base font-semibold text-verdict-manipulated">Could not load history</h2>
          <p className="mt-1 text-sm text-text-secondary">{error}</p>
        </GlassCard>
      )}

      {analyses === null && !error && (
        <div className="card-grid-3" aria-busy="true" aria-live="polite">
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
        <GlassCard className="w-full p-8 text-center stagger-children">
          <h2 className="text-base font-semibold text-text-primary">No analyses yet</h2>
          <p className="mt-2 text-sm text-text-secondary">
            Run your first analysis and it will appear here.
          </p>
          <Link
            to="/analyze"
            className="btn-primary mt-5 inline-block"
          >
            Analyze Media
          </Link>
        </GlassCard>
      )}

      {analyses !== null && analyses.length > 0 && (
        <div className="card-grid-3 stagger-children">
          {analyses.map((analysis, i) => (
            <GlassCard key={analysis.analysis_id} hoverLift delay={Math.min(i, 8) * 0.05} className="p-5">
              <Link
                to={`/analysis/${analysis.analysis_id}`}
                className="flex h-full flex-col rounded-xl focus-visible:outline-2 focus-visible:outline-accent-cyan"
              >
                <div className="flex items-start gap-2">
                  <div className="shrink-0 p-1.5 rounded-lg bg-white/5 border border-white/10">
                    {getFileIcon(analysis.file_type)}
                  </div>
                  <p className="truncate text-sm font-medium text-text-primary" title={analysis.file_name}>
                    {analysis.file_name}
                  </p>
                </div>
                <div className="mt-3">
                  <VerdictBadge verdict={analysis.overall_verdict} size="sm" />
                </div>
                <div className="mt-auto flex items-end justify-between gap-3 pt-2 border-t border-white/5">
                  <div className="space-y-0.5 text-xs text-text-muted">
                    <p>{formatTimestamp(analysis.created_at)}</p>
                    <p className="font-mono-tabular-xs">processed in {formatDuration(analysis.processing_time_ms)}</p>
                  </div>
                  <span
                    aria-hidden="true"
                    className="text-accent-cyan transition-transform duration-200 group-hover:translate-x-1"
                  >
                    <ChevronRight size={15} />
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
