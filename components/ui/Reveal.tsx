'use client';

import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';

type RevealDirection = 'up' | 'down' | 'left' | 'right' | 'scale' | 'none';

type RevealProps = {
  children: ReactNode;
  direction?: RevealDirection;
  delay?: number;
  className?: string;
  /** Optional override of motion duration in seconds. */
  duration?: number;
  /** Element to render. Defaults to `div`. */
  as?: 'div' | 'section' | 'article' | 'li' | 'span' | 'header' | 'footer';
};

const offsets: Record<Exclude<RevealDirection, 'none' | 'scale'>, { x: number; y: number }> = {
  up: { x: 0, y: 40 },
  down: { x: 0, y: -40 },
  left: { x: 40, y: 0 },
  right: { x: -40, y: 0 },
};

const duration = 0.9; // matches Vero Studio feel with easeOutExpo-equivalent
const baseEase: [number, number, number, number] = [0.16, 1, 0.3, 1];

/**
 * Reveal-on-scroll wrapper using framer-motion `whileInView`.
 * Replaces all .reveal-up / .reveal-left / .reveal-right / .reveal-scale / .fade-in* classes.
 */
export function Reveal({
  children,
  direction = 'up',
  delay = 0,
  className,
  duration: durationOverride,
  as = 'div',
}: RevealProps) {
  const reduced = useReducedMotion();

  const initial =
    direction === 'none'
      ? { opacity: 0 }
      : direction === 'scale'
        ? { opacity: 0, scale: 0.92 }
        : { opacity: 0, ...offsets[direction as Exclude<RevealDirection, 'none' | 'scale'>] };

  const animate = direction === 'scale' ? { opacity: 1, scale: 1 } : { opacity: 1, x: 0, y: 0 };

  const finalInitial = reduced ? { opacity: 1, x: 0, y: 0, scale: 1 } : initial;
  const finalAnimate = reduced ? finalInitial : animate;

  const MotionTag = motion[as] as typeof motion.div;

  return (
    <MotionTag
      className={className}
      initial={finalInitial}
      whileInView={finalAnimate}
      viewport={{ once: true, margin: '0px 0px -80px 0px' }}
      transition={{ duration: reduced ? 0 : (durationOverride ?? duration), delay, ease: baseEase }}
    >
      {children}
    </MotionTag>
  );
}
