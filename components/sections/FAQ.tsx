'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Reveal } from '@/components/ui/Reveal';
import { ChevronDown } from '@/components/ui/Icons';
import { faqs as fallbackFaqs } from '@/data/faqs';
import type { FAQContent } from '@/data/faq-types';

// Local fallback that mirrors lib/faq-store.ts defaults but avoids importing
// the store from this client component. The store transitively pulls in
// google-auth-library (Node-only: fs, net, http), which breaks the browser
// bundle. The home page always passes a real `content` prop, so this branch
// is only a defensive last resort.
const FALLBACK_CONTENT: FAQContent = {
  settings: {
    id: 'current',
    tag: 'Questions',
    title: 'Frequently Asked Questions',
    subtitle: '',
    updatedAt: '',
  },
  items: fallbackFaqs.map((f, idx) => ({
    id: f.id,
    question: f.question,
    answer: f.answer,
    order: idx,
  })),
};

export function FAQ({ content }: { content?: FAQContent } = {}) {
  const source = content ?? FALLBACK_CONTENT;
  const { settings, items } = source;
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <section id="faq" className="section-padding bg-off-white">
      <div className="container-base max-w-3xl">
        <SectionHeader
          tag={settings.tag}
          title={settings.title}
          subtitle={settings.subtitle || undefined}
          center
        />

        <div className="space-y-3">
          {items.map((faq, i) => {
            const isOpen = openId === faq.id;
            return (
              <Reveal key={faq.id} direction="up" delay={i % 5} className="w-full">
                <div
                  className={[
                    'bg-white rounded-2xl border transition-all duration-200 overflow-hidden',
                    isOpen ? 'border-paprika shadow-md' : 'border-light-gray',
                  ].join(' ')}
                >
                  <button
                    type="button"
                    onClick={() => setOpenId(isOpen ? null : faq.id)}
                    aria-expanded={isOpen}
                    className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left"
                  >
                    <span className="font-serif text-base md:text-lg font-semibold text-hunter-green">
                      {faq.question}
                    </span>
                    <ChevronDown
                      className={[
                        'text-paprika transition-transform duration-300',
                        isOpen ? 'rotate-180' : '',
                      ].join(' ')}
                    />
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen ? (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                        className="overflow-hidden"
                      >
                        <p className="px-6 pb-5 text-dark-gray leading-relaxed text-pretty">
                          {faq.answer}
                        </p>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}