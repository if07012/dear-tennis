import { Reveal } from '@/components/ui/Reveal';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { LinkButton } from '@/components/ui/Button';
import { MapPinIcon, ClockSmallIcon } from '@/components/ui/Icons';
import { events } from '@/data/events';

export function Events() {
  return (
    <section id="events" className="section-padding bg-off-white">
      <div className="container-base">
        <SectionHeader tag="Calendar" title="Upcoming Events" center />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {events.map((event, i) => (
            <Reveal key={event.id} direction="up" delay={i % 4} className="h-full">
              <article className="h-full bg-white rounded-2xl overflow-hidden border border-light-gray hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col">
                <div className="bg-gradient-to-br from-hunter-green to-teal text-white p-6 text-center">
                  <div className="font-serif text-4xl font-bold leading-none">{event.day}</div>
                  <div className="text-xs uppercase tracking-widest mt-1 opacity-90">
                    {event.month}
                  </div>
                </div>
                <div className="p-6 flex-1 flex flex-col">
                  <h3 className="font-serif text-lg font-semibold text-hunter-green mb-2">
                    {event.title}
                  </h3>
                  <p className="text-sm text-dark-gray mb-4 text-pretty flex-1">
                    {event.description}
                  </p>
                  <div className="space-y-1.5 text-xs text-dark-gray mb-4">
                    <div className="flex items-center gap-1.5">
                      <MapPinIcon />
                      <span>{event.location}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <ClockSmallIcon />
                      <span>{event.time}</span>
                    </div>
                  </div>
                  <LinkButton href="/#cta" size="sm" variant="secondary" className="w-full">
                    {event.cta}
                  </LinkButton>
                </div>
              </article>
            </Reveal>
          ))}
        </div>

        <Reveal direction="up" className="text-center mt-12">
          <a
            href="#"
            className="inline-flex items-center justify-center font-medium rounded-full px-8 py-3 text-base border-2 border-paprika text-paprika hover:bg-paprika hover:text-white transition-all duration-200"
          >
            View Full Calendar
          </a>
        </Reveal>
      </div>
    </section>
  );
}
