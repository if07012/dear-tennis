import { skillBreakdownDefaults } from '@/data/profile';
import { SkillProgressBar } from './SkillProgressBar';

type SkillKey = 'Forehand' | 'Backhand' | 'Serve' | 'Volley' | 'Footwork';

type Props = {
  /** Avg value per skill computed from the selected event filter. May be undefined = fall back to defaults. */
  skillSummary?: Partial<Record<SkillKey, number>> | null;
};

/**
 * Renders the 5 skill bars. The primary bar value uses the parent's
 * `skillSummary` if provided; otherwise falls back to the item's first detail.
 */
export function SkillBreakdown({ skillSummary }: Props) {
  return (
    <section className="bg-white rounded-2xl shadow-md p-6 lg:p-8">
      <header className="mb-6">
        <h2 className="font-serif text-2xl font-semibold text-hunter-green">
          Skill Breakdown
        </h2>
        <p className="text-sm text-dark-gray">
          Rincian kemampuan kamu berdasarkan event yang difilter
        </p>
      </header>

      <div className="grid gap-4">
        {skillBreakdownDefaults.map((item) => (
          <SkillProgressBar
            key={item.skill}
            item={item}
            valueOverride={skillSummary?.[item.skill]}
          />
        ))}
      </div>
    </section>
  );
}