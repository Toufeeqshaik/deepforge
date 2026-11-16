import { NavLink } from "react-router-dom";
import type { ReactNode } from "react";
import { motion } from "framer-motion";

const NAV_ITEMS = [
  { to: "/", label: "Home" },
  { to: "/analyze", label: "Analyze Image" },
  { to: "/video", label: "Video Analysis" },
  { to: "/audio", label: "Audio Analysis" },
  { to: "/history", label: "History" },
  { to: "/about", label: "About" },
] as const;

function LogoMark() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 28 28"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      <defs>
        <linearGradient id="df-logo-grad" x1="4" y1="2" x2="24" y2="26">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      {/* Shield */}
      <path
        d="M14 2.5 24 6v8.2c0 6-4.2 9.9-10 11.3C8.2 24.1 4 20.2 4 14.2V6l10-3.5Z"
        stroke="url(#df-logo-grad)"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      {/* Lens / aperture */}
      <circle cx="14" cy="13" r="4.4" stroke="url(#df-logo-grad)" strokeWidth="1.6" />
      <circle cx="14" cy="13" r="1.6" fill="url(#df-logo-grad)" />
    </svg>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="ambient-glow" aria-hidden="true" />

      <header className="glass sticky top-0 z-40">
        <nav
          aria-label="Primary"
          className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6"
        >
          <NavLink
            to="/"
            className="flex items-center gap-2.5 rounded-md focus-visible:outline-2 focus-visible:outline-accent-cyan"
            aria-label="DeepForge home"
          >
            <LogoMark />
            <span className="text-lg font-semibold tracking-tight">
              Deep<span className="text-gradient">Forge</span>
            </span>
          </NavLink>

          <ul className="flex items-center gap-1 sm:gap-2">
            {NAV_ITEMS.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-accent-cyan ${
                      isActive
                        ? "bg-white/10 text-text-primary"
                        : "text-text-secondary hover:bg-white/5 hover:text-text-primary"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <motion.main
        className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 pt-8 sm:px-6"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
      >
        {children}
      </motion.main>

      <footer className="border-t border-white/5 py-6">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-2 px-4 text-center sm:px-6">
          <p className="text-xs text-text-muted">
            Forensic indicators — not legally conclusive determinations.
          </p>
          <p className="text-xs text-text-muted">
            DeepForge provides probabilistic evidence to support human review.
          </p>
        </div>
      </footer>
    </div>
  );
}
