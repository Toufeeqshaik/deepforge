import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import UploadZone from "../components/UploadZone";
import AnalysisResults from "../components/AnalysisResults";
import GlassCard from "../components/GlassCard";
import { analyzeImage, apiErrorMessage } from "../lib/api";
import type { AnalysisReport } from "../lib/api";

const STAGES = ["Validating", "Preprocessing", "Running detectors", "Compiling report"] as const;

type Phase = "idle" | "analyzing" | "done" | "error";

function ProgressStages({ stageIndex }: { stageIndex: number }) {
  return (
    <ol className="space-y-3" aria-live="polite">
      {STAGES.map((stage, i) => {
        const active = i === stageIndex;
        const done = i < stageIndex;
        return (
          <li key={stage} className="flex items-center gap-3">
            <motion.span
              animate={{
                backgroundColor: done || active ? "rgba(34,211,238,0.15)" : "rgba(255,255,255,0.05)",
                borderColor: done || active ? "rgba(34,211,238,0.45)" : "rgba(255,255,255,0.1)",
              }}
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${
                active ? "text-accent-cyan" : done ? "text-accent-cyan" : "text-text-muted"
              }`}
            >
              {done ? (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : active ? (
                <motion.span
                  className="bg-accent-cyan block h-2 w-2 rounded-full"
                  animate={{ scale: [1, 1.4, 1], opacity: [1, 0.6, 1] }}
                  transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
                />
              ) : (
                <span className="block h-2 w-2 rounded-full bg-current" aria-hidden="true" />
              )}
            </motion.span>
            <span
              className={`text-sm transition-colors ${
                active ? "font-medium text-text-primary" : done ? "text-text-secondary" : "text-text-muted"
              }`}
            >
              {stage}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export default function Analyze() {
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stageIndex, setStageIndex] = useState(0);
  const stageTimer = useRef<number | null>(null);

  const stopStageTimer = useCallback(() => {
    if (stageTimer.current !== null) {
      window.clearInterval(stageTimer.current);
      stageTimer.current = null;
    }
  }, []);

  useEffect(() => stopStageTimer, [stopStageTimer]);

  const startAnalysis = async () => {
    if (!file) return;
    setPhase("analyzing");
    setError(null);
    setStageIndex(0);

    // Advance the visible pipeline while the request is in flight.
    stageTimer.current = window.setInterval(() => {
      setStageIndex((prev) => Math.min(prev + 1, STAGES.length - 1));
    }, 900);

    try {
      const result = await analyzeImage(file);
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
    setFile(null);
    setReport(null);
    setError(null);
    setStageIndex(0);
    setPhase("idle");
  };

  return (
    <div className="space-y-8">
      <header className="pt-2 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          <span className="text-gradient">Analyze Media</span>
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-text-secondary sm:text-base">
          Upload an image to run forensic analysis. You'll receive an evidence report with an honest
          account of what the detectors did — and didn't — find.
        </p>
      </header>

      <AnimatePresence mode="wait">
        {phase === "idle" && (
          <motion.div
            key="idle"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="mx-auto max-w-3xl space-y-5"
          >
            <UploadZone file={file} onFileChange={setFile} />
            <motion.button
              type="button"
              onClick={startAnalysis}
              disabled={!file}
              whileHover={file ? { scale: 1.02 } : undefined}
              whileTap={file ? { scale: 0.98 } : undefined}
              className="bg-accent-gradient w-full rounded-xl px-6 py-3.5 text-sm font-semibold text-black shadow-lg transition-opacity focus-visible:outline-2 focus-visible:outline-accent-cyan disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
            >
              Start Analysis
            </motion.button>
          </motion.div>
        )}

        {phase === "analyzing" && (
          <motion.div
            key="analyzing"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="mx-auto max-w-3xl"
          >
            <GlassCard className="p-6 sm:p-8" role="status">
              <div className="flex items-center gap-4">
                <motion.div
                  className="border-accent-cyan/30 border-t-accent-cyan h-9 w-9 shrink-0 rounded-full border-2"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  aria-hidden="true"
                />
                <div>
                  <h2 className="text-base font-semibold text-text-primary">Analyzing your image…</h2>
                  <p className="truncate text-xs text-text-muted">{file?.name}</p>
                </div>
              </div>
              <div className="mt-6 border-t border-white/5 pt-6">
                <ProgressStages stageIndex={stageIndex} />
              </div>
            </GlassCard>
          </motion.div>
        )}

        {phase === "error" && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="mx-auto max-w-3xl space-y-5"
          >
            <GlassCard role="alert" className="border-verdict-manipulated/30 p-6">
              <div className="flex gap-3">
                <svg
                  className="mt-0.5 shrink-0 text-verdict-manipulated"
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
                  <h2 className="text-base font-semibold text-verdict-manipulated">
                    Analysis failed
                  </h2>
                  <p className="mt-1 text-sm text-text-secondary">{error}</p>
                </div>
              </div>
            </GlassCard>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={startAnalysis}
                className="bg-accent-gradient rounded-xl px-6 py-3 text-sm font-semibold text-black shadow-lg focus-visible:outline-2 focus-visible:outline-accent-cyan"
              >
                Try again
              </button>
              <button
                type="button"
                onClick={reset}
                className="glass rounded-xl px-6 py-3 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary focus-visible:outline-2 focus-visible:outline-accent-cyan"
              >
                Start over
              </button>
            </div>
          </motion.div>
        )}

        {phase === "done" && report && (
          <motion.div
            key="done"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="space-y-6"
          >
            <AnalysisResults report={report} />
            <div className="text-center">
              <button
                type="button"
                onClick={reset}
                className="glass rounded-xl px-6 py-3 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary focus-visible:outline-2 focus-visible:outline-accent-cyan"
              >
                Analyze another image
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
