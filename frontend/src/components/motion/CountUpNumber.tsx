"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useReducedMotion } from "framer-motion";

/* ============================================================================
   COUNT UP NUMBER
   Smooth animated numeric counter for metrics and percentages (tabular-nums)
   ========================================================================== */

interface CountUpNumberProps {
  value: number;
  start?: number;
  duration?: number;              // Animation duration in ms (default 1000)
  delay?: number;                 // Delay before starting (default 0)
  decimals?: number;              // Decimal places (default 0)
  separator?: string;             // Thousands separator (default ",")
  prefix?: string;                // Prefix (e.g. "$", "~")
  suffix?: string;                // Suffix (e.g. "%", "ms", "k")
  easing?: (t: number) => number; // Easing function
  className?: string;
  style?: React.CSSProperties;
  onComplete?: () => void;
  format?: (value: number) => string; // Custom formatter
}

const defaultEasing = (t: number): number => 1 - Math.pow(1 - t, 3); // easeOutCubic

export default function CountUpNumber({
  value,
  start = 0,
  duration = 1000,
  delay = 0,
  decimals = 0,
  separator = ",",
  prefix = "",
  suffix = "",
  easing = defaultEasing,
  className = "",
  style,
  onComplete,
  format,
}: CountUpNumberProps) {
  const [displayValue, setDisplayValue] = useState(start);
  const [hasAnimated, setHasAnimated] = useState(false);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const reduceMotion = useReducedMotion();

  const formatNumber = useCallback(
    (num: number): string => {
      if (format) return format(num);
      const fixed = num.toFixed(decimals);
      const parts = fixed.split(".");
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, separator);
      return `${prefix}${parts.join(".")}${suffix}`;
    },
    [decimals, separator, prefix, suffix, format]
  );

  const animate = useCallback(() => {
    if (reduceMotion) {
      setDisplayValue(value);
      setHasAnimated(true);
      onComplete?.();
      return;
    }

    startTimeRef.current = performance.now() + delay;

    const tick = (now: number) => {
      if (!startTimeRef.current) return;

      const elapsed = now - startTimeRef.current;
      if (elapsed < 0) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easing(progress);
      const current = start + (value - start) * easedProgress;

      setDisplayValue(current);

      if (progress >= 1) {
        setDisplayValue(value);
        setHasAnimated(true);
        onComplete?.();
        return;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [value, start, duration, delay, easing, reduceMotion, onComplete]);

  useEffect(() => {
    if (!hasAnimated) {
      animate();
    } else if (displayValue !== value) {
      // Re-animate on value change
      setHasAnimated(false);
      animate();
    }
  }, [value, hasAnimated, animate, displayValue]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <span
      className={`font-mono tabular-nums ${className}`}
      style={style}
      aria-live="polite"
      aria-atomic="true"
    >
      {formatNumber(displayValue)}
    </span>
  );
}

/* ============================================================================
   COUNT UP NUMBER - INTERSECTION OBSERVER VARIANT
   Only animates when visible in viewport
   ========================================================================== */

interface CountUpOnViewProps extends Omit<CountUpNumberProps, "delay"> {
  threshold?: number;
  rootMargin?: string;
  once?: boolean;
}

export function CountUpOnView({
  value,
  start = 0,
  duration = 1000,
  decimals = 0,
  separator = ",",
  prefix = "",
  suffix = "",
  easing = defaultEasing,
  className = "",
  style,
  onComplete,
  format,
  threshold = 0.1,
  rootMargin = "0px",
  once = true,
}: CountUpOnViewProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [hasAnimated, setHasAnimated] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = wrapperRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          if (once) observer.unobserve(element);
        } else if (!once) {
          setIsVisible(false);
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [threshold, rootMargin, once]);

  // Reset animation when value changes and we're visible
  useEffect(() => {
    if (isVisible && hasAnimated) {
      setHasAnimated(false);
    }
  }, [value, isVisible, hasAnimated]);

  return (
    <div ref={wrapperRef}>
      <CountUpNumber
        value={value}
        start={start}
        duration={duration}
        delay={isVisible && !hasAnimated ? 0 : 999999}
        decimals={decimals}
        separator={separator}
        prefix={prefix}
        suffix={suffix}
        easing={easing}
        className={className}
        style={style}
        onComplete={() => {
          setHasAnimated(true);
          onComplete?.();
        }}
        format={format}
      />
    </div>
  );
}