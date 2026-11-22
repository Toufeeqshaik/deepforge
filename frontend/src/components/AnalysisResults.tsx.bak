import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import VerdictBadge from "./VerdictBadge";
import GlassCard from "./GlassCard";
import type { AnalysisReport, DetectorResult } from "../lib/api";
import {
  formatBytes,
  formatDuration,
  formatPercent,
  formatScore,
  formatTimestamp,
} from "../lib/format";

function ModeToggle({
  mode,
  onChange,
}: {
  mode: "simple" | "advanced";
  onChange: (mode: "simple" | "advanced") => void;
}) {
  const isAdvanced = mode === "advanced";
  return (
    <div className="flex items-center gap-3">
      <span
        id="mode-label"
        className={`text-sm font-medium ${isAdvanced ? "text-text-muted" : "text-text-primary"}`}
      >
        Simple
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={isAdvanced}
        aria-labelledby="mode-label advanced-label"
        onClick={() => onChange(isAdvanced ? "simple" : "advanced")}
        className={`relative h-6 w-11 shrink-0 rounded-full border border-white/15 transition-colors focus-visible:outline-2 focus-visible:outline-accent-cyan ${
          isAdvanced ? "bg-accent-violet/40" : "bg-white/10"
        }`}
      >
        <motion.span
          layout
          transition={{ type: "spring", stiffness: 500, damping: 32 }}
          className={`absolute top-0.5 h-4.5 w-4.5 rounded-full bg-white shadow ${
            isAdvanced ? "right-0.5" : "left-0.5"
          }`}
        />
      </button>
      <span
        id="advanced-label"
        className={`text-sm font-medium ${isAdvanced ? "text-text-primary" : "text-text-muted"}`}
      >
        Advanced
      </span>
    </div>
  );
}

function DataRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-white/5 py-2 last:border-b-0">
      <dt className="shrink-0 text-xs text-text-muted">{label}</dt>
      <dd className="break-all text-right text-xs text-text-secondary">{value}</dd>
    </div>
  );
}

function DetailEntries({ details }: { details: Record<string, unknown> }) {
  const keys = Object.keys(details);
  if (keys.length === 0) return <p className="text-xs text-text-muted">No additional details.</p>;
  return (
    <dl>
      {keys.map((key) => {
        const value = details[key];
        const display =
          typeof value === "number" || typeof value === "string" || typeof value === "boolean"
            ? String(value)
            : JSON.stringify(value);
        return <DataRow key={key} label={key} value={display ?? "—"} />;
      })}
    </dl>
  );
}

function DetectorRow({ result }: { result: DetectorResult }) {
  return (
    <GlassCard hoverLift className="p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-sm font-medium text-text-primary">{result.detector_name}</p>
          <p className="font-mono text-xs text-text-muted">v{result.detector_version}</p>
        </div>
        <VerdictBadge verdict={result.verdict} size="sm" />
      </div>
      <dl className="mt-4 grid gap-x-8 sm:grid-cols-2">
        <DataRow label="Raw score" value={<span className="font-mono">{formatScore(result.raw_score)}</span>} />
        <DataRow
          label="Calibrated confidence"
          value={<span className="font-mono">{formatPercent(result.calibrated_confidence)}</span>}
        />
        <DataRow label="Processing time" value={formatDuration(result.processing_time_ms)} />
      </dl>
      <div className="mt-3 rounded-xl bg-black/20 p-3">
        <p className="mb-2 text-xs font-medium text-text-secondary">Details</p>
        <DetailEntries details={result.details} />
      </div>
      {result.limitations.length > 0 && (
        <ul className="mt-3 space-y-1">
          {result.limitations.map((limitation, i) => (
            <li key={i} className="text-xs text-text-muted">
              · {limitation}
            </li>
          ))}
        </ul>
      )}
    </GlassCard>
  );
}

function BulletList({ items, emptyText }: { items: string[]; emptyText: string }) {
  if (items.length === 0) {
    return <p className="text-sm text-text-muted">{emptyText}</p>;
  }
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5 text-sm text-text-secondary">
          <span aria-hidden="true" className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent-cyan" />
          {item}
        </li>
      ))}
    </ul>
  );
}

