"use client";

import { useEffect, useRef, useState, useCallback } from "react";

/* ============================================================================
   SCRAMBLE TEXT
   Subtle character scramble (~300ms) for HUD tags/labels/section titles
   Does not obscure readable body text or hashes
   ========================================================================== */

interface ScrambleTextProps {
  children: string;
  trigger?: boolean | "hover" | "mount" | "visible";
  duration?: number;              // Total animation duration in ms (default 300)
  charset?: string;               // Characters to use for scrambling
  className?: string;
  style?: React.CSSProperties;
  onComplete?: () => void;
  preserveCase?: boolean;         // Preserve uppercase/lowercase (default true)
  exclude?: RegExp;               // Characters to never scramble (default: whitespace, punctuation)
}

const DEFAULT_CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const DEFAULT_EXCLUDE = /[\s\-_:.()[\]{}]/;

export default function ScrambleText({
  children,
  trigger = "mount",
  duration = 300,
  charset = DEFAULT_CHARSET,
  className = "",
  style,
  onComplete,
  preserveCase = true,
  exclude = DEFAULT_EXCLUDE,
}: ScrambleTextProps) {
  const [displayText, setDisplayText] = useState(children);
  const animationRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const reduceMotionRef = useRef(false);

  // Check reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    reduceMotionRef.current = mediaQuery.matches;
    const handler = (e: MediaQueryListEvent) => (reduceMotionRef.current = e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  const scrambleChar = useCallback(
    (char: string): string => {
      if (exclude.test(char)) return char;
      const randomChar = charset[Math.floor(Math.random() * charset.length)];
      return preserveCase && char === char.toLowerCase()
        ? randomChar.toLowerCase()
        : randomChar;
    },
    [charset, exclude, preserveCase]
  );

  const scrambleString = useCallback(
    (str: string): string => {
      return str
        .split("")
        .map((char) => scrambleChar(char))
        .join("");
    },
    [scrambleChar]
  );

  const animate = useCallback(() => {
    if (reduceMotionRef.current) {
      setDisplayText(children);
      onComplete?.();
      return;
    }

    const startTime = performance.now();
    const originalText = children;
    let hasScrambled = false;

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);

      if (progress >= 1) {
        setDisplayText(originalText);
        onComplete?.();
        return;
      }

      // Phase 1: Scramble (first half)
      // Phase 2: Resolve back to original (second half)
      if (progress < 0.5) {
        const scrambleProgress = progress * 2;
        if (!hasScrambled || scrambleProgress > 0.3) {
          setDisplayText(scrambleString(originalText));
          hasScrambled = true;
        }
      } else {
        // Gradually restore characters
        const resolveProgress = (progress - 0.5) * 2;
        const result = originalText
          .split("")
          .map((char, i) => {
            if (exclude.test(char)) return char;
            // Each character resolves at slightly different time
            const charThreshold = i / originalText.length;
            return resolveProgress > charThreshold ? char : scrambleChar(char);
          })
          .join("");
        setDisplayText(result);
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [children, duration, scrambleString, scrambleChar, onComplete]);

  const startAnimation = useCallback(() => {
    if (animationRef.current) return;
    animationRef.current = window.setTimeout(() => {
      animate();
      animationRef.current = null;
    }, 0);
  }, [animate]);

  // Trigger handling
  useEffect(() => {
    if (trigger === "mount") {
      startAnimation();
    }
    return () => {
      if (animationRef.current) clearTimeout(animationRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [trigger, startAnimation]);

  // For hover trigger, we need a wrapper
  if (trigger === "hover") {
    return (
      <span
        className={className}
        style={style}
        onMouseEnter={startAnimation}
        onFocus={startAnimation}
      >
        {displayText}
      </span>
    );
  }

  return <span className={className} style={style}>{displayText}</span>;
}

/* ============================================================================
   SCRAMBLE TRIGGER WRAPPER (for hover/focus triggers on any content)
   ========================================================================== */

interface ScrambleTriggerProps {
  children: React.ReactNode;
  text: string;
  trigger?: "hover" | "focus" | "click";
  duration?: number;
  charset?: string;
  className?: string;
  style?: React.CSSProperties;
  preserveCase?: boolean;
  exclude?: RegExp;
}

export function ScrambleTrigger({
  children,
  text,
  trigger = "hover",
  duration = 300,
  charset = DEFAULT_CHARSET,
  className = "",
  style,
  preserveCase = true,
  exclude = DEFAULT_EXCLUDE,
}: ScrambleTriggerProps) {
  const [showScramble, setShowScramble] = useState(false);

  const handleTrigger = () => setShowScramble(true);
  const handleReset = () => setShowScramble(false);

  return (
    <span
      className={className}
      style={style}
      onMouseEnter={trigger === "hover" ? handleTrigger : undefined}
      onMouseLeave={trigger === "hover" ? handleReset : undefined}
      onFocus={trigger === "focus" ? handleTrigger : undefined}
      onBlur={trigger === "focus" ? handleReset : undefined}
      onClick={trigger === "click" ? handleTrigger : undefined}
    >
      <ScrambleText
        children={text}
        trigger={showScramble ? "mount" : false}
        duration={duration}
        charset={charset}
        preserveCase={preserveCase}
        exclude={exclude}
        onComplete={handleReset}
      />
      {children}
    </span>
  );
}