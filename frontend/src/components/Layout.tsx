import { Link, NavLink, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  GitCompare,
  History,
  Home,
  Image as ImageIcon,
  Info,
  Loader2,
  Menu,
  Music,
  Shield,
  Video,
  Wifi,
  WifiOff,
  X,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { getHealth } from "../lib/api";

/* ============================================================================
   Layout — sticky HUD header, route-aware nav indicator, forensic right cluster
   ========================================================================== */

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Home", icon: Home },
  { to: "/analyze", label: "Image", icon: ImageIcon },
  { to: "/video", label: "Video", icon: Video },
  { to: "/audio", label: "Audio", icon: Music },
  { to: "/comparison", label: "Compare", icon: GitCompare },
  { to: "/history", label: "History", icon: History },
  { to: "/about", label: "About", icon: Info },
];

/* ── Mode toggle (Detect / Shield) ─────────────────────────────── */
function ModeToggle({ compact = false }: { compact?: boolean }) {
  const [mode, setMode] = useState<"detect" | "shield">("detect");

  return (
    <div className="segmented-control" role="group" aria-label="Operation mode">
      <button
        type="button"
        onClick={() => setMode("detect")}
        aria-pressed={mode === "detect"}
        className={`segmented-btn ${
          mode === "detect"
            ? "segmented-btn-active !border-teal-400/30 !bg-teal-400/10 !text-teal-300"
            : ""
        } ${compact ? "!px-2.5 !py-1 !text-[11px]" : ""}`}
      >
        <Zap className="h-3.5 w-3.5" aria-hidden="true" />
        <span>Detect</span>
      </button>
      <button
        type="button"
        onClick={() => setMode("shield")}
        aria-pressed={mode === "shield"}
        className={`segmented-btn ${
          mode === "shield"
            ? "!border-violet-400/30 !bg-violet-400/10 !text-violet-300"
            : ""
        } ${compact ? "!px-2.5 !py-1 !text-[11px]" : ""}`}
      >
        <Shield className="h-3.5 w-3.5" aria-hidden="true" />
        <span>Shield</span>
      </button>
    </div>
  );
}

/* ── API status pill ───────────────────────────────────────────── */
function APIStatusPill() {
  const [status, setStatus] = useState<"connected" | "connecting" | "disconnected">(
    "connecting",
  );
  const [modelsLoaded, setModelsLoaded] = useState<string[]>([]);

  const checkHealth = useCallback(async () => {
    try {
      const health = await getHealth();
      setStatus("connected");
      setModelsLoaded(health.models_loaded);
    } catch {
      setStatus("disconnected");
      setModelsLoaded([]);
    }
  }, []);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 30_000);
    return () => clearInterval(interval);
  }, [checkHealth]);

  const config = {
    connected: {
      className: "api-pill-connected",
      dot: "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]",
      icon: <Wifi className="h-3 w-3" aria-hidden="true" />,
      label: "API",
      title: modelsLoaded.length ? `Models loaded: ${modelsLoaded.join(", ")}` : "API connected",
    },
    connecting: {
      className: "api-pill-connecting",
      dot: "bg-cyan-400",
      icon: <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />,
      label: "API",
      title: "Connecting to analysis service",
    },
    disconnected: {
      className: "api-pill-disconnected",
      dot: "bg-red-400",
      icon: <WifiOff className="h-3 w-3" aria-hidden="true" />,
      label: "API",
      title: "Analysis service unreachable",
    },
  }[status];

  return (
    <span
      className={`api-pill ${config.className}`}
      title={config.title}
      aria-label={config.title}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} aria-hidden="true" />
      {config.icon}
      <span>{config.label}</span>
    </span>
  );
}

/* ── Multimodal pill ───────────────────────────────────────────── */
function MultimodalPill() {
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-violet-400/25 bg-violet-400/10 px-2.5 py-1 font-mono text-[9px] font-medium uppercase tracking-wider text-violet-300"
      aria-label="Multimodal analysis enabled"
    >
      <Activity className="h-3 w-3" aria-hidden="true" />
      Multimodal
    </span>
  );
}

/* ── Nav item with animated active pill ────────────────────────── */
function NavItemLink({
  item,
  layoutId,
  onNavigate,
}: {
  item: NavItem;
  layoutId: string;
  onNavigate?: () => void;
}) {
  const { icon: Icon } = item;

  return (
    <NavLink
      to={item.to}
      end={item.to === "/"}
      onClick={onNavigate}
      className={({ isActive }) =>
        `nav-link relative whitespace-nowrap ${isActive ? "nav-link-active" : ""}`
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.span
              layoutId={layoutId}
              aria-hidden="true"
              className="absolute inset-0 -z-10 rounded-[10px] border border-white/[0.09] bg-white/[0.065]"
              transition={{ type: "spring", stiffness: 380, damping: 32 }}
            />
          )}
          <Icon
            className={`h-3.5 w-3.5 shrink-0 ${isActive ? "text-cyan-300" : "text-fg-3"}`}
            aria-hidden="true"
          />
          <span>{item.label}</span>
        </>
      )}
    </NavLink>
  );
}

