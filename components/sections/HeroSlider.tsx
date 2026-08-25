'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { motion, useReducedMotion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from '@/components/ui/Icons';
import { LinkButton } from '@/components/ui/Button';
import type { HeroContent, HeroSlideData } from '@/data/hero-types';

const AUTOPLAY_MS = 6000;

type Props = {
  content: HeroContent;
};

function slidesToRender(slides: HeroSlideData[]) {
  return slides.map((slide, idx) => ({
    id: slide.id || `slide-${idx}`,
    image: slide.image,
    alt: slide.alt || `Slide ${idx + 1}`,
    order: idx,
  }));
}

export function HeroSlider({ content }: Props) {
  const slides = slidesToRender(content.slides);
  const settings = content.settings;

  const [current, setCurrent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);
  const slidesRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  // If slides count shrinks below current, clamp back into range.
  useEffect(() => {
    if (current >= slides.length) {
      setCurrent(0);
    }
  }, [slides.length, current]);

  // Autoplay
  useEffect(() => {
    if (reduced || isPaused) return;
    if (slides.length <= 1) return;
    const id = setInterval(() => {
      setCurrent((prev) => (prev + 1) % slides.length);
    }, AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [reduced, isPaused, slides.length]);

  const goTo = (i: number) => {
    setIsPaused(true);
    setCurrent(((i % slides.length) + slides.length) % slides.length);
    setTimeout(() => setIsPaused(false), 12000);
  };

  const next = () => goTo(current + 1);
  const prev = () => goTo(current - 1);

  useEffect(() => {
    if (reduced) return;
    const hero = heroRef.current;
    const slidesEl = slidesRef.current;
    if (!hero || !slidesEl) return;

    const handle = (e: MouseEvent) => {
      const xAxis = (window.innerWidth / 2 - e.pageX) / 100;
      const yAxis = (window.innerHeight / 2 - e.pageY) / 100;
      const slideEls = slidesEl.querySelectorAll<HTMLDivElement>('[data-slide]');
      slideEls.forEach((slide, index) => {
        const speed = (index + 1) * 0.5;
        slide.style.transform = `translate(${xAxis * speed}px, ${yAxis * speed}px) scale(1.15)`;
      });
    };
    const reset = () => {
      const slideEls = slidesRef.current?.querySelectorAll<HTMLDivElement>('[data-slide]');
      slideEls?.forEach((slide) => {
        slide.style.transform = 'scale(1.15)';
      });
    };

    hero.addEventListener('mousemove', handle);
    hero.addEventListener('mouseleave', reset);
    return () => {
      hero.removeEventListener('mousemove', handle);
      hero.removeEventListener('mouseleave', reset);
    };
  }, [reduced]);

  return (
    <div
      ref={heroRef}
      className="relative h-[calc(100vh-5rem)] min-h-[600px] w-full overflow-hidden bg-graphite"
    >
      <div ref={slidesRef} className="absolute inset-0">
        {slides.map((slide, index) => (
          <div
            key={slide.id}
            data-slide
            className={[
              'absolute inset-0 transition-opacity duration-[1500ms] ease-in-out',
              index === current ? 'opacity-100' : 'opacity-0',
            ].join(' ')}
            aria-hidden={index !== current}
          >
            <Image
              src={slide.image}
              alt={slide.alt}
              fill
              priority={index === 0}
              quality={85}
              sizes="100vw"
              className="object-cover scale-110"
              style={{ animation: 'kenburns 20s ease-in-out infinite' }}
            />
          </div>
        ))}
      </div>
      <div className="absolute inset-0 bg-gradient-to-b from-graphite/60 via-graphite/40 to-graphite/70" />

      <div className="relative z-10 container-base h-full flex flex-col justify-center items-start text-white">
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          className="font-serif text-5xl md:text-7xl lg:text-8xl font-bold leading-tight mb-6 max-w-4xl"
        >
          <span className="block">{settings.title || ' '}</span>
          <span className="block text-paprika">{settings.subtitle || ' '}</span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="text-lg md:text-xl text-white/90 max-w-2xl mb-10 text-pretty"
        >
          {settings.description}
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-wrap items-center gap-4"
        >
          {settings.ctaPrimaryLabel && settings.ctaPrimaryHref && (
            <LinkButton href={settings.ctaPrimaryHref} size="lg" variant="primary">
              {settings.ctaPrimaryLabel}
            </LinkButton>
          )}
          {settings.ctaSecondaryLabel && settings.ctaSecondaryHref && (
            <a
              href={settings.ctaSecondaryHref}
              className="inline-flex items-center justify-center gap-2 font-medium rounded-full px-8 py-4 text-base border-2 border-white text-white hover:bg-white hover:text-hunter-green transition-all duration-200"
            >
              {settings.ctaSecondaryLabel}
            </a>
          )}
        </motion.div>
      </div>

      {slides.length > 1 && (
        <>
          <button
            type="button"
            onClick={prev}
            aria-label="Previous slide"
            className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12 flex items-center justify-center rounded-full bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 transition-colors"
          >
            <ChevronLeft />
          </button>
          <button
            type="button"
            onClick={next}
            aria-label="Next slide"
            className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12 flex items-center justify-center rounded-full bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 transition-colors"
          >
            <ChevronRight />
          </button>

          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                aria-label={`Go to slide ${i + 1}`}
                onClick={() => goTo(i)}
                className={[
                  'h-2 rounded-full transition-all duration-300',
                  i === current ? 'w-8 bg-white' : 'w-2 bg-white/50 hover:bg-white/80',
                ].join(' ')}
              />
            ))}
          </div>
        </>
      )}

      <a
        href="#about"
        className="absolute bottom-8 right-8 z-20 hidden md:flex flex-col items-center gap-2 text-white/80 hover:text-white transition-colors"
        aria-label="Scroll to about"
      >
        <span className="text-xs uppercase tracking-widest">Scroll</span>
        <span className="w-px h-12 bg-white/60" />
      </a>
    </div>
  );
}
