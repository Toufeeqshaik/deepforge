import { motion } from "framer-motion";
import type { HTMLMotionProps } from "framer-motion";
import type { ReactNode } from "react";

interface GlassCardProps extends Omit<HTMLMotionProps<"div">, "children"> {
  children: ReactNode;
  /** Hover lift effect (on by default; disable for static panels). */
  hoverLift?: boolean;
  /** Stagger index for entrance animation delay. */
  delay?: number;
  /** Elevation level */
  elevation?: "flat" | "raised" | "overlay";
  /** Interactive (clickable) card */
  interactive?: boolean;
  /** Border accent on hover */
  accentBorder?: boolean;
}

export default function GlassCard({
  children,
  hoverLift = false,
  delay = 0,
  className = "",
  elevation = "raised",
  interactive = false,
  accentBorder = false,
  ...rest
}: GlassCardProps) {
  const elevationClasses = {
    flat: "glass-subtle",
    raised: "glass",
    overlay: "glass-strong",
  };

  const interactiveClasses = interactive
    ? "cursor-pointer transition-all duration-200"
    : "";

  const hoverStyles = hoverLift
    ? { y: -4, boxShadow: "var(--glass-shadow-hover)" }
    : interactive
    ? { y: -2, boxShadow: "var(--glass-shadow-hover)" }
    : {};

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut", delay }}
      whileHover={hoverLift || interactive ? hoverStyles : undefined}
      whileTap={interactive ? { scale: 0.98 } : undefined}
      className={`
        ${elevationClasses[elevation]}
        rounded-2xl
        ${accentBorder ? "border-accent-cyan/30" : ""}
        ${interactiveClasses}
        ${className}
      `}
      {...rest}
    >
      {children}
    </motion.div>
  );
}