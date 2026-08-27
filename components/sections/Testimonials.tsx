'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';
import type { TestimonialsContent } from '@/data/testimonials-types';
import { testimonials as fallbackTestimonials } from '@/data/testimonials';
import { Reveal } from '@/components/ui/Reveal';
import { ChevronLeft, ChevronRight } from '@/components/ui/Icons';

const AUTOPLAY_MS = 5000;

// Local fallback that mirrors lib/testimonials-store.ts defaults but avoids
// importing the store from this client component. The store transitively
// pulls in google-auth-library (Node-only: fs, net, http), which breaks the
// browser bundle. The home page always passes a real `content` prop, so this
// branch is only a defensive last resort.
const FALLBACK_CONTENT: TestimonialsContent = {
  settings: {
    id: 'current',
    tag: 'Stories',
    title: 'Member Experiences',
    subtitle: 'Hear from the people who make Dear Tennis special',
    updatedAt: '',
  },
  items: fallbackTestimonials.map((t, idx) => ({
    id: t.id,
    quote: t.quote,
    name: t.name,
    since: t.since,
    avatar: t.avatar,
    order: idx,
  })),
};

export function Testimonials({ content }: { content?: TestimonialsContent }) {
  const source = content ?? FALLBACK_CONTENT;
  const { settings, items } = source;
  const [current, setCurrent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // If items shrink (e.g. sheet edit) while the user is on a higher index,
  // clamp back into range so the carousel never lands on a missing slide.
  useEffect(() => {
    if (items.length === 0) {
      setCurrent(0);
      return;
    }
    if (current >= items.length) setCurrent(items.length - 1);
  }, [items.length, current]);

  useEffect(() => {
    if (isPaused || items.length <= 1) return;
    const id = setInterval(() => {
      setCurrent((prev) => (prev + 1) % items.length);
    }, AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [isPaused, items.length]);

  const next = () => {
    if (items.length === 0) return;
    setIsPaused(true);
    setCurrent((c) => (c + 1) % items.length);
    setTimeout(() => setIsPaused(false), 12000);
  };
  const prev = () => {
    if (items.length === 0) return;
    setIsPaused(true);
    setCurrent((c) => (c - 1 + items.length) % items.length);
    setTimeout(() => setIsPaused(false), 12000);
  };

  const currentItem = items[current];

  return (
    <section id="testimonials" className="section-padding bg-hunter-green text-white relative overflow-hidden">
      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_50%_50%,white_0%,transparent_50%)]" />
      <div className="container-base relative">
        <div className="text-center mb-12">
          <Reveal direction="up">
            <span className="inline-block text-xs font-semibold tracking-[0.2em] uppercase text-paprika mb-3">
              {settings.tag}
            </span>
          </Reveal>
          <Reveal direction="up" delay={1}>
            <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl font-semibold text-white">
              {settings.title}
            </h2>
          </Reveal>
          {settings.subtitle && (
            <Reveal direction="up" delay={2}>
              <p className="mt-3 text-sm md:text-base text-white/80 max-w-xl mx-auto">
                {settings.subtitle}
              </p>
            </Reveal>
          )}
        </div>

        <div className="relative max-w-3xl mx-auto">
          {currentItem ? (
            <AnimatePresence mode="wait">
              <motion.div
                key={currentItem.id}
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="text-center px-4"
              >
                <div className="font-serif text-6xl text-paprika/40 leading-none mb-2">&ldquo;</div>
                <p className="text-lg md:text-xl leading-relaxed mb-8 text-pretty">
                  {currentItem.quote}
                </p>
                <div className="flex items-center justify-center gap-4">
                  <div className="relative w-14 h-14 rounded-full overflow-hidden border-2 border-paprika">
                    {currentItem.avatar ? (
                      <Image
                        src={currentItem.avatar}
                        alt={currentItem.name}
                        fill
                        sizes="56px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-paprika/20 font-serif text-lg font-semibold text-white">
                        {(currentItem.name || '?').charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="text-left">
                    <h4 className="font-serif text-lg font-semibold">{currentItem.name}</h4>
                    {currentItem.since && (
                      <span className="text-sm text-white/70">
                        {currentItem.since}
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          ) : (
            <p className="text-center text-white/70">Belum ada kutipan.</p>
          )}

          {items.length > 1 && (
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
                {items.map((_, i) => (
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
          )}
        </div>
      </div>
    </section>
  );
}