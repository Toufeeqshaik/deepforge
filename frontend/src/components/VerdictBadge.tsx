import { getVerdictMeta } from "../lib/verdicts";

interface VerdictBadgeProps {
  verdict: string;
  /** Optional size variant; defaults to "md". */
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZES = {
  sm: "px-2 py-0.5 text-[10px]",
  md: "px-3 py-1 text-sm",
  lg: "px-4 py-1.5 text-base",
} as const;

export default function VerdictBadge({ verdict, size = "md", className = "" }: VerdictBadgeProps) {
  const meta = getVerdictMeta(verdict);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${meta.bg} ${meta.border} ${meta.text} ${SIZES[size]} ${className}`}
    >
      <span
        aria-hidden="true"
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: meta.hex }}
      />
      {meta.label}
    </span>
  );
}

/**
 * Semantic status pill for evidence cards (C2PA, Watermarks, Metadata, Forensic ML)
 */
export interface StatusPillProps {
  status: "verified" | "not-detected" | "inconclusive" | "unsupported" | "error" | "pending";
  label: string;
  className?: string;
  showIcon?: boolean;
}

const STATUS_CONFIG = {
  verified: {
    label: "Verified",
    className: "status-pill-verified",
    icon: (
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
  },
  "not-detected": {
    label: "Not Detected",
    className: "status-pill-not-detected",
    icon: (
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
      </svg>
    ),
  },
  inconclusive: {
    label: "Inconclusive",
    className: "status-pill-inconclusive",
    icon: (
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
  },
  unsupported: {
    label: "Unsupported",
    className: "status-pill-unsupported",
    icon: (
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
  },
  error: {
    label: "Error",
    className: "status-pill-error",
    icon: (
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
  },
  pending: {
    label: "Pending…",
    className: "status-pill-pending",
    icon: (
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin" aria-hidden="true">
        <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
        <path d="M12 2a10 10 0 0 1 10 10" strokeOpacity="1" />
      </svg>
    ),
  },
} as const;

export function StatusPill({ status, label, className = "", showIcon = true }: StatusPillProps) {
  const config = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium font-mono-tabular ${config.className} ${className}`}>
      {showIcon && config.icon}
      <span>{label || config.label}</span>
    </span>
  );
}

/**
 * Evidence card status indicator - maps detector/evidence results to semantic status
 */
export function getEvidenceStatus(
  value: unknown,
  type: "c2pa" | "watermark" | "metadata" | "forensic"
): "verified" | "not-detected" | "inconclusive" | "unsupported" | "error" {
  if (value === null || value === undefined) return "unsupported";

  if (typeof value === "boolean") {
    return value ? "verified" : "not-detected";
  }

  if (typeof value === "object" && value !== null) {
    const obj = value as Record<string, unknown>;

    // Check for explicit status field
    if (typeof obj.status === "string") {
      const s = obj.status.toLowerCase();
      if (s === "verified" || s === "valid" || s === "present" || s === "found") return "verified";
      if (s === "not_found" || s === "missing" || s === "absent") return "not-detected";
      if (s === "inconclusive" || s === "uncertain") return "inconclusive";
      if (s === "error" || s === "failed") return "error";
    }

    // Check for confidence/score
    if (typeof obj.confidence === "number") {
      if (obj.confidence > 0.7) return "verified";
      if (obj.confidence > 0.3) return "inconclusive";
      return "not-detected";
    }

    if (typeof obj.score === "number") {
      if (obj.score > 0.7) return "verified";
      if (obj.score > 0.3) return "inconclusive";
      return "not-detected";
    }

    // Check for C2PA specific fields
    if (type === "c2pa" && (obj.manifest || obj.signature || obj.trust_markers)) {
      return "verified";
    }

    // Check for watermark specific fields
    if (type === "watermark" && (obj.payload || obj.detected === true)) {
      return "verified";
    }
  }

  // String-based detection
  if (typeof value === "string") {
    const v = value.toLowerCase();
    if (v.includes("verified") || v.includes("valid") || v.includes("found") || v === "true") return "verified";
    if (v.includes("not") || v.includes("missing") || v.includes("absent") || v === "false") return "not-detected";
    if (v.includes("inconclusive") || v.includes("uncertain")) return "inconclusive";
    if (v.includes("error") || v.includes("failed")) return "error";
  }

  return "inconclusive";
}