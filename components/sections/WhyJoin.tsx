import { Reveal } from '@/components/ui/Reveal';
import { SectionHeader } from '@/components/ui/SectionHeader';
import {
  UsersIcon,
  LightningIcon,
  CalendarIcon,
  LayersIcon,
  ClockIcon,
  HeartIcon,
  TrophyIcon,
  StarIcon,
  TargetIcon,
  SparklesIcon,
} from '@/components/ui/Icons';
import type {
  BenefitIconKey,
  BenefitItem,
  WhyJoinSettings,
} from '@/data/why-join-types';

const ICON_MAP: Record<BenefitIconKey, React.ComponentType<{ size?: number; className?: string }>> = {
  users: UsersIcon,
  lightning: LightningIcon,
  calendar: CalendarIcon,
  layers: LayersIcon,
  clock: ClockIcon,
  heart: HeartIcon,
  trophy: TrophyIcon,
  star: StarIcon,
  target: TargetIcon,
  sparkles: SparklesIcon,
};

function BenefitCard({ benefit, index }: { benefit: BenefitItem; index: number }) {
  const Icon = ICON_MAP[benefit.icon] ?? UsersIcon;
  return (
    <Reveal direction="up" delay={index % 6 * 0.1} className="h-full">
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

type Props = {
  settings: WhyJoinSettings;
  benefits: BenefitItem[];
};

export function WhyJoin({ settings, benefits }: Props) {
  return (
    <section id="why-join" className="section-padding bg-off-white">
      <div className="container-base">
        <SectionHeader
          tag={settings.tag || 'Benefits'}
          title={settings.title || 'Why Choose Dear Tennis?'}
          subtitle={settings.subtitle || undefined}
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
