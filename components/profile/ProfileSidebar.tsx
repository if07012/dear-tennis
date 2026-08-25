import type { ProfileUser } from '@/data/profile-types';

type Props = {
  user: ProfileUser;
};

/**
 * Left-column sidebar: avatar, name, rank, four stat tiles.
 * Pure server component — no client state.
 */
export function ProfileSidebar({ user }: Props) {
  const { name, rank, avatarUrl, stats } = user;

  return (
    <aside className="bg-white rounded-2xl shadow-md p-6 lg:p-8 sticky top-24 self-start">
      <div className="flex flex-col items-center text-center">
        <div className="relative">
          <img
            src={avatarUrl}
            alt={name}
            className="w-32 h-32 rounded-full object-cover border-4 border-hunter-green shadow-md"
          />
          <span
            aria-hidden="true"
            className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-hunter-green text-white flex items-center justify-center text-xs font-bold border-2 border-white"
          >
            ✓
          </span>
        </div>

        <h1 className="mt-4 font-serif text-2xl font-semibold text-hunter-green">
          {name}
        </h1>
        <p className="mt-1 text-sm font-medium text-paprika">{rank}</p>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-4">
        <div className="rounded-xl bg-off-white p-4">
          <span className="stat-tile-value">{stats.sessions}</span>
          <span className="stat-tile-label">Sessions</span>
        </div>
        <div className="rounded-xl bg-off-white p-4">
          <span className="stat-tile-value">{stats.avgScore.toFixed(1)}</span>
          <span className="stat-tile-label">Avg Score</span>
        </div>
        <div className="rounded-xl bg-off-white p-4">
          <span className="stat-tile-value">{stats.hours}</span>
          <span className="stat-tile-label">Hours</span>
        </div>
        <div className="rounded-xl bg-off-white p-4">
          <span className="stat-tile-value">{stats.badges}</span>
          <span className="stat-tile-label">Badges</span>
        </div>
      </div>
    </aside>
  );
}