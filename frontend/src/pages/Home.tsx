import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  Activity,
  Fingerprint,
  GitCompare,
  Layers,
  Music,
  ScanSearch,
  ShieldCheck,
  Terminal,
  Video,
  Zap,
} from "lucide-react";
import {
  MagneticButton,
  ScrambleText,
} from "../components/motion";
import AxonParticleField from "../components/motion/AxonParticleField";
import FaceScanVisualization from "../components/motion/FaceScanVisualization";

/* ============================================================================
   DeepForge — Home
   Full-bleed procedural vortex behind a glass forensic workstation.
   Evidence-first language: every detector signal is reported independently.
   ========================================================================== */

type Accent = "cyan" | "violet" | "amber" | "teal";

interface AccentStyles {
  border: string;
  hoverBorder: string;
  topLine: string;
  iconWrap: string;
  icon: string;
  badge: string;
  chip: string;
  link: string;
}

const ACCENTS: Record<Accent, AccentStyles> = {
  cyan: {
    border: "border-cyan-400/20",
    hoverBorder: "hover:border-cyan-400/45",
    topLine: "from-cyan-400/90 via-cyan-400/30 to-transparent",
    iconWrap: "border-cyan-400/25 bg-cyan-400/10",
    icon: "text-cyan-300",
    badge: "border-cyan-400/30 bg-cyan-400/10 text-cyan-200",
    chip: "border-cyan-400/15 bg-cyan-400/[0.04] text-cyan-100/70",
    link: "text-cyan-300 hover:text-cyan-200",
  },
  violet: {
    border: "border-violet-400/20",
    hoverBorder: "hover:border-violet-400/45",
    topLine: "from-violet-400/90 via-violet-400/30 to-transparent",
    iconWrap: "border-violet-400/25 bg-violet-400/10",
    icon: "text-violet-300",
    badge: "border-violet-400/30 bg-violet-400/10 text-violet-200",
    chip: "border-violet-400/15 bg-violet-400/[0.04] text-violet-100/70",
    link: "text-violet-300 hover:text-violet-200",
  },
  amber: {
    border: "border-amber-400/20",
    hoverBorder: "hover:border-amber-400/45",
    topLine: "from-amber-400/90 via-amber-400/30 to-transparent",
    iconWrap: "border-amber-400/25 bg-amber-400/10",
    icon: "text-amber-300",
    badge: "border-amber-400/30 bg-amber-400/10 text-amber-200",
    chip: "border-amber-400/15 bg-amber-400/[0.04] text-amber-100/70",
    link: "text-amber-300 hover:text-amber-200",
  },
  teal: {
    border: "border-teal-400/20",
    hoverBorder: "hover:border-teal-400/45",
    topLine: "from-teal-400/90 via-teal-400/30 to-transparent",
    iconWrap: "border-teal-400/25 bg-teal-400/10",
    icon: "text-teal-300",
    badge: "border-teal-400/30 bg-teal-400/10 text-teal-200",
    chip: "border-teal-400/15 bg-teal-400/[0.04] text-teal-100/70",
    link: "text-teal-300 hover:text-teal-200",
  },
};

interface Capability {
  title: string;
  description: string;
  status: "Available" | "Experimental";
  accent: Accent;
  href: string;
  Icon: typeof ScanSearch;
  detectors: string[];
}

const CAPABILITIES: Capability[] = [
  {
    title: "Image Forensics",
    description:
      "Multi-detector inspection of still images — compression artifacts, sensor noise, signed provenance, and frequency traces compiled into a structured evidence report.",
    status: "Available",
    accent: "cyan",
    href: "/analyze",
    Icon: ScanSearch,
    detectors: ["ELA", "Noise", "C2PA", "Metadata", "JPEG Ghosts", "FFT"],
  },
  {
    title: "Video Analysis",
    description:
      "Frame-level face-swap detection through uniform sampling. Each sampled frame runs through the detector independently; results are aggregated frame inferences, not a dedicated video model.",
    status: "Available",
    accent: "violet",
    href: "/video",
    Icon: Video,
    detectors: ["Frame Sampling", "SimLBR Ensemble", "Temporal Check", "Face Track"],
  },
  {
    title: "Audio Forensics",
    description:
      "Experimental spectral analysis — centroid, bandwidth, zero-crossing rate, and rolloff produce a heuristic synthetic-speech indicator. Not a validated deepfake detector.",
    status: "Experimental",
    accent: "amber",
    href: "/audio",
    Icon: Music,
    detectors: ["Spectral Centroid", "Bandwidth", "ZCR", "Rolloff"],
  },
  {
    title: "System Comparison",
    description:
      "Side-by-side detector agreement across analysis runs. Compare verdicts, confidence intervals, and evidence alignment without collapsing signals into one score.",
    status: "Available",
    accent: "teal",
    href: "/comparison",
    Icon: GitCompare,
    detectors: ["Agreement Matrix", "Verdict Alignment", "Confidence", "Evidence Audit"],
  },
];

