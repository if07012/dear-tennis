import Image from 'next/image';
import { Counter } from '@/components/ui/Counter';
import { Reveal } from '@/components/ui/Reveal';
import { SectionHeader } from '@/components/ui/SectionHeader';
import type { OurStorySettings } from '@/data/our-story-types';

const STATS = [
  { value: 500, label: 'Active Members' },
  { value: 50, label: 'Monthly Events' },
  { value: 15, label: 'Partner Courts' },
];

type Props = {
  content: OurStorySettings;
};

export function About({ content }: Props) {
  const { tag, title, subtitle, lead, body, closing, image, imageAlt } = content;
  return (
    <section id="about" className="section-padding bg-white">
      <div className="container-base">
        <SectionHeader
          tag={tag || 'Our Story'}
          title={title || 'Built on Love for the Game'}
          subtitle={subtitle || undefined}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <Reveal direction="left" className="order-2 lg:order-1">
            <div>
              {lead && (
                <p className="text-lg md:text-xl text-graphite leading-relaxed mb-6 text-pretty">
                  {lead}
                </p>
              )}
              {body && (
                <p className="text-dark-gray leading-relaxed mb-4 text-pretty">
                  {body}
                </p>
              )}
              {closing && (
                <p className="text-dark-gray leading-relaxed mb-8 text-pretty">
                  {closing}
                </p>
              )}

              <div className="grid grid-cols-3 gap-6 pt-6 border-t border-light-gray">
                {STATS.map((stat) => (
                  <div key={stat.label} className="text-center">
                    <Counter
                      value={stat.value}
                      className="block font-serif text-3xl md:text-4xl font-bold text-hunter-green"
                    />
                    <span className="text-sm text-dark-gray mt-1 block">{stat.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          <Reveal direction="right" className="order-1 lg:order-2">
            <div className="relative aspect-[4/5] rounded-3xl overflow-hidden shadow-xl">
              <Image
                src={image || 'https://images.unsplash.com/photo-1661474974379-0f24bee86ce0?q=80&w=800&auto=format&fit=crop'}
                alt={imageAlt || 'Dear Tennis Community'}
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
              />
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
