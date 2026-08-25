import { Reveal } from '@/components/ui/Reveal';
import { SectionHeader } from '@/components/ui/SectionHeader';
import {
  UsersIcon,
  LightningIcon,
  CalendarIcon,
  LayersIcon,
  ClockIcon,
  HeartIcon,
} from '@/components/ui/Icons';
import { benefits, type Benefit } from '@/data/benefits';

const ICON_MAP = {
  users: UsersIcon,
  lightning: LightningIcon,
  calendar: CalendarIcon,
  layers: LayersIcon,
  clock: ClockIcon,
  heart: HeartIcon,
} as const;

function BenefitCard({ benefit, index }: { benefit: Benefit; index: number }) {
  const Icon = ICON_MAP[benefit.icon];
  return (
    <Reveal direction="up" delay={index % 6} className="h-full">
      <div className="group h-full bg-white rounded-2xl p-8 border border-light-gray hover:border-paprika/30 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-hunter-green to-teal flex items-center justify-center text-white mb-5 group-hover:scale-110 transition-transform duration-300">
          <Icon size={26} />
        </div>
        <h3 className="font-serif text-xl font-semibold text-hunter-green mb-3">
          {benefit.title}
        </h3>
        <p className="text-dark-gray leading-relaxed text-pretty">{benefit.description}</p>
      </div>
    </Reveal>
  );
}

export function WhyJoin() {
  return (
    <section id="why-join" className="section-padding bg-off-white">
      <div className="container-base">
        <SectionHeader
          tag="Benefits"
          title="Why Choose Dear Tennis?"
          subtitle="More than just a tennis club – we are a family"
          center
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {benefits.map((benefit, i) => (
            <BenefitCard key={benefit.id} benefit={benefit} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
