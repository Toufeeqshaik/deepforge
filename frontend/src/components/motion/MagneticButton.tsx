"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import React, { useEffect, useRef, useState } from "react";

/* ============================================================================
   MAGNETIC BUTTON
   Subtle magnetic pointer pull + outer glow + tactile press feedback.
   Supports `asChild` so a react-router <Link> keeps its navigation behavior
   (the child is cloned, never replaced by a <button>).
   ========================================================================== */

type Variant = "primary" | "secondary" | "ghost" | "danger" | "violet" | "teal";
type Size = "sm" | "md" | "lg";

interface MagneticButtonBaseProps {
  children: React.ReactNode;
  variant?: Variant;
  size?: Size;
  magneticStrength?: number;
  glowIntensity?: number;
  className?: string;
  disableMagnetic?: boolean;
  style?: React.CSSProperties;
  onMouseEnter?: (e: React.MouseEvent<HTMLElement>) => void;
  onMouseLeave?: (e: React.MouseEvent<HTMLElement>) => void;
  onClick?: (e: React.MouseEvent<HTMLElement>) => void;
}

const baseStyles =
  "relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-0 disabled:cursor-not-allowed disabled:opacity-50";

const variantStyles: Record<Variant, string> = {
  primary:
    "bg-gradient-to-r from-accent to-accent-dim text-white shadow-[0_4px_18px_rgba(56,189,248,0.35)] hover:shadow-[0_6px_26px_rgba(56,189,248,0.5)]",
  secondary:
    "border border-white/10 bg-white/[0.04] text-text-secondary hover:border-white/20 hover:bg-white/[0.08] hover:text-fg-0",
  ghost: "text-text-secondary hover:bg-white/[0.06] hover:text-fg-0",
  danger:
    "bg-gradient-to-r from-red-500 to-red-600 text-white shadow-[0_4px_18px_rgba(239,68,68,0.35)]",
  violet:
    "bg-gradient-to-r from-violet-500 to-violet-600 text-white shadow-[0_4px_18px_rgba(168,85,247,0.35)] hover:shadow-[0_6px_26px_rgba(168,85,247,0.5)]",
  teal:
    "bg-gradient-to-r from-teal-400 to-teal-500 text-slate-950 shadow-[0_4px_18px_rgba(45,212,191,0.35)] hover:shadow-[0_6px_26px_rgba(45,212,191,0.5)]",
};

const sizeStyles: Record<Size, string> = {
  sm: "rounded-md px-3 py-1.5 text-xs",
  md: "rounded-lg px-4 py-2.5 text-sm",
  lg: "rounded-xl px-6 py-3 text-base",
};

function useMagnetic(strength: number, disabled: boolean) {
  const ref = useRef<HTMLElement | null>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduceMotion(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const springX = useSpring(x, { stiffness: 300, damping: 28, mass: 0.6 });
  const springY = useSpring(y, { stiffness: 300, damping: 28, mass: 0.6 });

  const mx = useTransform(springX, (v) => (reduceMotion ? 0 : v));
  const my = useTransform(springY, (v) => (reduceMotion ? 0 : v));

  const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    if (disabled || reduceMotion) return;
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    x.set((e.clientX - centerX) * strength);
    y.set((e.clientY - centerY) * strength);
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLElement>) => {
    x.set(0);
    y.set(0);
    onLeaveRef.current?.(e);
  };

  const handleMouseEnter = (e: React.MouseEvent<HTMLElement>) => {
    onEnterRef.current?.(e);
  };

  const handleMouseDown = () => {
    if (reduceMotion) return;
    x.set(x.get() * 0.5);
    y.set(y.get() * 0.5);
  };

  const onLeaveRef = useRef<((e: React.MouseEvent<HTMLElement>) => void) | null>(null);
  const onEnterRef = useRef<((e: React.MouseEvent<HTMLElement>) => void) | null>(null);

  return {
    ref,
    mx,
    my,
    handleMouseMove,
    handleMouseLeave,
    handleMouseEnter,
    handleMouseDown,
    onLeaveRef,
    onEnterRef,
  };
}

export default function MagneticButton({
  children,
  variant = "primary",
  size = "md",
  magneticStrength = 0.28,
  glowIntensity = 0.45,
  className = "",
  disableMagnetic = false,
  style,
  onMouseEnter,
  onMouseLeave,
  onClick,
  asChild = false,
  ...props
}: MagneticButtonBaseProps & {
  asChild?: boolean;
  [key: string]: unknown;
}) {
  const {
    ref,
    mx,
    my,
    handleMouseMove,
    handleMouseLeave,
    handleMouseEnter,
    handleMouseDown,
    onLeaveRef,
    onEnterRef,
  } = useMagnetic(magneticStrength, disableMagnetic);

  onLeaveRef.current = onMouseLeave ?? null;
  onEnterRef.current = onMouseEnter ?? null;

  const mergedClass = [baseStyles, variantStyles[variant], sizeStyles[size], className]
    .filter(Boolean)
    .join(" ");

  const glow = (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 rounded-[inherit] opacity-0 blur-lg transition-opacity duration-300 group-hover:opacity-100"
      style={{
        background: `radial-gradient(ellipse at center, rgba(56,189,248,${glowIntensity * 0.5}) 0%, transparent 70%)`,
      }}
    />
  );

  // asChild: clone the provided element (e.g. <Link>) so navigation is intact.
  if (asChild && React.isValidElement(children)) {
    const child = children as React.ReactElement<{ className?: string }>;
    const childClass = `${mergedClass} ${child.props.className ?? ""}`.trim();

    return (
      <motion.span
        ref={ref as React.Ref<HTMLSpanElement>}
        className="group relative inline-flex"
        style={{ x: mx, y: my }}
        whileTap={{ scale: 0.98 }}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onMouseDown={handleMouseDown}
      >
        {glow}
        {React.cloneElement(child, { className: childClass })}
      </motion.span>
    );
  }

  return (
    <motion.button
      ref={ref as React.Ref<HTMLButtonElement>}
      type="button"
      className={`group ${mergedClass}`}
      style={{ ...style, x: mx, y: my }}
      whileTap={{ scale: 0.98 }}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleMouseDown}
      onClick={onClick}
      {...props}
    >
      {glow}
      {children}
    </motion.button>
  );
}