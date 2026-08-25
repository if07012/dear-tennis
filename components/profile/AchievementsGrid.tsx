import { achievements } from '@/data/profile';
import { AwardIcon } from '@/components/ui/Icons';

/**
 * Achievements grid. Pure server component — the list is static for v1.
 */
export function AchievementsGrid() {
  return (
    <section className="bg-white rounded-2xl shadow-md p-6 lg:p-8">
      <header className="flex items-center gap-3 mb-6">
        <span className="profile-section-icon" aria-hidden="true">
          <AwardIcon />
        </span>
        <div>
          <h2 className="font-serif text-2xl font-semibold text-hunter-green">
            Achievements
          </h2>
          <p className="text-sm text-dark-gray">
            Badge koleksi dari performa kamu
          </p>
        </div>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {achievements.map((achievement) => (
          <div
            key={achievement.id}
            className="achievement-badge group flex flex-col items-center gap-2 rounded-xl border border-light-gray bg-off-white p-4 text-center transition-all duration-300 cursor-default"
          >
            <span
              className="achievement-icon text-3xl transition-colors duration-300"
              aria-hidden="true"
            >
              {achievement.icon}
            </span>
            <span className="achievement-label text-xs font-semibold uppercase tracking-wider text-dark-gray transition-colors duration-300">
              {achievement.label}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}