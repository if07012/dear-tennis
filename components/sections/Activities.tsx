'use client';

import { useState } from 'react';
import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';
import { activities, type ActivityCategory } from '@/data/activities';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Reveal } from '@/components/ui/Reveal';
import { ClockSmallIcon, UsersSmallIcon } from '@/components/ui/Icons';

type Filter = ActivityCategory | 'all';

const TABS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All Activities' },
  { id: 'training', label: 'Training' },
  { id: 'social', label: 'Social Play' },
  { id: 'competitive', label: 'Competitive' },
];

const TAG_STYLES: Record<ActivityCategory, string> = {
  training: 'bg-hunter-green/10 text-hunter-green',
  social: 'bg-teal/10 text-teal',
  competitive: 'bg-paprika/10 text-paprika',
};

export function Activities() {
  const [active, setActive] = useState<Filter>('all');

  const visible = active === 'all' ? activities : activities.filter((a) => a.category === active);

  return (
    <section id="activities" className="section-padding bg-white">
      <div className="container-base">
        <SectionHeader
          tag="What We Do"
          title="Activities & Programs"
          subtitle="Something for everyone, from beginners to advanced players"
          center
        />

        <div className="flex flex-wrap justify-center gap-2 mb-12">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActive(tab.id)}
              className={[
                'px-6 py-2.5 rounded-full text-sm font-medium transition-all duration-200',
                active === tab.id
                  ? 'bg-paprika text-white shadow-md'
                  : 'bg-off-white text-graphite hover:bg-light-gray',
              ].join(' ')}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <motion.div layout className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <AnimatePresence mode="popLayout">
            {visible.map((activity, i) => (
              <motion.article
                layout
                key={activity.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.3, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                className="bg-white rounded-2xl overflow-hidden border border-light-gray hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group"
              >
                <div className="relative h-52 overflow-hidden">
                  <Image
                    src={activity.image}
                    alt={activity.title}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                  <span
                    className={[
                      'absolute top-4 left-4 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider',
                      TAG_STYLES[activity.category],
                    ].join(' ')}
                  >
                    {activity.category}
                  </span>
                </div>
                <div className="p-6">
                  <h3 className="font-serif text-xl font-semibold text-hunter-green mb-2">
                    {activity.title}
                  </h3>
                  <p className="text-dark-gray text-sm leading-relaxed mb-4 text-pretty">
                    {activity.description}
                  </p>
                  <div className="flex items-center gap-4 text-xs text-dark-gray">
                    <span className="flex items-center gap-1.5">
                      <ClockSmallIcon />
                      {activity.duration}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <UsersSmallIcon />
                      {activity.groupSize}
                    </span>
                  </div>
                </div>
              </motion.article>
            ))}
          </AnimatePresence>
        </motion.div>
      </div>
    </section>
  );
}
