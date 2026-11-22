"use client";

import { motion, type MotionProps } from "framer-motion";
import { useReducedMotion } from "framer-motion";

/* ============================================================================
   ROUTE TRANSITION
   Smooth ~200ms crossfade + subtle vertical slide (y: 8px -> 0)
   Respects prefers-reduced-motion
   ========================================================================== */

interface RouteTransitionProps extends Omit<MotionProps, "initial" | "animate" | "exit" | "transition" | "className"> {
  children: React.ReactNode;
  mode?: "default" | "fade-only" | "slide-up" | "scale";
  className?: string;
  style?: React.CSSProperties;
}

const variants = {
  default: {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -8 },
    transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] },
  },
  "fade-only": {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.15, ease: [0.16, 1, 0.3, 1] },
  },
  "slide-up": {
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -16 },
    transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] },
  },
  scale: {
    initial: { opacity: 0, scale: 0.96 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.96 },
    transition: { duration: 0.18, ease: [0.16, 1, 0.3, 1] },
  },
};

export default function RouteTransition({
  children,
  mode = "default",
  className,
  style,
  ...props
}: RouteTransitionProps) {
  const shouldReduceMotion = useReducedMotion();

  const reducedVariants = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.01 },
  };

  const activeVariants = shouldReduceMotion ? reducedVariants : variants[mode];

  return (
    <motion.div
      initial={activeVariants.initial}
      animate={activeVariants.animate}
      exit={activeVariants.exit}
      transition={activeVariants.transition}
      className={className}
      style={style}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/* ============================================================================
   PAGE TRANSITION WRAPPER (for AnimatePresence)
   ========================================================================== */

interface PageTransitionProps {
  children: React.ReactNode;
  mode?: RouteTransitionProps["mode"];
  className?: string;
}

export function PageTransition({ children, mode = "default", className = "" }: PageTransitionProps) {
  return (
    <motion.div
      key={typeof window !== "undefined" ? window.location.pathname : "initial"}
      initial={mode === "default" ? { opacity: 0, y: 8 } : { opacity: 0 }}
      animate={mode === "default" ? { opacity: 1, y: 0 } : { opacity: 1 }}
      exit={mode === "default" ? { opacity: 0, y: -8 } : { opacity: 0 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}