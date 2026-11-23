import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Info, X, RotateCcw, Zap, AlertTriangle } from "lucide-react";
import UploadZone from "../components/UploadZone";
import GlassCard from "../components/GlassCard";
import { analyzeVideo, apiErrorMessage } from "../lib/api";
import type { AnalysisReport } from "../lib/api";
import { formatBytes } from "../lib/format";
import AnalysisResults from "../components/AnalysisResults";

const STAGES = ["Validating video", "Sampling frames", "Running detectors", "Compiling report"] as const;

type Phase = "idle" | "analyzing" | "done" | "error";

function ProgressStages({ stageIndex }: { stageIndex: number }) {
  return (
    <ol className="space-y-3" aria-live="polite" role="list">
      {STAGES.map((stage, i) => {
        const active = i === stageIndex;
        const done = i < stageIndex;
        return (
          <li key={stage} className="flex items-center gap-3">
            <motion.span
              animate={{
                backgroundColor: done || active ? "rgba(34,211,238,0.15)" : "rgba(255,255,255,0.05)",
                borderColor: done || active ? "rgba(34,211,238,0.4)" : "rgba(255,255,255,0.1)",
              }}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-all duration-300"
            >
              {done ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-accent-cyan" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : active ? (
                <span className="bg-accent-cyan block h-2.5 w-2.5 rounded-full animate-pulse" aria-hidden="true" />
              ) : (
                <span className="block h-2.5 w-2.5 rounded-full bg-current opacity-30" aria-hidden="true" />
              )}
            </motion.span>
            <span className={`text-sm font-medium transition-colors ${
              active ? "text-text-primary" : done ? "text-text-secondary" : "text-text-muted"
            }`}>
              {stage}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export default function VideoAnalysis() {
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stageIndex, setStageIndex] = useState(0);
  const stageTimer = useRef<number | null>(null);
  const videoUrlRef = useRef<string | null>(null);

  const stopStageTimer = useCallback(() => {
    if (stageTimer.current !== null) {
      window.clearInterval(stageTimer.current);
      stageTimer.current = null;
    }
  }, []);

  useEffect(() => () => stopStageTimer(), [stopStageTimer]);

  const startAnalysis = async () => {
    if (!file) return;
    setPhase("analyzing");
    setError(null);
    setStageIndex(0);
    videoUrlRef.current = URL.createObjectURL(file);

    stageTimer.current = window.setInterval(() => {
      setStageIndex((prev) => Math.min(prev + 1, STAGES.length - 1));
    }, 900);

    try {
      const result = await analyzeVideo(file);
      stopStageTimer();
      setStageIndex(STAGES.length - 1);
      setReport(result);
      setPhase("done");
    } catch (err) {
      stopStageTimer();
      setError(apiErrorMessage(err));
      setPhase("error");
    }
  };

  const reset = () => {
    stopStageTimer();
    if (videoUrlRef.current) {
      URL.revokeObjectURL(videoUrlRef.current);
      videoUrlRef.current = null;
    }
    setFile(null);
    setReport(null);
    setError(null);
    setStageIndex(0);
    setPhase("idle");
  };

  useEffect(() => {
    return () => {
      if (videoUrlRef.current) {
        URL.revokeObjectURL(videoUrlRef.current);
      }
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* Header - left-aligned forensic tool layout */}
      <header className="pt-2 space-y-4" aria-labelledby="page-title">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-mono text-[11px] text-text-muted uppercase tracking-wider">DETECT / VIDEO</span>
          <span className="w-px h-4 bg-white/10 hidden sm:block" aria-hidden="true" />
          <span className="status-pill status-pill-available">Available</span>
        </div>
        <h1 id="page-title" className="text-3xl sm:text-4xl font-bold tracking-tight">
          Video Analysis
        </h1>
        <p className="text-text-secondary max-w-2xl text-base sm:text-lg leading-relaxed">
          Upload a video for frame-level analysis. DeepForge samples frames at uniform intervals and
          runs each through the configured image detector ensemble. Results are aggregated frame-level
          inferences — not a dedicated video model.
        </p>
      </header>

      <div className="w-full space-y-6">
        {/* Idle: Upload zone */}
        {phase === "idle" && (
          <AnimatePresence mode="wait">
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              <GlassCard className="p-6 sm:p-8 stagger-children">
                <UploadZone
                  file={file}
                  onFileChange={setFile}
                  accept=".mp4,.webm,.mov,.mkv,video/mp4,video/webm,video/quicktime"
                  maxSizeMB={250}
                  showFingerprint
                />
                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={startAnalysis}
                    disabled={!file}
                    className="btn-primary flex-1 min-w-[200px]"
                  >
                    <Zap className="w-4 h-4" aria-hidden="true" />
                    Run video analysis
                  </button>
                  <button
                    type="button"
                    onClick={reset}
                    className="btn-secondary"
                  >
                    <X className="w-4 h-4 mr-2" aria-hidden="true" />
                    Clear
                  </button>
                </div>
                <p className="mt-4 text-[11px] leading-relaxed text-text-muted flex items-center gap-1.5">
                  <Info size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
                  Supported: .mp4 · .webm · .mov · .mkv — max 250 MB. Processing may take several minutes
                  for longer videos because each sampled frame is run through the detector.
                </p>
              </GlassCard>
            </motion.div>
          </AnimatePresence>
        )}

        {/* Analyzing: Progress */}
        {phase === "analyzing" && file && (
          <AnimatePresence mode="wait">
            <motion.div
              key="analyzing"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="stagger-children"
            >
              <GlassCard className="p-6 sm:p-8" role="status" aria-live="polite">
                <div className="flex items-center gap-4">
                  <div className="border-accent-cyan/30 border-t-accent-cyan h-10 w-10 shrink-0 rounded-full border-2 animate-spin" aria-hidden="true" />
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold text-text-primary truncate">Analyzing video…</h2>
                    <p className="truncate text-xs text-text-muted">{file.name}</p>
                  </div>
                </div>
                <div className="mt-6 border-t border-white/5 pt-6">
                  <ProgressStages stageIndex={stageIndex} />
                </div>
              </GlassCard>
            </motion.div>
          </AnimatePresence>
        )}

        {/* Error */}
        {phase === "error" && (
          <AnimatePresence mode="wait">
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="stagger-children"
            >
              <GlassCard role="alert" className="border-verdict-manipulated/30 p-6">
                <div className="flex gap-3">
                  <div className="mt-0.5 shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-verdict-manipulated/10 border border-verdict-manipulated/20">
                    <AlertTriangle className="w-4 h-4 text-verdict-manipulated" aria-hidden="true" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-verdict-manipulated">Analysis failed</h2>
                    <p className="mt-1 text-sm text-text-secondary">{error}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={startAnalysis}
                    className="btn-primary"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" aria-hidden="true" />
                    Try again
                  </button>
                  <button
                    type="button"
                    onClick={reset}
                    className="btn-secondary"
                  >
                    <X className="w-4 h-4 mr-2" aria-hidden="true" />
                    Start over
                  </button>
                </div>
              </GlassCard>
            </motion.div>
          </AnimatePresence>
        )}

        {/* Done: Results */}
        {phase === "done" && report && (
          <AnimatePresence mode="wait">
            <motion.div
              key="done"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              <div className="space-y-6 stagger-children">
                <AnalysisResults
                  report={report}
                  analysisType="video"
                  phase={phase}
                  error={error}
                  videoUrl={videoUrlRef.current || undefined}
                  onNewAnalysis={reset}
                />
                <div className="text-center">
                  <button
                    type="button"
                    onClick={reset}
                    className="btn-secondary"
                  >
                    <X className="w-4 h-4 mr-2" aria-hidden="true" />
                    Analyze another video
                  </button>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        )}

        {/* Detector details panel - always visible when file selected */}
        {file && (
          <GlassCard className="p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-text-primary">Pipeline Configuration</h3>
              <span className="status-pill status-pill-available">1 Detector</span>
            </div>
            <dl className="grid gap-y-2 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-xs text-text-muted">Primary Task</dt>
                <dd className="text-right font-mono-tabular-xs text-text-secondary">Video face-swap detection</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-xs text-text-muted">Method</dt>
                <dd className="text-right font-mono-tabular-xs text-text-secondary">Uniform frame sampling</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-xs text-text-muted">Model</dt>
                <dd className="text-right font-mono-tabular-xs text-text-secondary">SimLBR Ensemble</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-xs text-text-muted">Backbone</dt>
                <dd className="text-right font-mono-tabular-xs text-text-secondary">DINOv3 ViT-L/16</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-xs text-text-muted">Input</dt>
                <dd className="text-right font-mono-tabular-xs text-text-secondary">224 × 224 RGB frames</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-xs text-text-muted">File</dt>
                <dd className="text-right font-mono-tabular-xs truncate max-w-[200px] text-text-secondary">{file.name}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-xs text-text-muted">Size</dt>
                <dd className="text-right font-mono-tabular-xs text-text-secondary">{formatBytes(file.size)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-xs text-text-muted">Fingerprint</dt>
                <dd className="text-right font-mono-tabular-xs truncate max-w-[200px] text-text-secondary">
                  SHA-256 computed
                </dd>
              </div>
            </dl>
            <p className="mt-4 text-[11px] leading-relaxed text-text-muted">
              Processing time scales with video duration — each sampled frame runs through the detector independently.
            </p>
          </GlassCard>
        )}
      </div>
    </div>
  );
}
