"use client"; // animation wrappers — server-rendered children pass through, so SEO content stays in HTML

import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useRef, type ReactNode } from "react";

type RevealProps = {
  children: ReactNode;
  /** Seconds to wait before animating (for stagger). */
  delay?: number;
  /** Initial vertical offset in px. */
  y?: number;
  className?: string;
};

/** Fade-and-rise into view once, on scroll. Renders children as-is under reduced motion. */
export function Reveal({ children, delay = 0, y = 28, className }: RevealProps) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, delay, ease: [0.21, 0.65, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

/** Gentle infinite vertical float — used by the hero's glass dashboard cards. */
export function Float({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: [24, 0, -10, 0] }}
      transition={{
        opacity: { duration: 0.8, delay },
        y: { duration: 7, delay, repeat: Infinity, repeatType: "loop", ease: "easeInOut", times: [0, 0.15, 0.6, 1] },
      }}
    >
      {children}
    </motion.div>
  );
}

/** Scroll-linked parallax offset for depth between columns (dashboard preview). */
export function ParallaxY({
  children,
  from = 40,
  to = -40,
  className,
}: {
  children: ReactNode;
  from?: number;
  to?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [from, to]);
  return (
    <motion.div ref={ref} style={reduce ? undefined : { y }} className={className}>
      {children}
    </motion.div>
  );
}
