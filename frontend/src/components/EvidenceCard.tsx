import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ReactNode } from "react";
import { ChevronDown, AlertTriangle } from "lucide-react";
import { StatusPill, getEvidenceStatus } from "./VerdictBadge";

interface EvidenceCardProps {
  /** Evidence type identifier */
  type: "c2pa" | "watermark" | "metadata" | "forensic";
  /** Title of the evidence card */
  title: string;
  /** Icon to display */
  icon: ReactNode;
  /** Raw evidence data from the report */
  data: unknown;
  /** Human-readable description of what this evidence means */
  description: string;
  /** Additional details to show in expandable section */
  details?: Record<string, unknown>;
  /** Boundary callout - limitations of this evidence type */
  boundaryNote?: string;
  /** Custom className */
  className?: string;
}

const TYPE_CONFIG = {
  c2pa: {
    label: "Signed Provenance (C2PA)",
    description: "Cryptographic manifest proving content origin and edit history. Absence does not prove manipulation.",
    boundaryNote: "C2PA manifests are only present if the creator or tool embedded them. Most social media platforms strip manifests on upload. Lack of a manifest is not evidence of manipulation.",
  },
  watermark: {
    label: "Supported Watermarks",
    description: "Invisible watermarks embedded by AI generators (SynthID, DALL-E, etc.). Detected watermarks strongly indicate AI origin.",
    boundaryNote: "Not all AI models embed watermarks. Watermarks can be removed by compression, editing, or adversarial attacks. A missing watermark does not prove human authorship.",
  },
  metadata: {
    label: "File Metadata",
    description: "EXIF, XMP, and container metadata revealing creation tool, timestamps, and processing history.",
    boundaryNote: "Metadata is easily stripped, modified, or forged. It provides clues but never definitive proof. Always correlate with other evidence.",
  },
  forensic: {
    label: "Forensic ML Estimate",
    description: "Statistical analysis of pixel/frame/audio patterns using trained detectors. Probabilistic, not deterministic.",
    boundaryNote: "ML detectors have false positive and false negative rates. Results vary by model, training data, and content type. Treat as one input among many.",
  },
} as const;

export default function EvidenceCard({
  type,
  title,
  icon,
  data,
  description,
  details,
  boundaryNote,
  className = "",
}: EvidenceCardProps) {
  const config = TYPE_CONFIG[type];
  const status = getEvidenceStatus(data, type);
  const [expanded, setExpanded] = useState(false);

  const hasDetails = details && Object.keys(details).length > 0;
  const showBoundary = boundaryNote || config.boundaryNote;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={`evidence-card ${className}`}
    >
      <div className="evidence-card-header">
        <div className="evidence-card-title flex items-center gap-2">
          <span className="p-2 rounded-lg bg-white/5 border border-white/10">{icon}</span>
          <div>
            <p className="font-semibold text-text-primary">{title || config.label}</p>
            <p className="text-[11px] text-text-muted font-mono-tabular-xs uppercase tracking-wider">{type.toUpperCase()}</p>
          </div>
        </div>
        <StatusPill status={status} label={getStatusLabel(status)} />
      </div>

      <div className="evidence-card-body">
        <p className="text-sm text-text-secondary leading-relaxed">{description || config.description}</p>

        {hasDetails && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1.5 text-xs text-accent-cyan hover:text-accent-cyan/70 transition-colors mt-2"
            aria-expanded={expanded}
          >
            <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
            <span>{expanded ? "Show less" : "Show technical details"}</span>
          </button>
        )}

        <AnimatePresence>
          {hasDetails && expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="evidence-card-detail space-y-2"
            >
              {Object.entries(details!).map(([key, value]) => (
                <div key={key} className="flex justify-between gap-4">
                  <span className="text-text-muted font-mono-tabular-xs">{formatKey(key)}</span>
                  <span className="text-text-secondary font-mono-tabular-xs break-all text-right max-w-[60%]">
                    {formatValue(value)}
                  </span>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {showBoundary && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20"
          >
            <div className="flex gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" aria-hidden="true" />
              <div className="text-xs text-amber-300 leading-relaxed">
                <strong className="text-amber-200">Evidence boundary:</strong>{" "}
                {boundaryNote || config.boundaryNote}
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    verified: "Verified",
    "not-detected": "Not Detected",
    inconclusive: "Inconclusive",
    unsupported: "Unsupported",
    error: "Error",
    pending: "Pending…",
  };
  return labels[status] || status;
}

function formatKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }
  if (typeof value === "number") {
    return Number.isInteger(value) ? value.toString() : value.toFixed(4);
  }
  return String(value);
}