const METHODS = [
  { label: "ELA", detail: "Error level analysis" },
  { label: "Noise Analysis", detail: "Sensor noise consistency" },
  { label: "C2PA / Metadata", detail: "Signed provenance & EXIF" },
  { label: "Frame & Temporal", detail: "Motion consistency" },
  { label: "Spectral Analysis", detail: "Frequency-domain inspection" },
  { label: "Agreement Matrix", detail: "Cross-detector comparison" },
  { label: "SHA-256", detail: "Byte-exact fingerprint" },
  { label: "Evidence Audit", detail: "Full signal trail" },
] as const;

const PIPELINES = [
  {
    name: "Image Pipeline",
    route: "/analyze/image",
    status: "Online",
    tone: "teal" as const,
  },
  {
    name: "Video Pipeline",
    route: "/analyze/video",
    status: "Online",
    tone: "violet" as const,
  },
  {
    name: "Audio Pipeline",
    route: "/analyze/audio",
    status: "Experimental",
    tone: "amber" as const,
  },
];

const PIPELINE_TONES = {
  teal: {
    dot: "bg-teal-400 shadow-[0_0_10px_rgba(45,212,191,0.55)]",
    badge: "border-teal-400/30 bg-teal-400/10 text-teal-300",
    row: "border-white/[0.06]",
  },
  violet: {
    dot: "bg-violet-400 shadow-[0_0_10px_rgba(168,85,247,0.55)]",
    badge: "border-violet-400/30 bg-violet-400/10 text-violet-300",
    row: "border-white/[0.06]",
  },
  amber: {
    dot: "bg-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.55)]",
    badge: "border-amber-400/30 bg-amber-400/10 text-amber-300",
    row: "border-amber-400/25 bg-amber-400/[0.06]",
  },
} as const;

