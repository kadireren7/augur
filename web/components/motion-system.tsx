"use client";

import {
  AnimatePresence,
  MotionConfig,
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "motion/react";
import { usePathname } from "next/navigation";
import { useRef, type ReactNode } from "react";

export function MotionShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={pathname}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.22 }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </MotionConfig>
  );
}

export function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduced ? false : { opacity: 0, y: 26 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

export function ScrollStage({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [0, 100]);
  const scale = useTransform(scrollYProgress, [0, 0.7], [1, 1.06]);
  const reduced = useReducedMotion();
  return (
    <div ref={ref} className="scroll-stage">
      <motion.div style={reduced ? {} : { y, scale }}>{children}</motion.div>
    </div>
  );
}

export function StateReveal({
  children,
  identity,
  className = "",
}: {
  children: ReactNode;
  identity: string | number;
  className?: string;
}) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        className={className}
        key={identity}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.2 }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

export function ViewingReveal({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "start start"],
  });
  const scale = useTransform(scrollYProgress, [0, 1], [0.96, 1]);
  const reduced = useReducedMotion();
  return (
    <div ref={ref} className="viewing-reveal">
      <motion.div style={reduced ? {} : { scale }}>{children}</motion.div>
    </div>
  );
}
