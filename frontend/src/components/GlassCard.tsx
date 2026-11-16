import { motion } from "framer-motion";
import type { HTMLMotionProps } from "framer-motion";
import type { ReactNode } from "react";

interface GlassCardProps extends Omit<HTMLMotionProps<"div">, "children"> {
  children: ReactNode;
  /** Hover lift effect (on by default; disable for static panels). */
  hoverLift?: boolean;
  /** Stagger index for entrance animation delay. */
  delay?: number;
}

export default function GlassCard({
  children,
  hoverLift = false,
  delay = 0,
  className = "",
  ...rest
}: GlassCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut", delay }}
      whileHover={hoverLift ? { y: -4 } : undefined}
      className={`glass rounded-2xl ${className}`}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
