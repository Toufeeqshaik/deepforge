import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Check,
  ShieldAlert,
  Info,
  SlidersHorizontal,
} from "lucide-react";
import GlassCard from "../components/GlassCard";

/* ============================================================================
   Sensitivity presets — an illustrative trade-off view.
   The backend thresholds stay fixed and published; these bars explain what an
   operator trades away when they move a threshold, they do not change a run.
   ========================================================================== */
type PresetKey = "subtle" | "balanced" | "maximum";

interface Preset {
  label: string;
  blurb: string;
  sensitivity: number;
  falsePositive: number;
  compute: number;
  accent: string;
  ring: string;
}

const PRESETS: Record<PresetKey, Preset> = {
  subtle: {
    label: "Subtle",
    blurb: "Conservative. Fewer flags, lower false-positive risk.",
    sensitivity: 34,
    falsePositive: 12,
    compute: 26,
    accent: "bg-cyan-400",
    ring: "border-cyan-400/45 bg-cyan-400/[0.05]",
  },
  balanced: {
    label: "Balanced",
    blurb: "Default operating view. Surfaces clear signals first.",
    sensitivity: 62,
    falsePositive: 30,
    compute: 55,
    accent: "bg-violet-400",
    ring: "border-violet-400/45 bg-violet-400/[0.05]",
  },
  maximum: {
    label: "Maximum",
    blurb: "Aggressive. Surfaces weak traces at higher false-positive risk.",
    sensitivity: 88,
    falsePositive: 64,
    compute: 92,
    accent: "bg-amber-400",
    ring: "border-amber-400/45 bg-amber-400/[0.05]",
  },
};

