import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import VerdictBadge from "./VerdictBadge";
import GlassCard from "./GlassCard";
import EvidenceCard from "./EvidenceCard";
import type { AnalysisReport } from "../lib/api";
import {
  formatBytes,
  formatDuration,
  formatPercent,
  formatScore,
  formatTimestamp,
} from "../lib/format";
import { getVerdictMeta } from "../lib/verdicts";
import {
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  BarChart,
  Image as ImageIcon,
  Video as VideoIcon,
  Music as MusicIcon,
  Shield,
  Eye,
  Search,
  RotateCcw,
  ChevronDown,
  HelpCircle,
  Info,
  FileSignature,
  Image as ImageIconLucide,
  Brain,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

/* ============================================================================
   Type definitions
   ========================================================================== */
type AnalysisType = "image" | "video" | "audio";
type VerdictLevel = "likely_authentic" | "uncertain" | "potentially_manipulated" | "likely_manipulated" | "inconclusive";

interface PerModelResult {
  name: string;
  prediction: "real" | "fake" | "uncertain";
  confidence: number;
  processingTimeMs: number;
  details?: Record<string, unknown>;
}

interface VideoFrameData {
  frameIndex: number;
  timestamp: number;
  fakeScore: number;
  hasFace: boolean;
}

interface ScoreGaugeProps {
  score: number | null;
  className?: string;
}

interface VerdictCardProps {
  verdict: VerdictLevel;
  score: number | null;
  analysisType: AnalysisType;
  className?: string;
}

interface PerModelBreakdownProps {
  models: PerModelResult[];
  className?: string;
}

interface HeatmapProps {
  heatmapBase64?: string;
  available: boolean;
  className?: string;
}

interface VideoChartProps {
  frameData: VideoFrameData[];
  videoRef: React.RefObject<HTMLVideoElement | null>;
  className?: string;
}

interface LoadingSkeletonProps {
  variant?: "card" | "gauge" | "chart" | "verdict" | "breakdown";
  className?: string;
}

interface ErrorStateProps {
  title: string;
  message: string;
  onRetry: () => void;
  className?: string;
}

interface EmptyStateProps {
  analysisType: AnalysisType;
  onAnalyze: () => void;
  disabled?: boolean;
  className?: string;
}

/* ============================================================================
   Utility functions
   ========================================================================== */
function getVerdictIcon(verdict: VerdictLevel) {
  switch (verdict) {
    case "likely_authentic":
      return <CheckCircle className="w-6 h-6 text-verdict-authentic" aria-hidden="true" />;
    case "uncertain":
      return <HelpCircle className="w-6 h-6 text-verdict-uncertain" aria-hidden="true" />;
    case "potentially_manipulated":
    case "likely_manipulated":
      return <AlertCircle className="w-6 h-6 text-verdict-manipulated" aria-hidden="true" />;
    default:
      return <AlertTriangle className="w-6 h-6 text-text-muted" aria-hidden="true" />;
  }
}



function extractPerModelResults(report: AnalysisReport): PerModelResult[] {
  return report.detector_results.map((d) => {
    const details = d.details as Record<string, unknown> | undefined;
    const perModelDetails = details?.per_model_details as string | undefined;
    let models: PerModelResult[] = [];
    
    if (perModelDetails) {
      try {
        // Parse the per_model_details string if it's JSON
        const parsed = JSON.parse(perModelDetails);
        if (Array.isArray(parsed)) {
          models = parsed;
        }
      } catch {
        // Ignore parse errors
      }
    }
    
    // If we couldn't parse, create a single entry from the detector result
    if (models.length === 0) {
      models = [{
        name: d.detector_name,
        prediction: d.raw_score >= 0.5 ? "fake" : d.raw_score >= 0.35 ? "uncertain" : "real",
        confidence: d.calibrated_confidence ?? d.raw_score,
        processingTimeMs: d.processing_time_ms,
        details: d.details,
      }];
    }
    
    return models;
  }).flat();
}

function extractVideoFrameData(report: AnalysisReport): VideoFrameData[] {
  const detector = report.detector_results[0];
  if (!detector) return [];
  
  const details = detector.details as Record<string, unknown> | undefined;
  const frameResults = details?.frame_results as Array<{
    frame_index: number;
    label: string;
    raw_score: number;
    calibrated_confidence: number | null;
  }> | undefined;
  
  if (!frameResults) return [];
  
  const metadata = report.metadata as Record<string, unknown> | undefined;
  const fps = (metadata?.fps as number) || 30;
  
  return frameResults.map((f) => ({
    frameIndex: f.frame_index,
    timestamp: f.frame_index / fps,
    fakeScore: f.raw_score,
    hasFace: true, // We could enhance this with actual face detection data
  }));
}

function getCombinedScore(report: AnalysisReport): number | null {
  const detector = report.detector_results[0];
  if (!detector) return null;
  const details = detector.details as Record<string, unknown> | undefined;
  const combinedScore = details?.combined_score as number | null | undefined;
  return combinedScore ?? detector.raw_score;
}

/* ============================================================================
   Score Gauge Component
   ========================================================================== */
function ScoreGauge({ score, className = "" }: ScoreGaugeProps) {
  const percentage = score !== null ? Math.round(score * 100) : 0;
  const isIndeterminate = score === null;
  
  // Determine gauge color based on thresholds
  let gaugeColor = "bg-verdict-authentic"; // REAL < 0.35
  if (score !== null) {
    if (score > 0.65) gaugeColor = "bg-verdict-manipulated"; // FAKE > 0.65
    else if (score >= 0.35) gaugeColor = "bg-verdict-uncertain"; // UNCERTAIN 0.35-0.65
  }
  
  return (
    <div className={`relative ${className}`} role="img" aria-label={`Detector score: ${isIndeterminate ? "unavailable" : `${percentage}%`}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-text-primary">Detector Score</span>
        <span className="font-mono text-lg text-text-primary">
          {isIndeterminate ? "—" : `${percentage}%`}
        </span>
      </div>
      
      <div className="relative h-6 rounded-full bg-white/5 overflow-hidden" aria-hidden="true">
        {/* Background threshold zones */}
        <div className="absolute inset-0 flex" aria-hidden="true">
          <div className="bg-verdict-authentic/30" style={{ width: "35%" }} />
          <div className="bg-verdict-uncertain/30" style={{ width: "30%" }} />
          <div className="bg-verdict-manipulated/30" style={{ width: "35%" }} />
        </div>
        
        {/* Threshold markers */}
        <div className="absolute inset-0 flex" aria-hidden="true">
          <div className="absolute top-0 bottom-0 w-px bg-white/30" style={{ left: "35%" }} />
          <div className="absolute top-0 bottom-0 w-px bg-white/30" style={{ left: "65%" }} />
        </div>
        
        {/* Score indicator */}
        {!isIndeterminate && (
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className={`absolute top-0 bottom-0 ${gaugeColor} rounded-full transition-all duration-500`}
            style={{ width: `${percentage}%` }}
          />
        )}
        
        {/* Center marker for current score */}
        {!isIndeterminate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.3 }}
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white border-2 border-zinc-900 shadow-lg"
            style={{ left: `${percentage}%`, marginLeft: -6 }}
            aria-hidden="true"
          />
        )}
        
        {isIndeterminate && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-full w-full bg-gradient-to-r from-white/5 via-white/10 to-white/5 animate-pulse" />
          </div>
        )}
      </div>
      
      {/* Threshold labels */}
      <div className="flex justify-between mt-2 text-[10px] text-text-muted font-mono">
        <span>REAL</span>
        <span>UNCERTAIN</span>
        <span>FAKE</span>
      </div>
      
      <div className="flex justify-between mt-1 text-[10px] text-text-muted font-mono">
        <span>{'\u003C 35%'}</span>
        <span>{'35\u201365%'}</span>
        <span>{'\u003E 65%'}</span>
      </div>

      <p className="mt-3 text-[10px] leading-relaxed text-text-muted">
        Single-number orientation only. Independent detector signals are reported separately
        below — this score is not proof of authenticity, and missing signals are not proof either.
      </p>
    </div>
  );
}

/* ============================================================================
   Verdict Card Component
   ========================================================================== */
function VerdictCard({ verdict, score, analysisType, className = "" }: VerdictCardProps) {
  const meta = getVerdictMeta(verdict);
  const icon = getVerdictIcon(verdict);
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={`relative p-6 rounded-2xl border ${meta.bg} ${meta.border} ${className}`}
      role="region"
      aria-label={`Verdict: ${meta.label}`}
    >
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 p-3 rounded-xl bg-white/5 border border-white/10">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-bold text-text-primary">{meta.label}</h3>
            <span className="px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider rounded-full bg-white/10 text-text-muted">
              {analysisType.toUpperCase()}
            </span>
          </div>
          <p className="mt-2 text-sm text-text-secondary">
            {verdict === "likely_authentic" && "The analysis indicates this media is likely authentic."}
            {verdict === "uncertain" && "The analysis could not confidently determine authenticity. Evidence is mixed or inconclusive."}
            {(verdict === "potentially_manipulated" || verdict === "likely_manipulated") && "The analysis indicates this media is likely manipulated or AI-generated."}
            {verdict === "inconclusive" && "No analysis could be performed. Detection models may not be available."}
          </p>
          {score !== null && (
            <p className="mt-3 text-sm font-mono text-text-primary">
              Detector fake probability: {(score * 100).toFixed(1)}%
              <span className="ml-2 font-sans text-[11px] font-normal text-text-muted">
                (orientation only — read the independent signals)
              </span>
            </p>
          )}
        </div>
      </div>
      
      {/* Disclaimer */}
      <div className="mt-4 pt-4 border-t border-white/10 flex items-center gap-2 text-xs text-text-muted">
        <Shield className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span>This is an indicator, not proof. Treat results as one input alongside context, provenance, and source verification.</span>
      </div>
    </motion.div>
  );
}

/* ============================================================================
   Per-Model Breakdown Component
   ========================================================================== */
function PerModelBreakdown({ models, className = "" }: PerModelBreakdownProps) {
  if (models.length === 0) return null;
  
  return (
    <GlassCard className={`p-5 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-text-primary flex items-center gap-2">
          <BarChart className="w-5 h-5" aria-hidden="true" />
          Per-Model Breakdown
        </h3>
        <span className="text-xs font-mono text-text-muted">{models.length} model{models.length !== 1 ? "s" : ""}</span>
      </div>
      
      <div className="space-y-3" role="list" aria-label="Model results">
        {models.map((model, i) => (
          <motion.div
            key={`${model.name}-${i}`}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1, duration: 0.3 }}
            className="flex items-center gap-4 p-3 rounded-xl bg-white/5 border border-white/5"
            role="listitem"
          >
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center">
              <Search className="w-5 h-5 text-text-muted" aria-hidden="true" />
            </div>
            
            <div className="flex-1 min-w-0">
              <p className="font-mono text-sm font-medium text-text-primary truncate">{model.name}</p>
              <p className="text-xs text-text-muted truncate">
                {model.prediction === "real" ? "Predicts: Real" : model.prediction === "fake" ? "Predicts: Fake" : "Predicts: Uncertain"}
              </p>
            </div>
            
            <div className="flex items-center gap-3 text-right">
              <div className="hidden sm:block w-24">
                <div className="h-2 rounded-full bg-white/10 overflow-hidden" role="progressbar" aria-valuenow={Math.round(model.confidence * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={`${model.name} confidence`}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.round(model.confidence * 100)}%` }}
                    transition={{ delay: i * 0.1 + 0.3, duration: 0.5 }}
                    className="h-full rounded-full"
                    style={{
                      backgroundColor: model.prediction === "fake" ? "#f87171" : model.prediction === "uncertain" ? "#fbbf24" : "#34d399"
                    }}
                  />
                </div>
              </div>
              <span className="font-mono text-sm text-text-primary w-14 text-right">
                {(model.confidence * 100).toFixed(1)}%
              </span>
              <VerdictBadge
                verdict={model.prediction === "real" ? "likely_authentic" : model.prediction === "fake" ? "likely_manipulated" : "uncertain"}
                size="sm"
              />
            </div>
          </motion.div>
        ))}
      </div>
    </GlassCard>
  );
}

/* ============================================================================
   Heatmap Component
   ========================================================================== */
function Heatmap({ heatmapBase64, available, className = "" }: HeatmapProps) {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <GlassCard className={`p-5 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-text-primary flex items-center gap-2">
          <Eye className="w-5 h-5" aria-hidden="true" />
          Grad-CAM Heatmap
        </h3>
        {available && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-accent-cyan hover:text-accent-cyan/70 transition-colors"
            aria-expanded={expanded}
            aria-controls="heatmap-expanded"
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
            <span>{expanded ? "Show less" : "Show explanation"}</span>
          </button>
        )}
      </div>
      
      <div className="relative aspect-square rounded-xl bg-white/5 border border-white/10 overflow-hidden">
        {available && heatmapBase64 ? (
          <img
            src={`data:image/png;base64,${heatmapBase64}`}
            alt="Grad-CAM heatmap showing regions of interest for deepfake detection"
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full p-6 text-center">
            <ImageIcon className="w-12 h-12 text-white/20 mb-3" aria-hidden="true" />
            <p className="text-sm font-medium text-text-secondary">Heatmap unavailable</p>
            <p className="mt-1 text-xs text-text-muted max-w-xs">
              Grad-CAM visualization requires a compatible model with accessible convolutional layers.
              This feature is not available for the currently active detector.
            </p>
          </div>
        )}
      </div>
      
      {/* Explanation panel */}
      <AnimatePresence>
        {available && expanded && (
          <motion.div
            id="heatmap-expanded"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 p-4 rounded-xl bg-black/20 border border-white/5"
          >
            <h4 className="text-sm font-semibold text-text-primary mb-2 flex items-center gap-2">
              <Info className="w-4 h-4" aria-hidden="true" />
              How to read this heatmap
            </h4>
            <ul className="space-y-2 text-sm text-text-secondary">
              <li className="flex gap-2">
                <span className="w-2 h-2 rounded-full bg-verdict-manipulated mt-1.5 shrink-0" aria-hidden="true" />
                <strong>Red/orange areas</strong> — regions the model focuses on when predicting "fake" (e.g., facial boundaries, blending artifacts, inconsistent lighting).
              </li>
              <li className="flex gap-2">
                <span className="w-2 h-2 rounded-full bg-verdict-authentic mt-1.5 shrink-0" aria-hidden="true" />
                <strong>Blue/green areas</strong> — regions supporting "real" prediction (natural skin texture, consistent illumination).
              </li>
              <li className="flex gap-2">
                <span className="w-2 h-2 rounded-full bg-verdict-uncertain mt-1.5 shrink-0" aria-hidden="true" />
                <strong>Yellow areas</strong> — uncertain or transitional zones.
              </li>
            </ul>
            <p className="mt-3 text-xs text-text-muted">
              <strong>Limitations:</strong> Grad-CAM highlights correlation, not causation. High activation does not prove manipulation; it only shows where the model "looked."
              Compression, resizing, and facial pose can all affect the heatmap.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassCard>
  );
}

/* ============================================================================
   Video Chart Component (recharts line chart)
   ========================================================================== */
function VideoChart({ frameData, videoRef, className = "" }: VideoChartProps) {
  const [selectedFrame, setSelectedFrame] = useState<VideoFrameData | null>(null);
  
  const seekToFrame = (timestamp: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = timestamp;
    }
  };
  
  if (frameData.length === 0) {
    return (
      <GlassCard className={`p-5 ${className}`}>
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <VideoIcon className="w-12 h-12 text-white/20 mb-3" aria-hidden="true" />
          <p className="text-sm font-medium text-text-secondary">No frame data available</p>
          <p className="mt-1 text-xs text-text-muted">Frame-level analysis data will appear here when available.</p>
        </div>
      </GlassCard>
    );
  }
  
  // Format timestamp for tooltip
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${mins}:${secs.toString().padStart(2, "0")}.${ms.toString().padStart(3, "0")}`;
  };
  
  const chartData = frameData.map((f) => ({
    frame: f.frameIndex,
    timestamp: f.timestamp,
    fakeScore: f.fakeScore,
    hasFace: f.hasFace,
    timeLabel: formatTime(f.timestamp),
  }));
  
  return (
    <GlassCard className={`p-5 ${className}`}>
      <h3 className="text-base font-semibold text-text-primary flex items-center gap-2 mb-4">
        <BarChart className="w-5 h-5" aria-hidden="true" />
        Fake Score per Frame
      </h3>
      
      <div className="relative h-64" role="img" aria-label="Line chart showing fake score per video frame with threshold line at 0.5">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 30, left: 20, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
            <XAxis
              dataKey="timestamp"
              tick={{ fill: "#8899b0", fontSize: 10 }}
              tickFormatter={(value) => formatTime(value as number)}
              axisLine={{ stroke: "#ffffff15" }}
              tickLine={{ stroke: "#ffffff15" }}
            />
            <YAxis
              domain={[0, 1]}
              tick={{ fill: "#8899b0", fontSize: 10 }}
              tickFormatter={(value) => `${Math.round(value * 100)}%`}
              axisLine={{ stroke: "#ffffff15" }}
              tickLine={{ stroke: "#ffffff15" }}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || !payload[0]) return null;
                const frame = payload[0].payload as { frame: number; timestamp: number; fakeScore: number; hasFace: boolean; timeLabel: string };
                setSelectedFrame({
                  frameIndex: frame.frame,
                  timestamp: frame.timestamp,
                  fakeScore: frame.fakeScore,
                  hasFace: frame.hasFace,
                });
                return null; // We render custom tooltip below
              }}
            />
            <ReferenceLine
              y={0.5}
              stroke="#f87171"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={{ value: "Threshold (50%)", position: "right", fill: "#f87171", fontSize: 10, offset: 5 }}
            />
            <ReferenceLine
              y={0.35}
              stroke="#fbbf24"
              strokeDasharray="4 4"
              strokeWidth={1}
              label={{ value: "Uncertain (35%)", position: "right", fill: "#fbbf24", fontSize: 10, offset: 5 }}
            />
            <ReferenceLine
              y={0.65}
              stroke="#fbbf24"
              strokeDasharray="4 4"
              strokeWidth={1}
              label={{ value: "Fake (65%)", position: "right", fill: "#fbbf24", fontSize: 10, offset: 5 }}
            />
            <Line
              type="monotone"
              dataKey="fakeScore"
              stroke="#38bdf8"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 6, fill: "#38bdf8", stroke: "#fff", strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      
      {/* Custom tooltip / selected frame info */}
      {selectedFrame && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 p-3 rounded-xl bg-black/20 border border-white/5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-4">
              <div>
                <p className="text-xs text-text-muted">Frame</p>
                <p className="font-mono text-sm text-text-primary">#{selectedFrame.frameIndex}</p>
              </div>
              <div>
                <p className="text-xs text-text-muted">Timestamp</p>
                <p className="font-mono text-sm text-text-primary">{formatTime(selectedFrame.timestamp)}</p>
              </div>
              <div>
                <p className="text-xs text-text-muted">Fake Score</p>
                <p className="font-mono text-sm text-text-primary">{(selectedFrame.fakeScore * 100).toFixed(1)}%</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => seekToFrame(selectedFrame.timestamp)}
              className="px-3 py-1.5 text-xs font-medium text-black bg-accent-gradient rounded-lg hover:opacity-90 transition-opacity"
              aria-label={`Seek to ${formatTime(selectedFrame.timestamp)}`}
            >
              Seek to frame
            </button>
          </div>
        </motion.div>
      )}
      
      {/* Threshold legend */}
      <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t border-white/5 text-xs text-text-muted">
        <div className="flex items-center gap-1.5">
          <span className="w-6 h-px bg-verdict-manipulated" />
          <span>Fake threshold (0.5)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-6 h-px bg-verdict-uncertain" />
          <span>{"Uncertain zone (0.35\u20130.65)"}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-6 h-px bg-verdict-authentic" />
          <span>{"Real zone (<0.35)"}</span>
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="w-6 h-px bg-accent-cyan" />
          <span>Frame scores</span>
        </div>
      </div>
    </GlassCard>
  );
}

/* ============================================================================
   Video Player with Side-by-Side Scores
   ========================================================================== */
function VideoPlayerWithScores({
  report,
  videoUrl,
  videoFrameData,
  audioScore,
  className = ""
}: {
  report: AnalysisReport;
  videoUrl: string;
  videoFrameData: VideoFrameData[];
  audioScore: number | null;
  className?: string;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  
  return (
    <div className={`space-y-6 ${className}`}>
      {/* Video Preview */}
      <GlassCard className="p-0 overflow-hidden">
        <video
          ref={videoRef}
          src={videoUrl}
          controls
          className="w-full h-auto bg-black"
          aria-label="Video preview with playback controls"
        />
      </GlassCard>
      
      {/* Side-by-side scores */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Video Score Gauge */}
        <GlassCard className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <VideoIcon className="w-5 h-5 text-accent-cyan" aria-hidden="true" />
            <h3 className="text-base font-semibold text-text-primary">Video Score</h3>
          </div>
          <ScoreGauge
            score={getCombinedScore(report)}
          />
        </GlassCard>
        
        {/* Audio Score Gauge */}
        <GlassCard className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <MusicIcon className="w-5 h-5 text-accent-violet" aria-hidden="true" />
            <h3 className="text-base font-semibold text-text-primary">Audio Score</h3>
          </div>
          <ScoreGauge
            score={audioScore}
          />
          {audioScore === null && (
            <p className="mt-3 text-center text-sm text-text-muted">
              Audio analysis not run for this video.
            </p>
          )}
        </GlassCard>
      </div>
      
      {/* Frame-level chart */}
      <VideoChart frameData={videoFrameData} videoRef={videoRef} />
    </div>
  );
}

/* ============================================================================
   Audio Player with Waveform
   ========================================================================== */
function AudioPlayerWithWaveform({
  audioUrl,
  report,
  className = ""
}: {
  audioUrl: string;
  report: AnalysisReport;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [waveformData, setWaveformData] = useState<Float32Array | null>(null);
  
  useEffect(() => {
    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    
    audio.addEventListener("loadedmetadata", () => {
      setDuration(audio.duration);
    });
    
    audio.addEventListener("timeupdate", () => {
      setCurrentTime(audio.currentTime);
    });
    
    audio.addEventListener("ended", () => {
      setIsPlaying(false);
    });
    
    // Decode audio for waveform
    const audioContext = new (window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    fetch(audioUrl)
      .then((res) => res.arrayBuffer())
      .then((arrayBuffer) => audioContext.decodeAudioData(arrayBuffer))
      .then((audioBuffer) => {
        const channelData = audioBuffer.getChannelData(0);
        const samples = 1000;
        const blockSize = Math.floor(channelData.length / samples);
        const peaks = new Float32Array(samples);
        
        for (let i = 0; i < samples; i++) {
          const start = i * blockSize;
          const end = start + blockSize;
          let max = 0;
          for (let j = start; j < end; j++) {
            const val = Math.abs(channelData[j]);
            if (val > max) max = val;
          }
          peaks[i] = max;
        }
        setWaveformData(peaks);
      })
      .catch(console.error);
    
    return () => {
      audio.pause();
      audioContext.close();
    };
  }, [audioUrl]);
  
  useEffect(() => {
    if (!canvasRef.current || !waveformData) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;
    
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    
    ctx.clearRect(0, 0, width, height);
    
    // Draw waveform
    const barWidth = width / waveformData.length;
    const centerY = height / 2;
    const maxHeight = height * 0.4;
    
    waveformData.forEach((value, i) => {
      const barHeight = value * maxHeight;
      const x = i * barWidth;
      
      // Color based on position (gradient)
      const gradient = ctx.createLinearGradient(0, centerY - barHeight, 0, centerY + barHeight);
      gradient.addColorStop(0, "#38bdf8");
      gradient.addColorStop(0.5, "#38bdf880");
      gradient.addColorStop(1, "#38bdf8");
      
      ctx.fillStyle = gradient;
      ctx.fillRect(x, centerY - barHeight, barWidth * 0.8, barHeight * 2);
    });
    
    // Draw playhead
    if (duration > 0) {
      const playheadX = (currentTime / duration) * width;
      ctx.strokeStyle = "#f87171";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, height);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [waveformData, currentTime, duration]);
  
  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };
  
  const seek = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!audioRef.current || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    audioRef.current.currentTime = percent * duration;
  };
  
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };
  
  return (
    <div className={`space-y-6 ${className}`}>
      {/* Waveform / Audio Player */}
      <GlassCard className="p-5">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={togglePlay}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
            aria-label={isPlaying ? "Pause" : "Play"}
            aria-pressed={isPlaying}
          >
            {isPlaying ? (
              <svg className="w-6 h-6 text-text-primary" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
            ) : (
              <svg className="w-6 h-6 text-text-primary" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <polygon points="5,3 19,12 5,21" />
              </svg>
            )}
          </button>
          
          <div className="flex-1 h-32 relative" role="img" aria-label="Audio waveform visualization">
            <canvas
              ref={canvasRef}
              className="w-full h-full cursor-pointer"
              onClick={seek}
              aria-label="Click to seek"
            />
          </div>
          
          <div className="flex items-center gap-2 text-sm font-mono text-text-secondary w-28">
            <span>{formatTime(currentTime)}</span>
            <span className="text-text-muted">/</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </GlassCard>
      
      {/* Audio Score */}
      <GlassCard className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <MusicIcon className="w-5 h-5 text-accent-violet" aria-hidden="true" />
          <h3 className="text-base font-semibold text-text-primary">Audio Analysis Score</h3>
        </div>
        <ScoreGauge
          score={getCombinedScore(report)}
        />
      </GlassCard>
    </div>
  );
}

/* ============================================================================
   Loading Skeletons
   ========================================================================== */
function LoadingSkeleton({ variant = "card", className = "" }: LoadingSkeletonProps) {
  const baseClass = "animate-pulse bg-white/5 rounded-xl border border-white/10";
  
  const variants = {
    card: "h-32",
    gauge: "h-40",
    chart: "h-64",
    verdict: "h-28",
    breakdown: "h-48",
  };
  
  return (
    <div className={`${baseClass} ${variants[variant]} ${className}`} aria-hidden="true" />
  );
}

function LoadingState({ analysisType }: { analysisType: AnalysisType }) {
  return (
    <div className="space-y-6" role="status" aria-live="polite" aria-label="Loading analysis results">
      <GlassCard className="p-6">
        <div className="flex items-center gap-4">
          <motion.div
            className="border-accent-cyan/30 border-t-accent-cyan h-9 w-9 shrink-0 rounded-full border-2"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            aria-hidden="true"
          />
          <div>
            <h2 className="text-base font-semibold text-text-primary">Analyzing your {analysisType}…</h2>
            <p className="text-xs text-text-muted">Running detectors and compiling report</p>
          </div>
        </div>
        <div className="mt-6 space-y-3" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-label="Analysis progress">
          {["Validating", "Preprocessing", "Running detectors", "Compiling report"].map((stage, i) => (
            <motion.div
              key={stage}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="flex items-center gap-3"
            >
              <motion.div
                animate={{ backgroundColor: ["rgba(255,255,255,0.05)", "rgba(34,211,238,0.15)"] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 text-text-muted"
              >
                <span className="block h-2 w-2 rounded-full bg-current" aria-hidden="true" />
              </motion.div>
              <span className="text-sm text-text-secondary">{stage}</span>
            </motion.div>
          ))}
        </div>
      </GlassCard>
      
      {/* Skeleton placeholders for results */}
      <LoadingSkeleton variant="verdict" />
      <LoadingSkeleton variant="gauge" />
      <LoadingSkeleton variant="breakdown" />
      {analysisType === "video" && <LoadingSkeleton variant="chart" />}
      {analysisType === "image" && <LoadingSkeleton variant="card" />}
    </div>
  );
}

/* ============================================================================
   Error State
   ========================================================================== */
function ErrorState({ title, message, onRetry, className = "" }: ErrorStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`space-y-4 ${className}`}
      role="alert"
    >
      <GlassCard className="border-verdict-manipulated/30 p-6">
        <div className="flex gap-3">
          <div className="mt-0.5 shrink-0 text-verdict-manipulated">
            <AlertCircle className="w-6 h-6" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-verdict-manipulated">{title}</h2>
            <p className="mt-1 text-sm text-text-secondary">{message}</p>
          </div>
        </div>
      </GlassCard>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onRetry}
          className="bg-accent-gradient rounded-xl px-6 py-3 text-sm font-semibold text-black shadow-lg focus-visible:outline-2 focus-visible:outline-accent-cyan"
        >
          <RotateCcw className="w-4 h-4 mr-2 inline" aria-hidden="true" />
          Try again
        </button>
      </div>
    </motion.div>
  );
}

/* ============================================================================
   Empty State
   ========================================================================== */
function EmptyState({ analysisType, onAnalyze, disabled = false, className = "" }: EmptyStateProps) {
  const icons = {
    image: ImageIcon,
    video: VideoIcon,
    audio: MusicIcon,
  };
  
  const messages = {
    image: {
      title: "Ready to analyze images",
      description: "Upload an image to run forensic analysis for AI generation and face-swap detection.",
    },
    video: {
      title: "Ready to analyze videos",
      description: "Upload a video for frame-level face-swap detection. DeepForge samples frames at uniform intervals.",
    },
    audio: {
      title: "Ready to analyze audio",
      description: "Upload an audio file for experimental spectral analysis and synthetic-speech detection.",
    },
  };
  
  const Icon = icons[analysisType];
  const { title, description } = messages[analysisType];
  
  return (
    <GlassCard className={`p-10 sm:p-12 text-center ${className}`}>
      <div className="mx-auto w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-6">
        <Icon className="w-8 h-8 text-text-muted" aria-hidden="true" />
      </div>
      <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
      <p className="mt-2 text-sm text-text-secondary max-w-xs mx-auto">{description}</p>
      <button
        type="button"
        onClick={onAnalyze}
        disabled={disabled}
        className="mt-6 bg-accent-gradient rounded-xl px-6 py-3 text-sm font-semibold text-black shadow-lg transition-opacity focus-visible:outline-2 focus-visible:outline-accent-cyan disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
      >
        Select {analysisType} to analyze
      </button>
    </GlassCard>
  );
}

/* ============================================================================
   Evidence extraction helpers
   ========================================================================== */
function extractC2PAData(report: AnalysisReport): unknown {
  for (const detector of report.detector_results) {
    const details = detector.details as Record<string, unknown> | undefined;
    if (details?.c2pa || details?.manifest || details?.trust_markers) {
      return details.c2pa ?? details.manifest ?? details.trust_markers ?? true;
    }
    if (detector.detector_name.toLowerCase().includes("c2pa")) {
      return { status: detector.verdict, confidence: detector.calibrated_confidence };
    }
  }
  return null;
}

function extractC2PADetails(report: AnalysisReport): Record<string, unknown> | undefined {
  for (const detector of report.detector_results) {
    const details = detector.details as Record<string, unknown> | undefined;
    if (details?.c2pa || details?.manifest || details?.trust_markers) {
      const result: Record<string, unknown> = {};
      if (details.manifest) result.manifest = details.manifest;
      if (details.trust_markers) result.trust_markers = details.trust_markers;
      if (details.ingredients) result.ingredients = details.ingredients;
      if (details.claim_generator) result.claim_generator = details.claim_generator;
      if (details.signature) result.signature = "present";
      return Object.keys(result).length > 0 ? result : undefined;
    }
  }
  return undefined;
}

function extractWatermarkData(report: AnalysisReport): unknown {
  for (const detector of report.detector_results) {
    const details = detector.details as Record<string, unknown> | undefined;
    if (details?.watermark || details?.synthid || details?.payload) {
      return details.watermark ?? details.synthid ?? details.payload ?? true;
    }
    if (detector.detector_name.toLowerCase().includes("watermark")) {
      return { status: detector.verdict, confidence: detector.calibrated_confidence };
    }
  }
  return null;
}

function extractWatermarkDetails(report: AnalysisReport): Record<string, unknown> | undefined {
  for (const detector of report.detector_results) {
    const details = detector.details as Record<string, unknown> | undefined;
    if (details?.watermark || details?.synthid || details?.payload) {
      const result: Record<string, unknown> = {};
      if (details.payload) result.payload = details.payload;
      if (details.type) result.type = details.type;
      if (details.confidence) result.confidence = details.confidence;
      return Object.keys(result).length > 0 ? result : undefined;
    }
  }
  return undefined;
}

function extractMetadataData(report: AnalysisReport): unknown {
  const metadata = report.metadata as Record<string, unknown> | undefined;
  if (metadata && Object.keys(metadata).length > 0) {
    return metadata;
  }
  for (const detector of report.detector_results) {
    const details = detector.details as Record<string, unknown> | undefined;
    if (details?.exif || details?.xmp || details?.metadata) {
      return details.exif ?? details.xmp ?? details.metadata ?? true;
    }
  }
  return null;
}

function extractMetadataDetails(report: AnalysisReport): Record<string, unknown> | undefined {
  const metadata = report.metadata as Record<string, unknown> | undefined;
  if (metadata && Object.keys(metadata).length > 0) {
    const filtered: Record<string, unknown> = {};
    const interestingKeys = ["make", "model", "software", "datetime", "gps", "exif", "xmp", "icc_profile", "color_space", "orientation", "width", "height", "duration", "bitrate", "codec", "sample_rate", "channels"];
    for (const key of interestingKeys) {
      if (metadata[key] !== undefined) filtered[key] = metadata[key];
    }
    return Object.keys(filtered).length > 0 ? filtered : metadata;
  }
  for (const detector of report.detector_results) {
    const details = detector.details as Record<string, unknown> | undefined;
    if (details?.exif || details?.xmp || details?.metadata) {
      const meta = details.exif ?? details.xmp ?? details.metadata;
      return meta as Record<string, unknown> | undefined;
    }
  }
  return undefined;
}

function extractForensicData(report: AnalysisReport): unknown {
  const detector = report.detector_results[0];
  if (!detector) return null;
  return {
    verdict: detector.verdict,
    raw_score: detector.raw_score,
    calibrated_confidence: detector.calibrated_confidence,
    processing_time_ms: detector.processing_time_ms,
  };
}

function extractForensicDetails(
  report: AnalysisReport,
  perModelResults: Array<{ name: string; prediction: string; confidence: number; processingTimeMs: number }>,
  combinedScore: number | null
): Record<string, unknown> {
  const details: Record<string, unknown> = {};
  details.combined_score = combinedScore;
  details.models_run = report.detector_results.length;
  details.total_processing_time_ms = report.processing_time_ms;
  
  if (perModelResults.length > 0) {
    details.per_model = perModelResults.map((m) => ({
      name: m.name,
      prediction: m.prediction,
      confidence: m.confidence,
      processing_time_ms: m.processingTimeMs,
    }));
  }
  
  const firstDetector = report.detector_results[0];
  if (firstDetector) {
    const d = firstDetector.details as Record<string, unknown> | undefined;
    if (d?.heatmap_available) details.heatmap_available = d.heatmap_available;
    if (d?.combined_score) details.combined_score = d.combined_score;
    if (d?.thresholds) details.thresholds = d.thresholds;
  }
  
  return details;
}

/* ============================================================================
   Main AnalysisResults Component
   ========================================================================== */
interface AnalysisResultsProps {
  report: AnalysisReport | null;
  analysisType: AnalysisType;
  phase: "idle" | "analyzing" | "done" | "error";
  error: string | null;
  imageUrl?: string;
  videoUrl?: string;
  audioUrl?: string;
  onRetry?: () => void;
  onNewAnalysis?: () => void;
}

export default function AnalysisResults({
  report,
  analysisType,
  phase,
  error,
  videoUrl,
  audioUrl,
  onRetry,
  onNewAnalysis,
}: AnalysisResultsProps) {
  const [mode, setMode] = useState<"simple" | "advanced">("simple");
  
  // Loading state
  if (phase === "analyzing") {
    return <LoadingState analysisType={analysisType} />;
  }
  
  // Error state
  if (phase === "error" && error) {
    return (
      <ErrorState
        title="Analysis failed"
        message={error}
        onRetry={onRetry || (() => {})}
      />
    );
  }
  
  // Empty / idle state
  if (phase === "idle" || !report) {
    return (
      <EmptyState
        analysisType={analysisType}
        onAnalyze={onNewAnalysis || (() => {})}
        disabled={phase !== "idle"}
      />
    );
  }
  
  // Done state - render results
  const noDetectorsRun = report.detector_results.length === 0;
  const combinedScore = getCombinedScore(report);
  const perModelResults = extractPerModelResults(report);
  const videoFrameData = extractVideoFrameData(report);
  
  // Extract heatmap from detector details
  let heatmapBase64: string | undefined;
  let heatmapAvailable = false;
  if (report.detector_results.length > 0) {
    const details = report.detector_results[0].details as Record<string, unknown> | undefined;
    heatmapBase64 = details?.heatmap_b64 as string | undefined;
    heatmapAvailable = (details?.heatmap_available as boolean) ?? false;
  }
  
  // Extract audio score for video
  let audioScore: number | null = null;
  if (analysisType === "video" && report.detector_results.length > 1) {
    const audioDetector = report.detector_results.find((d) => 
      d.detector_name.toLowerCase().includes("audio")
    );
    if (audioDetector) {
      audioScore = audioDetector.raw_score;
    }
  }
  
  return (
    <div className="space-y-6" role="region" aria-label="Analysis results">
      {/* Header with verdict badge and mode toggle */}
      <GlassCard className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-text-primary">Analysis Result</h2>
            <p className="max-w-xl text-xs text-text-muted">
              {report.file_name} — {formatTimestamp(report.created_at)}
            </p>
            <VerdictBadge verdict={report.overall_verdict} size="lg" className="mt-2" />
          </div>
          <div className="flex items-center gap-3">
            <ModeToggle mode={mode} onChange={setMode} />
          </div>
        </div>
        <p className="mt-4 border-t border-white/5 pt-4 text-sm leading-relaxed text-text-secondary">
          {report.summary}
        </p>
      </GlassCard>
      
      {/* No detectors run banner */}
      {noDetectorsRun && (
        <GlassCard role="status" className="border-verdict-uncertain/30 bg-verdict-uncertain/5 p-5">
          <div className="flex gap-3">
            <HelpCircle className="mt-0.5 shrink-0 text-verdict-uncertain w-5 h-5" aria-hidden="true" />
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
      
      {/* Results content */}
      <AnimatePresence initial={false} mode="wait">
        <motion.div
          key={mode}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="space-y-6"
        >
          {/* Simple Mode - Enhanced Detect Experience */}
          {mode === "simple" && (
            <>
              {/* Verdict Card + Score Gauge */}
              <div className="grid gap-6 lg:grid-cols-2">
                <VerdictCard
                  verdict={report.overall_verdict as VerdictLevel}
                  score={combinedScore}
                  analysisType={analysisType}
                />
                <GlassCard className="p-5">
                  <ScoreGauge
                    score={combinedScore}
                  />
                </GlassCard>
              </div>

              {/* Evidence Cards - Detect Experience */}
              <div className="space-y-4 stagger-children">
                {/* C2PA / Signed Provenance */}
                <EvidenceCard
                  type="c2pa"
                  title="Signed Provenance (C2PA)"
                  icon={<FileSignature className="w-5 h-5" aria-hidden="true" />}
                  data={extractC2PAData(report)}
                  description="Cryptographic manifest proving content origin and edit history. Absence does not prove manipulation."
                  details={extractC2PADetails(report)}
                />

                {/* Watermarks */}
                <EvidenceCard
                  type="watermark"
                  title="Supported Watermarks"
                  icon={<Shield className="w-5 h-5" aria-hidden="true" />}
                  data={extractWatermarkData(report)}
                  description="Invisible watermarks embedded by AI generators (SynthID, DALL-E, etc.). Detected watermarks strongly indicate AI origin."
                  details={extractWatermarkDetails(report)}
                />

                {/* File Metadata */}
                <EvidenceCard
                  type="metadata"
                  title="File Metadata"
                  icon={<ImageIconLucide className="w-5 h-5" aria-hidden="true" />}
                  data={extractMetadataData(report)}
                  description="EXIF, XMP, and container metadata revealing creation tool, timestamps, and processing history."
                  details={extractMetadataDetails(report)}
                />

                {/* Forensic ML Estimate */}
                <EvidenceCard
                  type="forensic"
                  title="Forensic ML Estimate"
                  icon={<Brain className="w-5 h-5" aria-hidden="true" />}
                  data={extractForensicData(report)}
                  description="Statistical analysis of pixel/frame/audio patterns using trained detectors. Probabilistic, not deterministic."
                  details={extractForensicDetails(report, perModelResults, combinedScore)}
                />
              </div>

              {/* Per-Model Breakdown */}
              {perModelResults.length > 0 && (
                <PerModelBreakdown models={perModelResults} />
              )}

              {/* Heatmap (image only) */}
              {analysisType === "image" && (
                <Heatmap
                  heatmapBase64={heatmapBase64}
                  available={heatmapAvailable}
                />
              )}

              {/* Video-specific: frame chart + player + audio score */}
              {analysisType === "video" && videoUrl && (
                <>
                  <VideoPlayerWithScores
                    report={report}
                    videoUrl={videoUrl}
                    videoFrameData={videoFrameData}
                    audioScore={audioScore}
                  />
                </>
              )}

              {/* Audio-specific: waveform player + score */}
              {analysisType === "audio" && audioUrl && (
                <AudioPlayerWithWaveform
                  audioUrl={audioUrl}
                  report={report}
                />
              )}

              {/* What this means + Limitations */}
              <GlassCard className="p-5 sm:p-6">
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
                        {report.detector_results.length === 1 ? "" : "s"} and reports each signal
                        separately. The overall verdict reflects the published decision thresholds —
                        it is not a substitute for reviewing the individual detector evidence.
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

              <GlassCard className="p-5 sm:p-6">
                <h3 className="text-base font-semibold text-text-primary">Limitations</h3>
                <div className="mt-3">
                  <ul className="space-y-2">
                    {report.limitations.map((limitation, i) => (
                      <li key={i} className="flex gap-2.5 text-sm text-text-secondary">
                        <span aria-hidden="true" className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent-cyan" />
                        {limitation}
                      </li>
                    ))}
                    {report.limitations.length === 0 && (
                      <p className="text-sm text-text-muted">No limitations were reported for this analysis.</p>
                    )}
                  </ul>
                </div>
              </GlassCard>
            </>
          )}
          
          {/* Advanced Mode */}
          {mode === "advanced" && (
            <>
              <div className="grid gap-6 lg:grid-cols-2">
                <GlassCard className="p-5 sm:p-6">
                  <h3 className="text-base font-semibold text-text-primary">File metadata</h3>
                  <dl className="mt-3 space-y-2">
                    <div className="flex justify-between border-b border-white/5 pb-2">
                      <dt className="text-xs text-text-muted">File name</dt>
                      <dd className="text-right font-mono text-xs text-text-secondary">{report.file_name}</dd>
                    </div>
                    <div className="flex justify-between border-b border-white/5 pb-2">
                      <dt className="text-xs text-text-muted">Size</dt>
                      <dd className="text-right font-mono text-xs text-text-secondary">{formatBytes(report.file_size_bytes)}</dd>
                    </div>
                    <div className="flex justify-between border-b border-white/5 pb-2">
                      <dt className="text-xs text-text-muted">Type</dt>
                      <dd className="text-right font-mono text-xs text-text-secondary">{report.file_type}</dd>
                    </div>
                    <div className="flex justify-between border-b border-white/5 pb-2">
                      <dt className="text-xs text-text-muted">Analysis type</dt>
                      <dd className="text-right font-mono text-xs text-text-secondary">{report.analysis_type}</dd>
                    </div>
                    <div className="flex justify-between border-b border-white/5 pb-2">
                      <dt className="text-xs text-text-muted">Status</dt>
                      <dd className="text-right font-mono text-xs text-text-secondary">{report.status}</dd>
                    </div>
                    <div className="flex justify-between border-b border-white/5 pb-2">
                      <dt className="text-xs text-text-muted">Created</dt>
                      <dd className="text-right font-mono text-xs text-text-secondary">{formatTimestamp(report.created_at)}</dd>
                    </div>
                    <div className="flex justify-between border-b border-white/5 pb-2">
                      <dt className="text-xs text-text-muted">Completed</dt>
                      <dd className="text-right font-mono text-xs text-text-secondary">{formatTimestamp(report.completed_at)}</dd>
                    </div>
                    <div className="flex justify-between border-b border-white/5 pb-2">
                      <dt className="text-xs text-text-muted">Total processing time</dt>
                      <dd className="text-right font-mono text-xs text-text-secondary">{formatDuration(report.processing_time_ms)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-xs text-text-muted">Analysis ID</dt>
                      <dd className="text-right font-mono text-xs text-accent-cyan">{report.analysis_id}</dd>
                    </div>
                  </dl>
                </GlassCard>
                
                <GlassCard className="p-5 sm:p-6">
                  <h3 className="text-base font-semibold text-text-primary">Forensic indicators</h3>
                  <div className="mt-3">
                    <ul className="space-y-2">
                      {report.forensic_indicators.map((indicator, i) => (
                        <li key={i} className="flex gap-2.5 text-sm text-text-secondary">
                          <span aria-hidden="true" className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent-cyan" />
                          {indicator}
                        </li>
                      ))}
                      {report.forensic_indicators.length === 0 && (
                        <p className="text-sm text-text-muted">No forensic indicators were recorded.</p>
                      )}
                    </ul>
                  </div>
                  <h3 className="mt-6 text-base font-semibold text-text-primary">Limitations</h3>
                  <div className="mt-3">
                    <ul className="space-y-2">
                      {report.limitations.map((limitation, i) => (
                        <li key={i} className="flex gap-2.5 text-sm text-text-secondary">
                          <span aria-hidden="true" className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent-cyan" />
                          {limitation}
                        </li>
                      ))}
                      {report.limitations.length === 0 && (
                        <p className="text-sm text-text-muted">No limitations were reported for this analysis.</p>
                      )}
                    </ul>
                  </div>
                </GlassCard>
              </div>
              
              {/* Detector results in advanced mode */}
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
                    <GlassCard key={result.detector_name} hoverLift className="p-4 sm:p-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-mono text-sm font-medium text-text-primary">{result.detector_name}</p>
                          <p className="font-mono text-xs text-text-muted">v{result.detector_version}</p>
                        </div>
                        <VerdictBadge verdict={result.verdict} size="sm" />
                      </div>
                      <dl className="mt-4 grid gap-x-8 sm:grid-cols-2">
                        <div className="flex justify-between border-b border-white/5 py-2">
                          <dt className="text-xs text-text-muted">Raw score</dt>
                          <dd className="text-right font-mono text-xs text-text-secondary">{formatScore(result.raw_score)}</dd>
                        </div>
                        <div className="flex justify-between border-b border-white/5 py-2">
                          <dt className="text-xs text-text-muted">Calibrated confidence</dt>
                          <dd className="text-right font-mono text-xs text-text-secondary">{formatPercent(result.calibrated_confidence)}</dd>
                        </div>
                        <div className="flex justify-between border-b border-white/5 py-2">
                          <dt className="text-xs text-text-muted">Processing time</dt>
                          <dd className="text-right font-mono text-xs text-text-secondary">{formatDuration(result.processing_time_ms)}</dd>
                        </div>
                      </dl>
                      <div className="mt-3 rounded-xl bg-black/20 p-3">
                        <p className="mb-2 text-xs font-medium text-text-secondary">Details</p>
                        <dl className="space-y-1">
                          {Object.entries(result.details).map(([key, value]) => (
                            <div key={key} className="flex justify-between text-[11px]">
                              <dt className="text-text-muted">{key}</dt>
                              <dd className="text-right font-mono text-text-secondary break-all">
                                {typeof value === "object" ? JSON.stringify(value) : String(value)}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                      {result.limitations.length > 0 && (
                        <ul className="mt-3 space-y-1">
                          {result.limitations.map((limitation, i) => (
                            <li key={i} className="text-xs text-text-muted">· {limitation}</li>
                          ))}
                        </ul>
                      )}
                    </GlassCard>
                  ))
                )}
              </div>
            </>
          )}
        </motion.div>
      </AnimatePresence>
      
      {/* Analyze another button */}
      {onNewAnalysis && (
        <div className="text-center pt-4">
          <button
            type="button"
            onClick={onNewAnalysis}
            className="glass rounded-xl px-6 py-3 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary focus-visible:outline-2 focus-visible:outline-accent-cyan"
          >
            Analyze another {analysisType}
          </button>
        </div>
      )}
    </div>
  );
}

/* ============================================================================
   Mode Toggle (reused from original)
   ========================================================================== */
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