export default function AnalysisResults({ report }: { report: AnalysisReport }) {
  const [mode, setMode] = useState<"simple" | "advanced">("simple");
  const noDetectorsRun = report.detector_results.length === 0;

  return (
    <div className="space-y-6">
      {/* Header row: verdict + mode toggle */}
      <GlassCard className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-text-primary">Analysis Result</h2>
            <p className="max-w-xl text-xs text-text-muted">
              {report.file_name} — {formatTimestamp(report.created_at)}
            </p>
            <VerdictBadge verdict={report.overall_verdict} size="lg" className="mt-2" />
          </div>
          <ModeToggle mode={mode} onChange={setMode} />
        </div>
        <p className="mt-4 border-t border-white/5 pt-4 text-sm leading-relaxed text-text-secondary">
          {report.summary}
        </p>
      </GlassCard>

      {/* Honest inconclusive / no-models banner */}
      {noDetectorsRun && (
        <GlassCard
          role="status"
          className="border-verdict-uncertain/30 bg-verdict-uncertain/5 p-5"
        >
          <div className="flex gap-3">
            <svg
              className="mt-0.5 shrink-0 text-verdict-uncertain"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <div>
              <p className="text-sm font-medium text-verdict-uncertain">
                Detection models are being integrated — this analysis validated your file but no AI
                detectors have run yet.
              </p>
              <p className="mt-1 text-xs text-text-muted">
                No manipulation verdict should be inferred from this result. Check back once detector
                models are loaded.
              </p>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Simple mode */}
      {mode === "simple" ? (
        <AnimatePresence initial={false} mode="wait">
          <motion.div
            key="simple"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="space-y-6"
          >
            <GlassCard className="p-5 sm:p-6" delay={0.05}>
              <h3 className="text-base font-semibold text-text-primary">What this means</h3>
              <div className="mt-3 space-y-3 text-sm leading-relaxed text-text-secondary">
                {noDetectorsRun ? (
                  <>
                    <p>
                      Your file was received and validated, but DeepForge's AI detectors aren't
                      connected yet — so this result <strong className="text-text-primary">does not
                      tell you whether the media is authentic or manipulated</strong>.
                    </p>
                    <p>
                      An "Inconclusive" verdict here means "no evidence was collected," not "no
                      manipulation exists." Please don't treat this as a verdict either way.
                    </p>
                  </>
                ) : (
                  <>
                    <p>
                      DeepForge ran {report.detector_results.length} independent detector
                      {report.detector_results.length === 1 ? "" : "s"} and combined their evidence
                      into the verdict above.
                    </p>
                    <p>
                      This is a <strong className="text-text-primary">probabilistic indicator</strong>{" "}
                      based on statistical patterns — it can be wrong in both directions. Treat it as
                      one input to your own judgment, alongside context, provenance, and source
                      verification.
                    </p>
                  </>
                )}
              </div>
            </GlassCard>

            <GlassCard className="p-5 sm:p-6" delay={0.1}>
              <h3 className="text-base font-semibold text-text-primary">Limitations</h3>
              <div className="mt-3">
                <BulletList
                  items={report.limitations}
                  emptyText="No limitations were reported for this analysis."
                />
              </div>
            </GlassCard>
          </motion.div>
        </AnimatePresence>
      ) : (
        /* Advanced mode */
        <AnimatePresence initial={false} mode="wait">
          <motion.div
            key="advanced"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="space-y-6"
          >
            <div className="grid gap-6 lg:grid-cols-2">
              <GlassCard className="p-5 sm:p-6" delay={0.05}>
                <h3 className="text-base font-semibold text-text-primary">File metadata</h3>
                <dl className="mt-3">
                  <DataRow label="File name" value={report.file_name} />
                  <DataRow label="Size" value={formatBytes(report.file_size_bytes)} />
                  <DataRow label="Type" value={report.file_type} />
                  <DataRow label="Analysis type" value={report.analysis_type} />
                  <DataRow label="Status" value={report.status} />
                  <DataRow label="Created" value={formatTimestamp(report.created_at)} />
                  <DataRow label="Completed" value={formatTimestamp(report.completed_at)} />
                  <DataRow label="Total processing time" value={formatDuration(report.processing_time_ms)} />
                  <DataRow
                    label="Analysis ID"
                    value={<span className="font-mono text-accent-cyan">{report.analysis_id}</span>}
                  />
                </dl>
              </GlassCard>

              <GlassCard className="p-5 sm:p-6" delay={0.1}>
                <h3 className="text-base font-semibold text-text-primary">Forensic indicators</h3>
                <div className="mt-3">
                  <BulletList
                    items={report.forensic_indicators}
                    emptyText="No forensic indicators were recorded."
                  />
                </div>
                <h3 className="mt-6 text-base font-semibold text-text-primary">Limitations</h3>
                <div className="mt-3">
                  <BulletList
                    items={report.limitations}
                    emptyText="No limitations were reported for this analysis."
                  />
                </div>
              </GlassCard>
            </div>

            <div className="space-y-4">
              <h3 className="text-base font-semibold text-text-primary">
                Detector results{" "}
                <span className="font-mono text-xs font-normal text-text-muted">
                  ({report.detector_results.length})
                </span>
              </h3>
              {report.detector_results.length === 0 ? (
                <GlassCard className="p-5 text-sm text-text-muted">
                  No detectors have run on this analysis yet. This section will populate as detector
                  models are integrated.
                </GlassCard>
              ) : (
                report.detector_results.map((result) => (
                  <DetectorRow key={result.detector_name} result={result} />
                ))
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}