function TradeoffBar({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 font-mono text-[9px] uppercase tracking-wider">
        <span className="text-text-muted">{label}</span>
        <span className="tabular-nums text-text-secondary">{value}%</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${color}`}
          style={{ width: `${value}%` }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

interface SystemRow {
  name: string;
  type: string;
  models: string[];
  media: string[];
  openSource: boolean;
  apiAvailable: boolean;
  notes: string;
  deepforgeBetter: string[];
  othersBetter: string[];
}

const SYSTEMS: SystemRow[] = [
  {
    name: "DeepForge (this platform)",
    type: "Open research prototype",
    models: ["EfficientNet-B0 (FaceForensics++ C23)"],
    media: ["Image", "Video (frame sampling)", "Audio (spectral heuristic)"],
    openSource: true,
    apiAvailable: true,
    notes:
      "Transparent, no fabricated scores. Video uses frame sampling; audio uses experimental spectral heuristics. One detector per file.",
    deepforgeBetter: [
      "Open architecture — every limitation is published",
      "No hidden black-box scores",
      "Free to self-host and inspect",
    ],
    othersBetter: [
      "No dedicated video deepfake model",
      "No validated audio deepfake model",
      "Smaller research dataset (FF++ C23)",
    ],
  },
  {
    name: "Sensity",
    type: "Commercial SaaS",
    models: ["Proprietary deepfake detection models"],
    media: ["Image", "Video", "Audio"],
    openSource: false,
    apiAvailable: true,
    notes:
      "Commercial deepfake detection platform with image, video, and audio modules. Closed-source models; pricing not public.",
    deepforgeBetter: ["Open source and self-hostable", "No per-analysis fees"],
    othersBetter: [
      "Dedicated video and audio detection models",
      "Commercial support and SLA",
      "Larger proprietary training datasets",
    ],
  },
  {
    name: "Microsoft Video Authenticator",
    type: "Research / Commercial",
    models: ["Proprietary deepfake detection model"],
    media: ["Video", "Image"],
    openSource: false,
    apiAvailable: false,
    notes:
      "Microsoft's deepfake detection tool. Outputs a manipulation confidence score. Not openly available for public self-hosting.",
    deepforgeBetter: ["Open source", "Self-hostable", "Transparent verdicts"],
    othersBetter: [
      "Backed by Microsoft research",
      "Video-native temporal analysis",
    ],
  },
  {
    name: "Intel FakeCatcher",
    type: "Research",
    models: ["Proprietary (blood-flow / PPG signal analysis)"],
    media: ["Video"],
    openSource: false,
    apiAvailable: false,
    notes:
      "Intel's real-time deepfake detector using remote photoplethysmography (rPPG) — analyzes blood-flow signals in video frames. Claims 96% accuracy. Not publicly available.",
    deepforgeBetter: ["Open source", "Works on still images too"],
    othersBetter: [
      "96% claimed accuracy (video)",
      "Real-time video analysis",
      "Hardware-accelerated (Intel CPUs)",
    ],
  },
  {
    name: "DuckDuckGoose",
    type: "Commercial SaaS",
    models: ["Proprietary deepfake detection models"],
    media: ["Image", "Video", "Audio"],
    openSource: false,
    apiAvailable: true,
    notes:
      "Dutch deepfake detection company. Offers image, video, and audio detection via API. Closed-source.",
    deepforgeBetter: ["Open source", "No subscription required"],
    othersBetter: ["Dedicated audio deepfake detection", "Commercial support"],
  },
  {
    name: "Resemble AI (Resemble Detect)",
    type: "Commercial SaaS",
    models: ["Proprietary audio deepfake detection model"],
    media: ["Audio"],
    openSource: false,
    apiAvailable: true,
    notes:
      "Audio-focused deepfake detection for voice cloning and synthetic speech. Closed-source.",
    deepforgeBetter: ["Open source", "Also does image and video"],
    othersBetter: [
      "Validated audio deepfake detection",
      "Voice-clone specific model",
    ],
  },
];

function boolCell(value: boolean) {
  return (
    <span className="flex items-center justify-center gap-2 text-[11px]">
      {value ? (
        <span className="flex items-center gap-1 text-text-secondary">
          <Check size={10} className="text-verdict-authentic" /> Yes
        </span>
      ) : (
        <span className="flex items-center gap-1 text-text-secondary">
          <ShieldAlert size={10} className="text-verdict-manipulated" /> No
        </span>
      )}
    </span>
  );
}

export default function Comparison() {
  const [preset, setPreset] = useState<PresetKey>("balanced");
  const activePreset = PRESETS[preset];

  return (
    <div className="space-y-8">
      <header className="pt-2 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          <span className="text-gradient">System Comparison</span>
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-text-secondary sm:text-base">
          Honest feature comparison between DeepForge and other deepfake detection platforms.
          DeepForge is open-source and publishes every limitation — commercial systems do not.
        </p>
      </header>

      {/* Sensitivity presets — illustrative trade-off bars */}
      <GlassCard className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted">
              <SlidersHorizontal className="h-3.5 w-3.5 text-accent-cyan" aria-hidden="true" />
              Sensitivity profiles
            </p>
            <h2 className="mt-1 text-lg font-semibold text-text-primary">
              What a threshold choice trades away
            </h2>
          </div>
          <span className="status-pill status-pill-pending">Illustrative</span>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3" role="group" aria-label="Sensitivity preset">
          {(Object.keys(PRESETS) as PresetKey[]).map((key) => {
            const item = PRESETS[key];
            const selected = preset === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setPreset(key)}
                aria-pressed={selected}
                className={`rounded-xl border p-4 text-left transition-colors ${
                  selected
                    ? item.ring
                    : "border-white/[0.07] bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04]"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-text-primary">{item.label}</span>
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      selected ? item.accent : "bg-white/15"
                    }`}
                    aria-hidden="true"
                  />
                </div>
                <p className="mt-1 min-h-[32px] text-[11px] leading-relaxed text-text-muted">
                  {item.blurb}
                </p>
                <div className="mt-3 space-y-2.5">
                  <TradeoffBar label="Sensitivity" value={item.sensitivity} color={item.accent} />
                  <TradeoffBar
                    label="False-positive risk"
                    value={item.falsePositive}
                    color="bg-amber-400/80"
                  />
                  <TradeoffBar
                    label="Compute cost"
                    value={item.compute}
                    color="bg-violet-400/80"
                  />
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-cyan" aria-hidden="true" />
          <p className="text-[11px] leading-relaxed text-text-muted">
            <span className="font-medium text-text-secondary">
              {activePreset.label} profile selected.
            </span>{" "}
            These bars explain the sensitivity / false-positive trade-off. DeepForge publishes its
            fixed detector thresholds (0.40 / 0.70 / 0.85); selecting a profile here does not
            change a backend run or manufacture a score.
          </p>
        </div>
      </GlassCard>

      <GlassCard className="p-6 sm:p-8 stagger-children">
        <h2 className="text-lg font-semibold text-text-primary mb-3">Feature comparison</h2>
        <p className="text-xs text-text-muted mb-5">
          Based on publicly available information about each system. DeepForge is a research prototype
          — not a commercial product — and makes no accuracy guarantees.
        </p>
        <div className="overflow-x-auto border border-white/5 rounded-xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                <th className="p-3 font-mono-tabular-xs uppercase tracking-wider text-text-muted">Feature</th>
                {SYSTEMS.map((s) => (
                  <th key={s.name} className="p-3 font-mono-tabular-xs uppercase tracking-wider text-text-muted">
                    {s.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-white/5">
                <td className="p-3 font-mono-tabular-xs text-text-secondary">Type</td>
                {SYSTEMS.map((s) => (
                  <td key={s.name} className="p-3 text-[11px] text-text-secondary">{s.type}</td>
                ))}
              </tr>
              <tr className="border-b border-white/5">
                <td className="p-3 font-mono-tabular-xs text-text-secondary">Open source</td>
                {SYSTEMS.map((s) => (
                  <td key={s.name} className="p-3">{boolCell(s.openSource)}</td>
                ))}
              </tr>
              <tr className="border-b border-white/5">
                <td className="p-3 font-mono-tabular-xs text-text-secondary">API available</td>
                {SYSTEMS.map((s) => (
                  <td key={s.name} className="p-3">{boolCell(s.apiAvailable)}</td>
                ))}
              </tr>
              <tr className="border-b border-white/5">
                <td className="p-3 font-mono-tabular-xs text-text-secondary">Image detection</td>
                {SYSTEMS.map((s) => (
                  <td key={s.name} className="p-3 text-[11px] text-text-secondary">
                    {s.media.includes("Image") ? "Yes" : "No"}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-white/5">
                <td className="p-3 font-mono-tabular-xs text-text-secondary">Video detection</td>
                {SYSTEMS.map((s) => (
                  <td key={s.name} className="p-3 text-[11px] text-text-secondary">
                    {s.media.some((m) => m.includes("Video")) ? "Yes" : "No"}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-white/5">
                <td className="p-3 font-mono-tabular-xs text-text-secondary">Audio detection</td>
                {SYSTEMS.map((s) => (
                  <td key={s.name} className="p-3 text-[11px] text-text-secondary">
                    {s.media.some((m) => m.includes("Audio")) ? "Yes" : "No"}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </GlassCard>

      <div className="grid gap-5 lg:grid-cols-2">
        {SYSTEMS.map((system, i) => (
          <GlassCard key={system.name} hoverLift delay={i * 0.05} className="p-5 sm:p-6">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="shrink-0 rounded-lg border border-white/10 bg-white/5 p-2">
                  <Info size={16} className="text-accent-cyan" aria-hidden="true" />
                </div>
                <div>
                  <p className="font-semibold text-text-primary">{system.name}</p>
                  <p className="mt-1 text-[11px] text-text-secondary">{system.type}</p>
                </div>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-text-secondary">
                {system.notes}
              </p>
              <dl className="mt-4 space-y-2 border-t border-white/5 pt-3">
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-xs text-text-muted">Models</dt>
                  <dd className="text-right font-mono-tabular-xs text-text-secondary">{system.models.join(", ")}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-xs text-text-muted">Media types</dt>
                  <dd className="text-right font-mono-tabular-xs text-text-secondary">{system.media.join(", ")}</dd>
                </div>
              </dl>
              <div className="mt-4">
                <p className="text-[10px] font-medium text-accent-cyan mb-2 uppercase tracking-wider">
                  DeepForge advantages
                </p>
                <ul className="space-y-1 text-[11px] text-text-secondary">
                  {system.deepforgeBetter.map((item, idx) => (
                    <li key={idx} className="flex gap-1.5">
                      <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-accent-cyan/60" aria-hidden="true" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-3">
                <p className="text-[10px] font-medium text-text-secondary mb-2 uppercase tracking-wider">
                  Others may be better for
                </p>
                <ul className="space-y-1 text-[11px] text-text-secondary">
                  {system.othersBetter.map((item, idx) => (
                    <li key={idx} className="flex gap-1.5">
                      <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-white/10" aria-hidden="true" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </GlassCard>
        ))}
      </div>

      <GlassCard className="p-6 sm:p-8 stagger-children">
        <h2 className="text-lg font-semibold text-text-primary mb-3">Why DeepForge publishes its limitations</h2>
        <p className="text-[11px] leading-relaxed text-text-secondary mb-5">
          Most commercial deepfake detectors are black boxes: they return a score without telling
          you which model was used, what data it was trained on, or how accurate it is on your
          specific type of manipulation. DeepForge takes the opposite approach — every model,
          threshold, and limitation is published in the UI.
        </p>
        <ul className="space-y-2 text-[11px] leading-relaxed text-text-secondary">
          <li className="flex gap-2">
            <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-accent-cyan/60" aria-hidden="true" />
            No fabricated detection scores — if the model isn't loaded, no verdict is produced
          </li>
          <li className="flex gap-2">
            <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-accent-cyan/60" aria-hidden="true" />
            Video and audio detection are explicitly experimental / heuristic
          </li>
          <li className="flex gap-2">
            <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-accent-cyan/60" aria-hidden="true" />
            All detection thresholds (0.40 / 0.70 / 0.85) are visible and documented
          </li>
          <li className="flex gap-2">
            <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-accent-cyan/60" aria-hidden="true" />
            Open source — self-host, inspect, and modify as needed
          </li>
        </ul>
      </GlassCard>

      <div className="text-center mt-6">
        <Link
          to="/analyze"
          className="bg-accent-gradient rounded-xl px-6 py-3 text-sm font-semibold text-black shadow-lg inline-flex items-center gap-2 focus-visible:outline-2 focus-visible:outline-accent-cyan"
        >
          Run an analysis
          <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}