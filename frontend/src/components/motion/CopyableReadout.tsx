"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Check, Hash, ExternalLink } from "lucide-react";

/* ============================================================================
   COPYABLE READOUT
   Monospace readout for SHA-256 hashes, IDs, or endpoints with one-click copy
   and "Copied ✓" state feedback
   ========================================================================== */

interface CopyableReadoutProps {
  value: string;
  label?: string;
  type?: "hash" | "id" | "url" | "token" | "custom";
  truncated?: boolean;            // Show truncated version with tooltip
  truncateLength?: number;        // Characters before truncation (default 16)
  showIcon?: boolean;             // Show type icon (default true)
  copySuccessDuration?: number;   // ms to show "Copied" state (default 2000)
  className?: string;
  style?: React.CSSProperties;
  onCopy?: (value: string) => void;
  "aria-label"?: string;
}

const typeIcons = {
  hash: <Hash className="w-4 h-4" aria-hidden="true" />,
  id: <Hash className="w-4 h-4" aria-hidden="true" />,
  url: <ExternalLink className="w-4 h-4" aria-hidden="true" />,
  token: <Hash className="w-4 h-4" aria-hidden="true" />,
  custom: <Hash className="w-4 h-4" aria-hidden="true" />,
};

const typeLabels = {
  hash: "SHA-256",
  id: "ID",
  url: "URL",
  token: "TOKEN",
  custom: "VALUE",
};

export default function CopyableReadout({
  value,
  label,
  type = "hash",
  truncated = true,
  truncateLength = 16,
  showIcon = true,
  copySuccessDuration = 2000,
  className = "",
  style,
  onCopy,
  "aria-label": ariaLabel,
}: CopyableReadoutProps) {
  const [copied, setCopied] = useState(false);
  const [hovered, setHovered] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduceMotionRef = useRef(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    reduceMotionRef.current = mediaQuery.matches;
    const handler = (e: MediaQueryListEvent) => (reduceMotionRef.current = e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      onCopy?.(value);

      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setCopied(false), copySuccessDuration);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  }, [value, onCopy, copySuccessDuration]);

  const displayValue = truncated && value.length > truncateLength * 2
    ? `${value.slice(0, truncateLength)}…${value.slice(-truncateLength)}`
    : value;

  const effectiveAriaLabel = ariaLabel || `Copy ${label || typeLabels[type]} to clipboard`;

  return (
    <div
      className={`inline-flex items-center gap-2 ${className}`}
      style={style}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Icon + Label */}
      {(showIcon || label) && (
        <span className="flex items-center gap-1.5 text-fg-3 text-[11px] font-mono uppercase tracking-wider">
          {showIcon && <span className="text-accent/70">{typeIcons[type]}</span>}
          {label ? (
            <span>{label}</span>
          ) : (
            <span>{typeLabels[type]}</span>
          )}
        </span>
      )}

      {/* Readout value */}
      <button
        type="button"
        onClick={handleCopy}
        className={`
          relative flex items-center gap-2
          px-3 py-2 rounded-lg
          bg-[rgba(148,163,184,0.04)] border border-glass-border
          text-fg-1 font-mono tabular-nums text-sm
          transition-all duration-200
          hover:bg-[rgba(148,163,184,0.08)] hover:border-glass-border-strong hover:text-fg-0
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-0
          cursor-pointer select-none
        `}
        aria-label={effectiveAriaLabel}
        title={truncated && value.length > truncateLength * 2 ? value : undefined}
      >
        <span className="truncate max-w-[280px]">{displayValue}</span>

        {/* Copy icon / Copied state */}
        <AnimatePresence mode="wait">
          {copied ? (
            <motion.span
              key="copied"
              initial={{ opacity: 0, scale: 0.8, x: 4 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.8, x: -4 }}
              transition={{ duration: reduceMotionRef.current ? 0.01 : 0.15, ease: [0.34, 1.56, 0.64, 1] }}
              className="flex items-center gap-1 text-status-ok text-[11px] font-medium"
            >
              <span>Copied ✓</span>
            </motion.span>
          ) : (
            <motion.span
              key="copy"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: hovered ? 1 : 0.5, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: reduceMotionRef.current ? 0.01 : 0.15 }}
              className="flex items-center text-fg-3 hover:text-accent transition-colors"
            >
              <Copy className="w-4 h-4" aria-hidden="true" />
            </motion.span>
          )}
        </AnimatePresence>
      </button>
    </div>
  );
}

