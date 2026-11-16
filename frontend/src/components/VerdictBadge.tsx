import { getVerdictMeta } from "../lib/verdicts";

interface VerdictBadgeProps {
  verdict: string;
  /** Optional size variant; defaults to "md". */
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZES = {
  sm: "px-2 py-0.5 text-xs",
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