function CapabilityCard({ capability }: { capability: Capability }) {
  const a = ACCENTS[capability.accent];
  const { Icon } = capability;

  return (
    <article
      className={`glass group relative flex h-full flex-col overflow-hidden rounded-2xl border p-5 transition-all duration-300 hover:-translate-y-1 ${a.border} ${a.hoverBorder}`}
    >
      <span
        aria-hidden="true"
        className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r ${a.topLine}`}
      />

      <div className="flex items-start justify-between gap-3">
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${a.iconWrap}`}
        >
          <Icon className={`h-5 w-5 ${a.icon}`} aria-hidden="true" />
        </span>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider ${a.badge}`}
        >
          <span className="h-1 w-1 rounded-full bg-current" aria-hidden="true" />
          {capability.status}
        </span>
      </div>

      <h3 className="mt-4 text-base font-semibold tracking-tight text-text-primary">
        {capability.title}
      </h3>
      <p className="mt-2 flex-1 text-[13px] leading-relaxed text-text-secondary">
        {capability.description}
      </p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {capability.detectors.slice(0, 4).map((detector) => (
          <span
            key={detector}
            className={`rounded-md border px-2 py-0.5 font-mono text-[10px] ${a.chip}`}
          >
            {detector}
          </span>
        ))}
        {capability.detectors.length > 4 && (
          <span className="rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 font-mono text-[10px] text-text-muted">
            +{capability.detectors.length - 4}
          </span>
        )}
      </div>

      <Link
        to={capability.href}
        className={`mt-5 inline-flex items-center gap-1.5 text-[13px] font-medium transition-colors ${a.link}`}
      >
        Open analysis
        <ArrowUpRight
          className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          aria-hidden="true"
        />
      </Link>
    </article>
  );
}

function PipelineRow({ pipeline }: { pipeline: (typeof PIPELINES)[number] }) {
  const tone = PIPELINE_TONES[pipeline.tone];

  // Detail tooltip content
  const detail = {
    "/analyze/image": "Scope: Still images (JPEG, PNG, WebP) · Detectors: ELA, Noise, C2PA, Metadata, JPEG Ghosts, FFT",
    "/analyze/video": "Scope: Video files (MP4, WebM) · Frame sampling + SimLBR ensemble · Temporal consistency",
    "/analyze/audio": "Scope: Audio files (WAV, MP3, FLAC) · Spectral heuristic (centroid, bandwidth, ZCR, rolloff) · Experimental",
  }[pipeline.route];

  return (
    <Link
      to={pipeline.route}
      className={`group glass-subtle flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 ${tone.row} transition-all duration-200 hover:border-cyan-400/30 hover:bg-cyan-400/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-0`}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          window.location.href = pipeline.route;
        }
      }}
      aria-label={`${pipeline.name} — ${pipeline.status} — ${detail}`}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${tone.dot}`} aria-hidden="true" />
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-text-primary group-hover:text-cyan-300 transition-colors">{pipeline.name}</p>
          <p className="truncate font-mono text-[10px] text-text-muted">{pipeline.route}</p>
        </div>
      </div>
      <span
        className={`shrink-0 rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider ${tone.badge} transition-colors`}
      >
        {pipeline.status}
      </span>

      {/* Hover/focus detail tooltip — CSS-only for performance */}
      <span className="absolute bottom-full left-0 right-0 mb-2 px-3 py-2 glass-strong rounded-lg border border-white/[0.08] text-[11px] text-text-secondary opacity-0 translate-y-1 pointer-events-none transition-all duration-150 group-hover:opacity-100 group-hover:translate-y-0 group-focus-visible:opacity-100 group-focus-visible:translate-y-0 z-10 whitespace-nowrap">
        {detail}
      </span>
    </Link>
  );
}

function PipelineStatusCard() {
  return (
    <aside
      className="glass-subtle relative overflow-hidden rounded-2xl p-4 transition-all duration-500 hover:shadow-[0_0_30px_rgba(56,189,248,0.12)] hover:border-cyan-400/20 animate-slide-up-fade"
      style={{
        // Subtle floating animation
        animation: 'float-subtle 6s ease-in-out infinite',
      }}
    >
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent"
      />
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-text-secondary">
          <Activity className="h-3 w-3 text-cyan-300" aria-hidden="true" />
          <ScrambleText trigger="mount" duration={420}>
            Pipeline Status
          </ScrambleText>
        </h2>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-400/25 bg-teal-400/10 px-2 py-0.5 font-mono text-[8px] uppercase tracking-wider text-teal-300">
          <span className="h-1 w-1 animate-pulse rounded-full bg-teal-400" aria-hidden="true" />
          Live
        </span>
      </div>

      <div className="mt-3 space-y-1.5">
        {PIPELINES.map((pipeline) => (
          <PipelineRow key={pipeline.name} pipeline={pipeline} />
        ))}
      </div>

      <dl className="mt-3 space-y-1.5 border-t border-white/[0.06] pt-3 font-mono text-[9px]">
        <div className="flex items-center justify-between gap-3">
          <dt className="flex items-center gap-1 text-text-muted">
            <Layers className="h-2.5 w-2.5" aria-hidden="true" />
            Detector registry
          </dt>
          <dd className="tabular-nums text-text-secondary">
            <span className="tabular-nums">6 image</span>
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="flex items-center gap-1 text-text-muted">
            <Fingerprint className="h-2.5 w-2.5" aria-hidden="true" />
            File fingerprint
          </dt>
          <dd className="text-text-secondary">SHA-256</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="flex items-center gap-1 text-text-muted">
            <Terminal className="h-2.5 w-2.5" aria-hidden="true" />
            Engine
          </dt>
          <dd className="text-text-secondary">v0.1.0</dd>
        </div>
      </dl>
    </aside>
  );
}

