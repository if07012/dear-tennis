'use client';

import { useEffect, useRef, useState } from 'react';
import { useInView, useMotionValue, useReducedMotion, animate } from 'framer-motion';

type CounterProps = {
  value: number;
  duration?: number; // seconds
  className?: string;
  suffix?: string;
};

const easeOutQuart: [number, number, number, number] = [0.165, 0.84, 0.44, 1];

/**
 * Animated counter that triggers when scrolled into view.
 * Replaces js/main.js `animateSingleCounter()` (easeOutQuart, 2000ms).
 */
export function Counter({ value, duration = 2, className, suffix }: CounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '0px 0px -100px 0px' });
  const reduced = useReducedMotion();
  const motion = useMotionValue(0);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (reduced) {
      setDisplay(value);
      return;
    }
    const controls = animate(motion, value, {
      duration,
      ease: easeOutQuart,
      onUpdate: (latest: number) => setDisplay(Math.floor(latest)),
    });
    return () => controls.stop();
  }, [inView, value, duration, reduced, motion]);

  return (
    <span ref={ref} className={className}>
      {display.toLocaleString()}
      {suffix}
    </span>
  );
}
