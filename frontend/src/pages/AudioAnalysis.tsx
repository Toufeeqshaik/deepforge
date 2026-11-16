import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, AudioLines, Info } from "lucide-react";
import UploadZone from "../components/UploadZone";
import GlassCard from "../components/GlassCard";
import { analyzeAudio, apiErrorMessage } from "../lib/api";
import type { AnalysisReport } from "../lib/api";
import { formatBytes } from "../lib/format";
import AnalysisResults from "../components/AnalysisResults";

const STAGES = ["Validating audio", "Decoding waveform", "Computing spectral features", "Compiling report"] as const;

type Phase = "idle" | "analyzing" | "done" | "error";

export default function AudioAnalysis() {
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

    stageTimer.current = window.setInterval(() => {
      setStageIndex((prev) => Math.min(prev + 1, STAGES.length - 1));
    }, 900);

    try {
      const result = await analyzeAudio(file);
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
          <span className="text-gradient">Audio Analysis</span>
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-text-secondary sm:text-base">
          Upload an audio file for experimental spectral analysis. DeepForge computes spectral
          centroid, bandwidth, zero-crossing rate, and spectral rolloff to produce a heuristic
          synthetic-speech indicator score. This is an experimental heuristic — not a validated
          deepfake detector.
        </p>
      </header>

      <div className="mx-auto max-w-3xl space-y-6">
        {phase === "idle" && (
          <GlassCard className="p-6 sm:p-8">
            <UploadZone file={file} onFileChange={setFile} />
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={startAnalysis}
                disabled={!file}
                className="bg-accent-gradient flex-1 rounded-xl px-6 py-3.5 text-sm font-semibold text-black shadow-lg transition-opacity disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
              >
                Run audio analysis
              </button>
              <button
                type="button"
                onClick={reset}
                className="glass rounded-xl px-6 py-3 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary focus-visible:outline-2 focus-visible:outline-accent-cyan"
              >
                Start over
              </button>
            </div>
            <p className="mt-4 text-[11px] leading-relaxed text-text-muted">
              <Info size={12} className="mt-0.5 shrink-0" />
              Supported: .mp3 · .wav · .ogg · .m4a · .aac — max 50 MB.
            </p>
          </GlassCard>
        )}

        {phase === "analyzing" && file && (
          <GlassCard className="p-6 sm:p-8" role="status">
            <div className="flex items-center gap-4">
              <div className="border-accent-cyan/30 border-t-accent-cyan h-9 w-9 shrink-0 rounded-full border-2 animate-spin" aria-hidden="true" />
              <div>
                <h2 className="text-base font-semibold text-text-primary">Analyzing audio…</h2>
                <p className="truncate text-xs text-text-muted">{file.name}</p>
              </div>
            </div>
            <div className="mt-6 border-t border-white/5 pt-6">
              <ol className="space-y-3" aria-live="polite">
                {STAGES.map((stage, i) => {
                  const active = i === stageIndex;
                  const done = i < stageIndex;
                  return (
                    <li key={stage} className="flex items-center gap-3">
                      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${
                        active || done ? "border-accent-cyan/45 text-accent-cyan" : "border-white/10 text-text-muted"
                      }`}>
                        {done ? (
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        ) : active ? (
                          <span className="bg-accent-cyan block h-2 w-2 rounded-full animate-pulse" />
                        ) : (
                          <span className="block h-2 w-2 rounded-full bg-current" aria-hidden="true" />
                        )}
                      </span>
                      <span className={`text-sm transition-colors ${
                        active ? "font-medium text-text-primary" : done ? "text-text-secondary" : "text-text-muted"
                      }`}>
                        {stage}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>
          </GlassCard>
        )}

        {phase === "error" && (
          <GlassCard role="alert" className="border-verdict-manipulated/30 p-6">
            <div className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-verdict-manipulated" aria-hidden="true">⚠</span>
              <div>
                <h2 className="text-base font-semibold text-verdict-manipulated">Analysis failed</h2>
                <p className="mt-1 text-sm text-text-secondary">{error}</p>
              </div>
            </div>
            <div className="mt-4 flex gap-3">
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
          </GlassCard>
        )}

        {phase === "done" && report && (
          <div className="space-y-6">
            <AnalysisResults report={report} />
            <div className="text-center">
              <button
                type="button"
                onClick={reset}
                className="glass rounded-xl px-6 py-3 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary focus-visible:outline-2 focus-visible:outline-accent-cyan"
              >
                Analyze another audio file
              </button>
            </div>
          </div>
        )}
      </div>

      {file && (
        <GlassCard className="p-5 sm:p-6">
          <h3 className="text-base font-semibold text-text-primary">Detector details</h3>
          <dl className="mt-3 grid gap-y-2 sm:grid-cols-2 gap-x-6">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-xs text-text-muted">Task</dt>
              <dd className="text-right font-mono text-[11px] text-text-secondary">Audio synthetic-speech indicators</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-xs text-text-muted">Method</dt>
              <dd className="text-right font-mono text-[11px] text-text-secondary">Spectral statistics (heuristic)</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-xs text-text-muted">Model</dt>
              <dd className="text-right font-mono text-[11px] text-text-secondary">None — experimental only</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-xs text-text-muted">Validated</dt>
              <dd className="text-right font-mono text-[11px] text-text-secondary">No — weak signal only</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-xs text-text-muted">File</dt>
              <dd className="text-right font-mono text-[11px] truncate text-text-secondary">{file.name}</dd>
            </div>
          </dl>
          <p className="mt-4 text-[11px] leading-relaxed text-text-muted">
            File size: {formatBytes(file.size)} · Results should be treated as weak signals only — this is
            not a validated deepfake detector.
          </p>
        </GlassCard>
      )}
    </div>
  );
}
