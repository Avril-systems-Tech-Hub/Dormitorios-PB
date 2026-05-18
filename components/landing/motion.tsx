"use client";

import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";
import type { ReactNode } from "react";

const easeOut = [0.22, 1, 0.36, 1] as const;

/** Shared viewport: trigger slightly before element is centered */
export const scrollViewport = { once: true, margin: "-10% 0px -8% 0px" } as const;

export function FadeIn({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduce ? 0 : 0.5, ease: easeOut, delay: reduce ? 0 : delay }}
    >
      {children}
    </motion.div>
  );
}

/** Fade / slide in when scrolled into view */
export function FadeInView({
  children,
  className,
  delay = 0,
  y = 22,
  x = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  x?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y, x }}
      whileInView={{ opacity: 1, y: 0, x: 0 }}
      viewport={scrollViewport}
      transition={{ duration: reduce ? 0 : 0.55, ease: easeOut, delay: reduce ? 0 : delay }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerGrid({
  children,
  className,
  stagger = 0.08,
}: {
  children: ReactNode;
  className?: string;
  stagger?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={scrollViewport}
      variants={{
        hidden: {},
        show: {
          transition: { staggerChildren: reduce ? 0 : stagger },
        },
      }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      variants={{
        hidden: reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0, transition: { duration: reduce ? 0 : 0.5, ease: easeOut } },
      }}
    >
      {children}
    </motion.div>
  );
}

export function MotionSection({
  subtle = false,
  ...props
}: HTMLMotionProps<"section"> & { subtle?: boolean }) {
  const reduce = useReducedMotion();
  return (
    <motion.section
      {...props}
      initial={reduce ? false : subtle ? { opacity: 0 } : { opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={scrollViewport}
      transition={{ duration: reduce ? 0 : subtle ? 0.5 : 0.6, ease: easeOut }}
    />
  );
}
