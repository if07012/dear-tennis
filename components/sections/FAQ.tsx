'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Reveal } from '@/components/ui/Reveal';
import { ChevronDown } from '@/components/ui/Icons';
import { faqs } from '@/data/faqs';

export function FAQ() {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <section id="faq" className="section-padding bg-off-white">
      <div className="container-base max-w-3xl">
        <SectionHeader tag="Questions" title="Frequently Asked Questions" center />

        <div className="space-y-3">
          {faqs.map((faq, i) => {
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
