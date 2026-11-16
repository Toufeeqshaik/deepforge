/**
 * Verdict metadata mapping. Colors come from the semantic tokens in
 * src/index.css; `inconclusive` has no token and renders neutrally.
 */
export interface VerdictMeta {
  label: string;
  /** Foreground text color class. */
  text: string;
  /** Soft background class. */
  bg: string;
  /** Border class. */
  border: string;
  /** Raw hex, for custom uses (dots, bars). */
  hex: string;
  /** Tailwind theme token name, or null for neutral verdicts. */
  token: "verdict-authentic" | "verdict-uncertain" | "verdict-suspicious" | "verdict-manipulated" | null;
}

const NEUTRAL: VerdictMeta = {
  label: "Inconclusive",
  text: "text-text-secondary",
  bg: "bg-white/5",
  border: "border-white/15",
  hex: "#9aa7bd",
  token: null,
};

const MAP: Record<string, VerdictMeta> = {
  likely_authentic: {
    label: "Likely Authentic",
    text: "text-verdict-authentic",
    bg: "bg-verdict-authentic/10",
    border: "border-verdict-authentic/30",
    hex: "#34d399",
    token: "verdict-authentic",
  },
  uncertain: {
    label: "Uncertain",
    text: "text-verdict-uncertain",
    bg: "bg-verdict-uncertain/10",
    border: "border-verdict-uncertain/30",
    hex: "#fbbf24",
    token: "verdict-uncertain",
  },
  potentially_manipulated: {
    label: "Potentially Manipulated",
    text: "text-verdict-suspicious",
    bg: "bg-verdict-suspicious/10",
    border: "border-verdict-suspicious/30",
    hex: "#fb923c",
    token: "verdict-suspicious",
  },
  likely_manipulated: {
    label: "Likely Manipulated",
    text: "text-verdict-manipulated",
    bg: "bg-verdict-manipulated/10",
    border: "border-verdict-manipulated/30",
    hex: "#f87171",
    token: "verdict-manipulated",
  },
  inconclusive: NEUTRAL,
};

/** Resolve any verdict string (overall verdicts and per-detector verdicts). */
export function getVerdictMeta(verdict: string): VerdictMeta {
  return MAP[verdict] ?? NEUTRAL;
}
