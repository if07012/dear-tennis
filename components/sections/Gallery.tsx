import Image from 'next/image';
import { Reveal } from '@/components/ui/Reveal';
import { SectionHeader } from '@/components/ui/SectionHeader';
import type { GalleryContent } from '@/data/gallery-types';

type Props = {
  content: GalleryContent;
};

export function Gallery({ content }: Props) {
  const { settings, items } = content;
  return (
    <section id="gallery" className="section-padding bg-white">
      <div className="container-base">
        <SectionHeader
          tag={settings.tag}
          title={settings.title}
          subtitle={settings.subtitle}
          center
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 auto-rows-[200px]">
          {items.map((item, i) => (
            <Reveal
              key={item.id}
              direction="scale"
              delay={i % 6 * 0.1}
              className={[
                'relative rounded-2xl overflow-hidden group cursor-pointer',
                item.large ? 'sm:col-span-2 sm:row-span-2' : '',
              ].join(' ')}
            >
              <Image
                src={item.src}
                alt={item.alt}
                fill
                sizes={item.large ? '(max-width: 1024px) 100vw, 50vw' : '(max-width: 1024px) 50vw, 25vw'}
                className="object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-graphite/80 via-graphite/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="absolute inset-x-0 bottom-0 p-5 text-white translate-y-4 group-hover:translate-y-0 opacity-0 group-hover:opacity-100 transition-all duration-300">
                <p className="text-sm font-medium">{item.alt}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