function TelemetryStrip() {
  const items = [
    {
      label: "Media pipelines",
      value: <span>3</span>,
      tone: "text-cyan-300",
    },
    {
      label: "Image detectors",
      value: <span>6</span>,
      tone: "text-teal-300",
    },
    {
      label: "Fingerprint",
      value: <span className="text-[15px]">SHA-256</span>,
      tone: "text-violet-300",
    },
    {
      label: "Third-party assets",
      value: <span>0</span>,
      tone: "text-amber-300",
    },
  ];

  return (
    <div className="glass grid grid-cols-2 divide-white/[0.06] overflow-hidden rounded-xl md:grid-cols-4 md:divide-x">
      {items.map((item) => (
        <div key={item.label} className="px-4 py-3">
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-text-muted">
            {item.label}
          </p>
          <p className={`mt-1 font-mono text-2xl font-medium tabular-nums ${item.tone}`}>
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  return (
    <>
      {typeof document !== "undefined" &&
        createPortal(
          <div className="pointer-events-none fixed inset-0 z-0" aria-hidden="true">
            <AxonParticleField particleCount={2200} />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(5,6,8,0.48)_0%,rgba(5,6,8,0.54)_42%,rgba(5,6,8,0.78)_72%,rgba(5,6,8,0.94)_100%)]" />
            <div className="absolute inset-x-0 bottom-0 h-72 bg-gradient-to-t from-bg-0 via-bg-0/60 to-transparent" />
          </div>,
          document.body,
        )}

      <div data-axon-visibility className="relative z-10 space-y-12 pb-4 sm:space-y-16">
        {/* ── Hero ───────────────────────────────────────────────────── */}
        <section aria-labelledby="hero-heading" className="stagger-children">
          <div className="grid items-start gap-8 lg:grid-cols-12 xl:gap-12">
            <div className="rounded-2xl p-5 sm:p-6 lg:col-span-7 lg:p-8" style={{ background: 'transparent', backdropFilter: 'none', border: 'none', boxShadow: 'none' }}>
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-cyan-300/80">
                  <ScrambleText trigger="mount" duration={520}>
                    DeepForge · Media Forensics
                  </ScrambleText>
                </span>
                <span className="h-3 w-px bg-white/15" aria-hidden="true" />
                <span className="rounded-full border border-amber-400/25 bg-amber-400/10 px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em] text-amber-300">
                  Active development
                </span>
                <span className="font-mono text-[10px] text-text-muted">v0.1.0</span>
              </div>

              <h1
                id="hero-heading"
                className="mt-5 text-4xl font-bold leading-[1.06] tracking-[-0.03em] text-text-primary sm:text-5xl lg:text-6xl xl:text-[4.15rem]"
              >
                Transparent media forensics.
                <br />
                <span className="text-text-primary">Evidence, </span>
                <span className="bg-gradient-to-r from-cyan-300 via-cyan-400 to-teal-300 bg-clip-text text-transparent">
                  not verdicts.
                </span>
              </h1>

              <p className="mt-5 max-w-xl text-base leading-relaxed text-text-secondary sm:text-lg">
                DeepForge runs structured detection pipelines on images, video, and audio —
                surfacing raw detector evidence with confidence scores, byte-exact fingerprints,
                and published limitations. No black-box scores. Just auditable signals.
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <MagneticButton
                  asChild
                  variant="primary"
                  size="md"
                  magneticStrength={0.3}
                  glowIntensity={0.45}
                >
                  <Link to="/analyze" className="inline-flex items-center gap-2">
                    <ScanSearch className="h-4 w-4" aria-hidden="true" />
                    Analyze Image
                  </Link>
                </MagneticButton>
                <MagneticButton
                  asChild
                  variant="secondary"
                  size="md"
                  magneticStrength={0.24}
                  glowIntensity={0.3}
                >
                  <Link to="/video" className="inline-flex items-center gap-2">
                    <Video className="h-4 w-4" aria-hidden="true" />
                    Video Analysis
                  </Link>
                </MagneticButton>
                <MagneticButton
                  asChild
                  variant="ghost"
                  size="md"
                  magneticStrength={0.18}
                  glowIntensity={0.2}
                >
                  <Link to="/audio" className="inline-flex items-center gap-2">
                    <Music className="h-4 w-4" aria-hidden="true" />
                    Audio Analysis
                  </Link>
                </MagneticButton>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[10px] text-text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="h-3 w-3 text-teal-400" aria-hidden="true" />
                  Client-side SHA-256
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Zap className="h-3 w-3 text-cyan-400" aria-hidden="true" />
                  Independent signals
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Fingerprint className="h-3 w-3 text-violet-400" aria-hidden="true" />
                  Input bytes unmodified
                </span>
              </div>
            </div>

            <div className="lg:col-span-5 mt-20 lg:mt-0">
              <FaceScanVisualization className="animate-slide-up-fade" />
            </div>
          </div>

          <div className="mt-8">
            <TelemetryStrip />
          </div>
        </section>

        {/* ── Pipeline Status (moved below hero) ───────────────────────── */}
        <section aria-labelledby="pipeline-status-heading" className="animate-slide-up-fade">
          <PipelineStatusCard />
        </section>

        {/* ── Detection capabilities ─────────────────────────────────── */}
        <section aria-labelledby="capabilities-heading">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-text-muted">
                <ScrambleText trigger="visible" duration={420}>
                  Detection capabilities
                </ScrambleText>
              </p>
              <h2
                id="capabilities-heading"
                className="mt-1 text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl"
              >
                Four pipelines. One evidence standard.
              </h2>
            </div>
            <span className="hidden shrink-0 font-mono text-[10px] text-text-muted sm:block">
              04 pipelines / 03 media types
            </span>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {CAPABILITIES.map((capability) => (
              <CapabilityCard key={capability.title} capability={capability} />
            ))}
          </div>
        </section>

        {/* ── Forensic methods ───────────────────────────────────────── */}
        <section
          aria-labelledby="methods-heading"
          className="rounded-2xl border border-white/[0.07] bg-[rgba(8,11,15,0.62)] p-5 backdrop-blur-md sm:p-6"
        >
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-text-muted">
                <ScrambleText trigger="visible" duration={420}>
                  Forensic methods
                </ScrambleText>
              </p>
              <h2
                id="methods-heading"
                className="mt-1 text-xl font-semibold tracking-tight text-text-primary"
              >
                Every signal stays independent.
              </h2>
            </div>
            <p className="max-w-md text-[11px] leading-relaxed text-text-muted">
              Signals are reported side by side — never averaged into a single authenticity
              score. Missing evidence is never treated as proof of authenticity.
            </p>
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {METHODS.map((method, index) => (
              <div
                key={method.label}
                className="group flex items-start gap-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 transition-colors hover:border-cyan-400/25 hover:bg-cyan-400/[0.04]"
              >
                <span className="mt-0.5 font-mono text-[9px] tabular-nums text-text-muted group-hover:text-cyan-300/80">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-mono text-[10px] uppercase tracking-wider text-text-secondary group-hover:text-text-primary">
                    {method.label}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-text-muted">{method.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Operating principle ────────────────────────────────────── */}
        <section
          aria-labelledby="principle-heading"
          className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[rgba(10,13,20,0.7)] p-6 backdrop-blur-md sm:p-8"
        >
          <span
            aria-hidden="true"
            className="absolute inset-y-0 left-0 w-px bg-gradient-to-b from-cyan-400/60 via-violet-400/30 to-transparent"
          />
          <div className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
            <div className="max-w-2xl">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-300/80">
                Operating principle
              </p>
              <h2
                id="principle-heading"
                className="mt-1 text-xl font-semibold tracking-tight text-text-primary sm:text-2xl"
              >
                We publish the method, the limits, and the raw evidence.
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                DeepForge is a research prototype, not a commercial verdict engine. Every detector,
                threshold, and known failure mode is visible in the interface — including the ones
                that make a result inconclusive.
              </p>
            </div>
            <MagneticButton
              asChild
              variant="secondary"
              size="md"
              magneticStrength={0.22}
              glowIntensity={0.25}
              className="shrink-0"
            >
              <Link to="/about" className="inline-flex items-center gap-2">
                Read the methodology
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </MagneticButton>
          </div>
        </section>

        <div className="glass-subtle flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3 font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted" aria-label="DeepForge forensic signals">
          <span className="text-cyan-200/80">DeepForge / Forensic signal</span>
          <span>Independent evidence</span>
          <span>Client-side SHA-256</span>
          <span>Zero third-party assets</span>
        </div>
      </div>
    </>
  );
}
