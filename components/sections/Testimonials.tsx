'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';
import { testimonials } from '@/data/testimonials';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Reveal } from '@/components/ui/Reveal';
import { ChevronLeft, ChevronRight } from '@/components/ui/Icons';

const AUTOPLAY_MS = 5000;

export function Testimonials() {
  const [current, setCurrent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused) return;
    const id = setInterval(() => {
      setCurrent((prev) => (prev + 1) % testimonials.length);
    }, AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [isPaused]);

  const next = () => {
    setIsPaused(true);
    setCurrent((c) => (c + 1) % testimonials.length);
    setTimeout(() => setIsPaused(false), 12000);
  };
  const prev = () => {
    setIsPaused(true);
    setCurrent((c) => (c - 1 + testimonials.length) % testimonials.length);
    setTimeout(() => setIsPaused(false), 12000);
  };

  return (
    <section id="testimonials" className="section-padding bg-hunter-green text-white relative overflow-hidden">
      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_50%_50%,white_0%,transparent_50%)]" />
      <div className="container-base relative">
        <div className="text-center mb-12">
          <Reveal direction="up">
            <span className="inline-block text-xs font-semibold tracking-[0.2em] uppercase text-paprika mb-3">
              Stories
            </span>
          </Reveal>
          <Reveal direction="up" delay={1}>
            <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl font-semibold text-white">
              Member Experiences
            </h2>
          </Reveal>
        </div>

        <div className="relative max-w-3xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={current}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="text-center px-4"
            >
              <div className="font-serif text-6xl text-paprika/40 leading-none mb-2">&ldquo;</div>
              <p className="text-lg md:text-xl leading-relaxed mb-8 text-pretty">
                {testimonials[current].quote}
              </p>
              <div className="flex items-center justify-center gap-4">
                <div className="relative w-14 h-14 rounded-full overflow-hidden border-2 border-paprika">
                  <Image
                    src={testimonials[current].avatar}
                    alt={testimonials[current].name}
                    fill
                    sizes="56px"
                    className="object-cover"
                  />
                </div>
                <div className="text-left">
                  <h4 className="font-serif text-lg font-semibold">{testimonials[current].name}</h4>
                  <span className="text-sm text-white/70">
                    {testimonials[current].since}
                  </span>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          <div className="flex items-center justify-center gap-6 mt-10">
            <button
              type="button"
              onClick={prev}
              aria-label="Previous testimonial"
              className="w-11 h-11 flex items-center justify-center rounded-full border border-white/30 hover:bg-white hover:text-hunter-green transition-colors"
            >
              <ChevronLeft />
            </button>
            <div className="flex items-center gap-2">
              {testimonials.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Go to testimonial ${i + 1}`}
                  onClick={() => {
                    setIsPaused(true);
                    setCurrent(i);
                    setTimeout(() => setIsPaused(false), 12000);
                  }}
                  className={[
                    'h-2 rounded-full transition-all duration-300',
                    i === current ? 'w-8 bg-paprika' : 'w-2 bg-white/40 hover:bg-white/70',
                  ].join(' ')}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={next}
              aria-label="Next testimonial"
              className="w-11 h-11 flex items-center justify-center rounded-full border border-white/30 hover:bg-white hover:text-hunter-green transition-colors"
            >
              <ChevronRight />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
