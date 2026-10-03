"use client";
import { useEffect, useRef, useState } from "react";
import { animate, useReducedMotion } from "motion/react";
import { formatAugd } from "@/lib/token-amount";
const units = (v: string | number) =>
  typeof v === "number" ? BigInt(v) * 10n ** 18n : BigInt(v);
export function AnimatedAmount({ value }: { value: string | number }) {
  const target = units(value),
    previous = useRef(target);
  const [display, setDisplay] = useState(target);
  const reduced = useReducedMotion();
  useEffect(() => {
    const from = previous.current;
    previous.current = target;
    if (from === target) return;
    const animation = animate(0, 1000, {
      duration: reduced ? 0 : 0.35,
      onUpdate: (progress) =>
        setDisplay(
          from + ((target - from) * BigInt(Math.round(progress))) / 1000n,
        ),
      onComplete: () => setDisplay(target),
    });
    return () => animation.stop();
  }, [target, reduced]);
  return <span className="animated-amount">{formatAugd(display)}</span>;
}
