import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import GlassCard from "../components/GlassCard";

const FEATURES = [
  {
    title: "Image Forensics",
    description:
      "Pixel-level and statistical analysis of still images — compression artifacts, noise patterns, and manipulation traces — compiled into an evidence report.",
    tag: null as string | null,
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="m21 15-5-5L5 21" />
      </svg>
    ),
  },
  {
    title: "Video Analysis",
    description:
      "Frame-level face-swap detection via uniform sampling. Each sampled frame runs through the EfficientNet-B0 detector — aggregated frame-level inferences, not a dedicated video model.",
    tag: "Available",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="2" y="5" width="14" height="14" rx="2" />
        <path d="m22 8-6 4 6 4V8Z" />
      </svg>
    ),
  },
  {
    title: "Audio Forensics",
    description:
      "Experimental spectral analysis — centroid, bandwidth, zero-crossing rate, and spectral rolloff produce a heuristic synthetic-speech indicator score. Weak signal only; not a validated detector.",
    tag: "Experimental",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="22" />
      </svg>
    ),
  },
  {
    title: "Multimodal",
    description:
      "Cross-modal consistency — matching audio to lip movement, text claims to visual evidence. A future direction for DeepForge.",
    tag: "Future",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" />
      </svg>
    ),
  },
];

const STEPS = [
  {
    title: "Upload",
    description: "Drop an image into the analyzer. Files are validated and processed in-memory.",
  },
  {
    title: "Forensic Analysis",
    description:
      "Independent detectors examine the media and report their own scores and uncertainty.",
  },
  {
    title: "Evidence Report",
    description:
      "Results are compiled into a transparent report with per-detector detail, limitations, and plain-language context.",
  },
];

export default function Home() {
  return (
    <div className="space-y-20">
      {/* Hero */}
      <section className="flex flex-col items-center pt-8 text-center sm:pt-14">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="flex max-w-3xl flex-col items-center"
        >
          <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-6xl">
            <span className="text-gradient">Digital Media Forensics,</span>
            <br />
            <span className="text-text-primary">Powered by AI</span>
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-text-secondary sm:text-lg">
            DeepForge investigates your media rather than labeling it — running independent forensic
            detectors and reporting their evidence with the uncertainty they honestly carry.
          </p>
          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
            <Link
              to="/analyze"
              className="bg-accent-gradient mt-8 inline-flex items-center gap-2 rounded-xl px-7 py-3.5 text-sm font-semibold text-black shadow-lg transition-shadow hover:shadow-accent-cyan/25 focus-visible:outline-2 focus-visible:outline-accent-cyan"
            >
              Analyze Media
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* Feature cards */}
      <section aria-labelledby="features-heading">
        <h2 id="features-heading" className="sr-only">
          Capabilities
        </h2>
        <div className="grid gap-5 sm:grid-cols-2">
          {FEATURES.map((feature, i) => (
            <GlassCard key={feature.title} hoverLift delay={i * 0.08} className="p-6">
              <div className="flex items-start justify-between gap-3">
                <div className="glass-subtle flex h-11 w-11 items-center justify-center rounded-xl text-accent-cyan">
                  {feature.icon}
                </div>
                {feature.tag && (
                  <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 font-mono text-[11px] text-text-muted">
                    {feature.tag}
                  </span>
                )}
              </div>
              <h3 className="mt-4 text-lg font-semibold text-text-primary">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                {feature.description}
              </p>
            </GlassCard>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section aria-labelledby="how-heading">
        <h2
          id="how-heading"
          className="text-center text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl"
        >
          How it works
        </h2>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <GlassCard key={step.title} delay={i * 0.08} className="relative p-6">
              <span
                aria-hidden="true"
                className="text-gradient font-mono text-4xl font-bold opacity-70"
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-3 text-lg font-semibold text-text-primary">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-text-secondary">{step.description}</p>
            </GlassCard>
          ))}
        </div>
      </section>

      {/* Our approach */}
      <section aria-labelledby="approach-heading">
        <GlassCard className="mx-auto max-w-4xl p-6 sm:p-10">
          <h2
            id="approach-heading"
            className="text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl"
          >
            Our approach
          </h2>
          <div className="mt-6 grid gap-8 sm:grid-cols-3">
            <div>
              <h3 className="text-sm font-semibold text-accent-cyan">Multi-model evidence</h3>
              <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                No single detector sees everything. DeepForge runs multiple independent models and
                shows you each one's contribution — not a hidden blend.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-accent-cyan">Uncertainty is a feature</h3>
              <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                When detectors disagree or models are unavailable, we say "inconclusive." A confident
                wrong answer is worse than an honest unknown.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-accent-cyan">Indicators, not verdicts</h3>
              <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                Results are probabilistic forensic indicators that support human review — they are
                not proof, and they are never presented as such.
              </p>
            </div>
          </div>
        </GlassCard>
      </section>
    </div>
  );
}
