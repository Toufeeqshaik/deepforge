"use client";

import { motion, AnimatePresence } from "framer-motion";

/* ============================================================================
   PIPELINE STEPPER
   Multi-stage forensic pipeline visualization with animated progress.
   Reusable across Image, Video, and Audio analysis pages.
   ========================================================================== */

export interface PipelineStage {
  label: string;
  detail?: string;
}

interface PipelineStepperProps {
  stages: readonly PipelineStage[];
  currentStage: number;        // 0-based index of currently executing stage
  completedStages?: number;    // number of fully completed stages (default = currentStage)
  className?: string;
  ariaLabel?: string;
}

export function PipelineStepper({
  stages,
  currentStage,
  completedStages = currentStage,
  className = "",
  ariaLabel = "Analysis pipeline progress",
}: PipelineStepperProps) {
  return (
    <AnimatePresence mode="wait">
      <motion.ol
        key={stages.length}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className={`space-y-3 ${className}`}
        aria-live="polite"
        role="list"
        aria-label={ariaLabel}
      >
        {stages.map((stage, i) => {
          const active = i === currentStage && currentStage < stages.length;
          const done = i < completedStages;
          const isLast = i === stages.length - 1;

          return (
            <li
              key={stage.label}
              className="relative flex items-start gap-3 group"
            >
              {/* Vertical connector line */}
              {!isLast && (
                <motion.div
                  className="absolute left-[15px] top-8 h-full w-0.5 bg-white/5"
                  initial={false}
                  animate={{
                    scaleY: done ? 1 : active ? 0.3 : 0,
                    backgroundColor: done
                      ? "rgba(34, 211, 238, 0.4)"
                      : active
                      ? "rgba(34, 211, 238, 0.2)"
                      : "rgba(255, 255, 255, 0.05)",
                  }}
                  transition={{ duration: 0.4, ease: "easeOut", delay: 0.1 }}
                  aria-hidden="true"
                />
              )}

              <div className="flex items-center gap-3 relative z-10">
                {/* Stage indicator circle */}
                <motion.div
                  initial={false}
                  animate={{
                    backgroundColor: done || active
                      ? "rgba(34, 211, 238, 0.15)"
                      : "rgba(255, 255, 255, 0.05)",
                    borderColor: done || active
                      ? "rgba(34, 211, 238, 0.4)"
                      : "rgba(255, 255, 255, 0.1)",
                    boxShadow: active
                      ? "0 0 16px rgba(34, 211, 238, 0.25)"
                      : done
                      ? "0 0 8px rgba(34, 211, 238, 0.15)"
                      : "none",
                  }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-all duration-300"
                >
                  {done ? (
                    <motion.svg
                      initial={{ scale: 0, rotate: -90 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ duration: 0.3, ease: "easeOut", delay: 0.1 }}
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-accent-cyan"
                      aria-hidden="true"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </motion.svg>
                  ) : active ? (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      className="bg-accent-cyan block h-2.5 w-2.5 rounded-full animate-pulse"
                      aria-hidden="true"
                    />
                  ) : (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ duration: 0.2, ease: "easeOut", delay: i * 0.05 }}
                      className="block h-2.5 w-2.5 rounded-full bg-current opacity-30"
                      aria-hidden="true"
                    />
                  )}
                </motion.div>

                {/* Stage label and detail */}
                <div className="min-w-0">
                  <motion.span
                    initial={false}
                    animate={{
                      color: active
                        ? "rgb(var(--color-text-primary))"
                        : done
                        ? "rgb(var(--color-text-secondary))"
                        : "rgb(var(--color-text-muted))",
                    }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="block text-sm font-medium truncate transition-colors"
                  >
                    {stage.label}
                  </motion.span>
                  {stage.detail && (
                    <motion.p
                      initial={{ opacity: 0, height: 0 }}
                      animate={{
                        opacity: active || done ? 1 : 0,
                        height: active || done ? "auto" : 0,
                      }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      className="text-[11px] text-text-muted mt-0.5 truncate"
                    >
                      {stage.detail}
                    </motion.p>
                  )}
                </div>
              </div>

              {/* Stage status badge */}
              <motion.div
                initial={false}
                animate={{
                  opacity: active ? 1 : done ? 1 : 0,
                  scale: active || done ? 1 : 0.8,
                }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="flex-shrink-0 ml-auto self-center"
              >
                {active && (
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-accent-cyan/10 border border-accent-cyan/20 px-2 py-0.5 font-mono text-[9px] font-medium uppercase tracking-wider text-accent-cyan animate-pulse"
                    aria-live="polite"
                  >
                    <span className="relative h-1.5 w-1.5 rounded-full bg-accent-cyan animate-pulse" aria-hidden="true" />
                    Running
                  </span>
                )}
                {done && (
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-teal-400/10 border border-teal-400/20 px-2 py-0.5 font-mono text-[9px] font-medium uppercase tracking-wider text-teal-300"
                  >
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-teal-300"
                      aria-hidden="true"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Done
                  </span>
                )}
              </motion.div>
            </li>
          );
        })}
      </motion.ol>
    </AnimatePresence>
  );
}

export default PipelineStepper;