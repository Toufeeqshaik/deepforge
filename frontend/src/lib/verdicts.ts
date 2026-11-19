/**
 * Verdict metadata mapping. Colors come from the semantic tokens in
 * src/index.css; `inconclusive` has no token and renders neutrally.
 * 
 * New verdict mapping (per requirements):
 * - likely_authentic -> Likely REAL (green)
 * - uncertain -> Uncertain (yellow) 
 * - potentially_manipulated / likely_manipulated -> Likely FAKE (red)
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
  token: "verdict-authentic" | "verdict-uncertain" | "verdict-manipulated" | null;
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
    label: "Likely REAL",
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
    label: "Likely FAKE",
    text: "text-verdict-manipulated",
    bg: "bg-verdict-manipulated/10",
    border: "border-verdict-manipulated/30",
    hex: "#f87171",
    token: "verdict-manipulated",
  },
  likely_manipulated: {
    label: "Likely FAKE",
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
