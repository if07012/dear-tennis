import Image from 'next/image';
import { Counter } from '@/components/ui/Counter';
import { Reveal } from '@/components/ui/Reveal';
import { SectionHeader } from '@/components/ui/SectionHeader';

const STATS = [
  { value: 500, label: 'Active Members' },
  { value: 50, label: 'Monthly Events' },
  { value: 15, label: 'Partner Courts' },
];

export function About() {
  return (
    <section id="about" className="section-padding bg-white">
      <div className="container-base">
        <SectionHeader tag="Our Story" title="Built on Love for the Game" />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <Reveal direction="left" className="order-2 lg:order-1">
            <div>
              <p className="text-lg md:text-xl text-graphite leading-relaxed mb-6 text-pretty">
                Dear Tennis started with a simple belief: tennis is more than just hitting balls
                over a net. It&apos;s about connection, growth, and shared moments that last a
                lifetime.
              </p>
              <p className="text-dark-gray leading-relaxed mb-4 text-pretty">
                Founded in 2020, we&apos;ve grown from a small group of enthusiasts to a thriving
                community of players, coaches, and fans who share one common passion. Whether
                you&apos;re picking up a racket for the first time or you&apos;ve been playing for
                decades, there&apos;s a place for you here.
              </p>
              <p className="text-dark-gray leading-relaxed mb-8 text-pretty">
                We organize regular meetups, tournaments, training sessions, and social events
                that bring people together through the beautiful game of tennis.
              </p>

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
                src="https://images.unsplash.com/photo-1661474974379-0f24bee86ce0?q=80&w=800&auto=format&fit=crop"
                alt="Dear Tennis Community"
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
