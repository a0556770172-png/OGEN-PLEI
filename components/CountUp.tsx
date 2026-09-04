"use client";
import { useEffect, useRef, useState } from "react";

// מונה שרץ מ-0 ועד הערך האמיתי עם האטה בסוף (easeOutCubic). מכבד prefers-reduced-motion.
export default function CountUp({
  value,
  duration = 1400,
  delay = 150,
  className,
  locale = "he-IL"
}: {
  value: number;
  duration?: number;
  delay?: number;
  className?: string;
  locale?: string;
}) {
  const [display, setDisplay] = useState(0);
  const doneRef = useRef(false);

  useEffect(() => {
    if (doneRef.current) {
      setDisplay(value);
      return;
    }
    const reduce =
      typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !Number.isFinite(value) || value <= 0) {
      setDisplay(value);
      doneRef.current = true;
      return;
    }

    let raf = 0;
    let startTs = 0;
    const timer = setTimeout(() => {
      const step = (ts: number) => {
        if (!startTs) startTs = ts;
        const t = Math.min(1, (ts - startTs) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        setDisplay(Math.round(value * eased));
        if (t < 1) {
          raf = requestAnimationFrame(step);
        } else {
          setDisplay(value);
          doneRef.current = true;
        }
      };
      raf = requestAnimationFrame(step);
    }, delay);

    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, [value, duration, delay]);

  return <span className={className}>{display.toLocaleString(locale)}</span>;
}
