import { Link } from "react-router-dom";
import GlassCard from "../components/GlassCard";

export default function About() {
  return (
    <div className="space-y-8">
      <section className="pt-4 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          <span className="text-gradient">About DeepForge</span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-text-secondary sm:text-base">
          Synthetic and manipulated media is getting harder to spot by eye. DeepForge exists to give
          people transparent forensic evidence about the images they encounter — with the limits of
          that evidence stated up front.
        </p>
      </section>

      <GlassCard className="p-6 sm:p-10" delay={0.05}>
        <h2 className="text-xl font-semibold text-text-primary">Mission</h2>
        <p className="mt-3 text-sm leading-relaxed text-text-secondary sm:text-base">
          Build accessible, honest media forensics. We believe the answer to manipulated media is not
          a louder scoreboard of "real vs. fake," but better <em>evidence</em>: what was analyzed,
          what each detector observed, where models disagree, and what none of them can tell you.
        </p>
      </GlassCard>

      <GlassCard className="p-6 sm:p-10" delay={0.1}>
        <h2 className="text-xl font-semibold text-text-primary">The honest-uncertainty philosophy</h2>
        <div className="mt-4 space-y-4 text-sm leading-relaxed text-text-secondary sm:text-base">
          <p>
            Many tools present a single score with false confidence. DeepForge does the opposite:
            every result carries its uncertainty with it, and when evidence is absent we return{" "}
            <strong className="text-text-primary">Inconclusive</strong> rather than guessing.
          </p>
          <p>
            While detector models are being integrated, the platform validates your file and clearly
            states that no AI analysis has run. We would rather show you an empty result than an
            invented one — the interface never fabricates scores, verdicts, or details.
          </p>
          <p>
            Verdicts are expressed in tiers — Likely Authentic, Uncertain, Potentially Manipulated,
            Likely Manipulated — because forensic evidence is probabilistic. A tier is a starting
            point for human judgment, never a substitute for it.
          </p>
        </div>
      </GlassCard>

      <GlassCard className="p-6 sm:p-10" delay={0.15}>
        <h2 className="text-xl font-semibold text-text-primary">Technology stack</h2>
        <div className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold text-accent-cyan">Frontend</h3>
            <ul className="mt-2 space-y-1 text-sm text-text-secondary">
              <li>· React 19 + TypeScript (strict)</li>
              <li>· Vite + Tailwind CSS v4</li>
              <li>· Framer Motion animations</li>
              <li>· Dark glass design system</li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-accent-cyan">Backend</h3>
            <ul className="mt-2 space-y-1 text-sm text-text-secondary">
              <li>· FastAPI REST API (port 8000)</li>
              <li>· Analysis pipeline with staged reports</li>
              <li>· Pluggable detector registry</li>
              <li>· Per-detector calibration &amp; scoring</li>
            </ul>
          </div>
        </div>
      </GlassCard>

      <GlassCard className="border-verdict-manipulated/25 p-6 sm:p-10" delay={0.2}>
        <h2 className="text-xl font-semibold text-verdict-manipulated">Limitations</h2>
        <ul className="mt-4 space-y-3 text-sm leading-relaxed text-text-secondary">
          <li className="flex gap-2.5">
            <span aria-hidden="true" className="mt-2 h-1 w-1 shrink-0 rounded-full bg-verdict-manipulated" />
            Results are probabilistic indicators, not proof. They can be wrong in both directions —
            flagging authentic media or missing sophisticated manipulation.
          </li>
          <li className="flex gap-2.5">
            <span aria-hidden="true" className="mt-2 h-1 w-1 shrink-0 rounded-full bg-verdict-manipulated" />
            Adversarial pressure is constant: as detectors improve, so do generation techniques.
            Accuracy on novel manipulation methods is not guaranteed.
          </li>
          <li className="flex gap-2.5">
            <span aria-hidden="true" className="mt-2 h-1 w-1 shrink-0 rounded-full bg-verdict-manipulated" />
            Not all media types are covered yet — image analysis is the current focus; video and
            audio are under active development.
          </li>
          <li className="flex gap-2.5">
            <span aria-hidden="true" className="mt-2 h-1 w-1 shrink-0 rounded-full bg-verdict-manipulated" />
            DeepForge output is not admissible as sole evidence in legal, journalistic, or platform
            moderation decisions. Always corroborate with provenance and source verification.
          </li>
        </ul>
      </GlassCard>

      <p className="pt-2 text-center text-sm text-text-muted">
        Questions about the approach?{" "}
        <Link
          to="/analyze"
          className="text-accent-cyan underline underline-offset-2 transition-colors hover:text-accent-violet focus-visible:outline-2 focus-visible:outline-accent-cyan"
        >
          Try the analyzer
        </Link>{" "}
        and see the honesty for yourself.
      </p>
    </div>
  );
}
