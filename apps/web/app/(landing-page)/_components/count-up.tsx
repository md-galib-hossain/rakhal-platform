"use client"; // animates the number when scrolled into view

import { animate, useInView, useReducedMotion } from "motion/react";
import { useLocale } from "next-intl";
import { useEffect, useRef, useState } from "react";
import type { Locale } from "@/lib/constants/i18n";
import { formatNumber } from "@/lib/format";

export function CountUp({ value, suffix = "+" }: { value: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(0);
  const locale = useLocale() as Locale;

  useEffect(() => {
    if (!inView || reduce) return;
    const controls = animate(0, value, {
      duration: 1.8,
      ease: "easeOut",
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
  }, [inView, value, reduce]);

  // Under reduced motion the final value renders directly — no animation state involved.
  const shown = reduce ? value : display;

  return (
    <span ref={ref}>
      {formatNumber(shown, locale)}
      {suffix}
    </span>
  );
}