/* ── Mobile nav drawer ─────────────────────────────────────────── */
function MobileNav({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-40 bg-black/65 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
            className="glass-strong fixed right-0 top-0 z-50 flex h-full w-full max-w-sm flex-col border-l border-glass-border"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
          >
            <div className="flex items-center justify-between border-b border-glass-border px-4 py-3.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted">
                Navigation
              </span>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-2 text-fg-3 transition-colors hover:bg-white/10 hover:text-fg-0"
                aria-label="Close menu"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="Main navigation">
              {NAV_ITEMS.map((item) => (
                <NavItemLink
                  key={item.to}
                  item={item}
                  layoutId="nav-active-mobile"
                  onNavigate={onClose}
                />
              ))}
            </nav>

            <div className="space-y-3 border-t border-glass-border p-4">
              <ModeToggle compact />
              <div className="flex items-center justify-between gap-2">
                <APIStatusPill />
                <MultimodalPill />
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

/* ── Layout ────────────────────────────────────────────────────── */
export default function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 8);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <>
      <header
        className={`sticky top-0 z-50 border-b transition-all duration-300 ${
          scrolled
            ? "border-white/[0.09] bg-[rgba(5,6,8,0.82)] shadow-[0_10px_36px_rgba(0,0,0,0.45)] backdrop-blur-xl"
            : "border-transparent bg-[rgba(5,6,8,0.38)] backdrop-blur-md"
        }`}
        role="banner"
      >
        <div className="container-page">
          <div className="flex h-16 items-center gap-4">
            {/* Wordmark */}
            <NavLink
              to="/"
              className="flex shrink-0 items-center gap-2.5"
              aria-label="DeepForge home"
            >
              <svg
                width="26"
                height="26"
                viewBox="0 0 28 28"
                fill="none"
                aria-hidden="true"
                className="shrink-0"
              >
                <defs>
                  <linearGradient id="df-logo-grad" x1="4" y1="2" x2="24" y2="26">
                    <stop offset="0%" stopColor="#38BDF8" />
                    <stop offset="55%" stopColor="#2DD4BF" />
                    <stop offset="100%" stopColor="#C084FC" />
                  </linearGradient>
                </defs>
                <path
                  d="M14 2.5 24 6v8.2c0 6-4.2 9.9-10 11.3C8.2 24.1 4 20.2 4 14.2V6l10-3.5Z"
                  stroke="url(#df-logo-grad)"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
                <path
                  d="M9.5 14h9M14 9.5v9"
                  stroke="url(#df-logo-grad)"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                />
                <circle cx="14" cy="14" r="1.4" fill="url(#df-logo-grad)" />
              </svg>
              <span className="hidden text-[17px] font-bold tracking-tight text-text-primary sm:block">
                DeepForge
              </span>
            </NavLink>

            {/* Desktop navigation */}
            <nav
              className="hidden min-w-0 items-center gap-0.5 lg:flex"
              aria-label="Main navigation"
            >
              {NAV_ITEMS.map((item) => (
                <NavItemLink key={item.to} item={item} layoutId="nav-active-desktop" />
              ))}
            </nav>

            {/* Right cluster */}
            <div className="ml-auto flex shrink-0 items-center gap-2 pl-2">
              <div className="hidden xl:flex">
                <ModeToggle compact />
              </div>
              <APIStatusPill />
              <span className="hidden sm:inline-flex">
                <MultimodalPill />
              </span>
              <button
                type="button"
                className="rounded-lg p-2 text-fg-3 transition-colors hover:bg-white/10 hover:text-fg-0 lg:hidden"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Open menu"
                aria-expanded={mobileMenuOpen}
              >
                <Menu className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <MobileNav isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />

      <main id="main-content" className="page-container min-h-[calc(100vh-4rem)]" role="main">
        {children}
      </main>

      <footer className="border-t border-white/[0.07]" role="contentinfo">
        <div className="container-page flex flex-col items-center justify-between gap-3 py-5 text-[11px] text-text-muted sm:flex-row">
          <p>
            DeepForge — transparent media forensics.{" "}
            <span className="text-text-secondary">Evidence, not verdicts.</span>
          </p>
          <div className="flex items-center gap-4 font-mono text-[10px]">
            <Link to="/about" className="transition-colors hover:text-text-secondary">
              Method
            </Link>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-text-secondary"
              aria-label="GitHub repository"
            >
              GitHub
            </a>
            <span className="text-fg-3">v0.1.0</span>
          </div>
        </div>
      </footer>
    </>
  );
}