/* ============================================================================
   COPYABLE READOUT - EXPANDABLE (for long hashes/tokens)
   ========================================================================== */

interface ExpandableReadoutProps extends Omit<CopyableReadoutProps, "truncated"> {
  expanded?: boolean;
  onExpandChange?: (expanded: boolean) => void;
}

export function ExpandableReadout({
  value,
  label,
  type = "hash",
  truncateLength = 16,
  showIcon = true,
  copySuccessDuration = 2000,
  className = "",
  style,
  onCopy,
  expanded = false,
  onExpandChange,
  "aria-label": ariaLabel,
}: ExpandableReadoutProps) {
  const [copied, setCopied] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [isExpanded, setIsExpanded] = useState(expanded);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduceMotionRef = useRef(false);

  useEffect(() => {
    setIsExpanded(expanded);
  }, [expanded]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    reduceMotionRef.current = mediaQuery.matches;
    const handler = (e: MediaQueryListEvent) => (reduceMotionRef.current = e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      onCopy?.(value);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setCopied(false), copySuccessDuration);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  }, [value, onCopy, copySuccessDuration]);

  const handleToggle = () => {
    const next = !isExpanded;
    setIsExpanded(next);
    onExpandChange?.(next);
  };

  const displayValue = isExpanded || value.length <= truncateLength * 2
    ? value
    : `${value.slice(0, truncateLength)}…${value.slice(-truncateLength)}`;

  const effectiveAriaLabel = ariaLabel || `Copy ${label || typeLabels[type]} to clipboard`;

  return (
    <div
      className={`inline-flex items-center gap-2 ${className}`}
      style={style}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {(showIcon || label) && (
        <span className="flex items-center gap-1.5 text-fg-3 text-[11px] font-mono uppercase tracking-wider">
          {showIcon && <span className="text-accent/70">{typeIcons[type]}</span>}
          {label ? <span>{label}</span> : <span>{typeLabels[type]}</span>}
        </span>
      )}

      <div className="relative flex items-center gap-2">
        <button
          type="button"
          onClick={handleCopy}
          className={`
            flex items-center gap-2 px-3 py-2 rounded-lg
            bg-[rgba(148,163,184,0.04)] border border-glass-border
            text-fg-1 font-mono tabular-nums text-sm
            transition-all duration-200
            hover:bg-[rgba(148,163,184,0.08)] hover:border-glass-border-strong hover:text-fg-0
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-0
            cursor-pointer select-none
          `}
          aria-label={effectiveAriaLabel}
          title={!isExpanded && value.length > truncateLength * 2 ? value : undefined}
        >
          <span className="truncate max-w-[280px]">{displayValue}</span>

          <AnimatePresence mode="wait">
            {copied ? (
              <motion.span
                key="copied"
                initial={{ opacity: 0, scale: 0.8, x: 4 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.8, x: -4 }}
                transition={{ duration: reduceMotionRef.current ? 0.01 : 0.15, ease: [0.34, 1.56, 0.64, 1] }}
                className="flex items-center gap-1 text-status-ok text-[11px] font-medium"
              >
                <Check className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Copied</span>
              </motion.span>
            ) : (
              <motion.span
                key="copy"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: hovered ? 1 : 0.5, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: reduceMotionRef.current ? 0.01 : 0.15 }}
                className="flex items-center text-fg-3 hover:text-accent transition-colors"
              >
                <Copy className="w-4 h-4" aria-hidden="true" />
              </motion.span>
            )}
          </AnimatePresence>
        </button>

        {/* Expand/collapse toggle */}
        {value.length > truncateLength * 2 && (
          <button
            type="button"
            onClick={handleToggle}
            className={`
              p-2 rounded-lg
              bg-[rgba(148,163,184,0.04)] border border-glass-border
              text-fg-3 hover:text-fg-0 hover:bg-[rgba(148,163,184,0.08)] hover:border-glass-border-strong
              transition-all duration-200
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-0
              cursor-pointer
            `}
            aria-label={isExpanded ? "Collapse" : "Expand"}
            aria-expanded={isExpanded}
          >
            <motion.span
              animate={{ rotate: isExpanded ? 180 : 0 }}
              transition={{ duration: reduceMotionRef.current ? 0.01 : 0.2, ease: [0.34, 1.56, 0.64, 1] }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </motion.span>
          </button>
        )}
      </div>
    </div>
  );
}