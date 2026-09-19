'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type { BadgeCatalogRecord, GrantedBadge, PlayerLevelResult } from '@/data/tennis-level-types';
import { XIcon } from '@/components/ui/Icons';

type FetchState<T> =
  | { kind: 'loading' }
  | { kind: 'ok'; data: T }
  | { kind: 'error'; message: string };

export function AchievementsGrid({
  viewingEmail,
  selfEmail,
}: {
  viewingEmail: string | null;
  selfEmail: string | null;
}) {
  const { user, hydrated } = useAuth();
  const [badgesState, setBadgesState] = useState<FetchState<GrantedBadge[]>>({ kind: 'loading' });
  const [catalogState, setCatalogState] = useState<FetchState<BadgeCatalogRecord[]>>({ kind: 'loading' });
  const [levelState, setLevelState] = useState<FetchState<PlayerLevelResult>>({ kind: 'loading' });
  const [selectedBadge, setSelectedBadge] = useState<BadgeCatalogRecord | null>(null);
  const [selectedBadgeGrant, setSelectedBadgeGrant] = useState<GrantedBadge | null>(null);

  // Fetch granted badges
  useEffect(() => {
    if (!hydrated) return;
    const requester = user?.email ?? selfEmail ?? '';
    if (!requester) {
      setBadgesState({ kind: 'ok', data: [] });
      return;
    }
    const controller = new AbortController();
    setBadgesState({ kind: 'loading' });
    const url = viewingEmail
      ? `/api/profile/badges?user=${encodeURIComponent(viewingEmail)}`
      : '/api/profile/badges';
    fetch(url, {
      headers: { 'x-auth-email': requester },
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as { badges: GrantedBadge[] };
      })
      .then((body) => {
        if (controller.signal.aborted) return;
        setBadgesState({ kind: 'ok', data: body.badges ?? [] });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setBadgesState({
          kind: 'error',
          message: err instanceof Error ? err.message : 'Gagal memuat badge',
        });
      });
    return () => controller.abort();
  }, [hydrated, user?.email, selfEmail, viewingEmail]);

  // Fetch badge catalog
  useEffect(() => {
    if (!hydrated) return;
    const controller = new AbortController();
    fetch('/api/profile/badges/catalog', {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as { badges: BadgeCatalogRecord[] };
      })
      .then((body) => {
        if (controller.signal.aborted) return;
        setCatalogState({ kind: 'ok', data: body.badges ?? [] });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setCatalogState({
          kind: 'error',
          message: err instanceof Error ? err.message : 'Gagal memuat katalog badge',
        });
      });
    return () => controller.abort();
  }, [hydrated]);

  // Fetch player level for next level info
  useEffect(() => {
    if (!hydrated) return;
    const requester = user?.email ?? selfEmail ?? '';
    if (!requester) {
      setLevelState({ kind: 'ok', data: emptyLevel() });
      return;
    }
    const controller = new AbortController();
    const url = viewingEmail
      ? `/api/profile/level?user=${encodeURIComponent(viewingEmail)}`
      : '/api/profile/level';
    fetch(url, {
      headers: { 'x-auth-email': requester },
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as { level: PlayerLevelResult };
      })
      .then((body) => {
        if (controller.signal.aborted) return;
        setLevelState({ kind: 'ok', data: body.level ?? emptyLevel() });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setLevelState({
          kind: 'error',
          message: err instanceof Error ? err.message : 'Gagal memuat level',
        });
      });
    return () => controller.abort();
  }, [hydrated, user?.email, selfEmail, viewingEmail]);

  const isLoading = badgesState.kind === 'loading' || catalogState.kind === 'loading' || levelState.kind === 'loading';
  const grantedBadges = badgesState.kind === 'ok' ? badgesState.data : [];
  const catalog = catalogState.kind === 'ok' ? catalogState.data : [];
  const levelData = levelState.kind === 'ok' ? levelState.data : emptyLevel();

  const grantedKeys = new Set(grantedBadges.map((g) => g.key));
  const earnedSkillKeys = new Set(
    grantedBadges.filter((g) => g.type === 'skill' && g.status === 'active').map((g) => g.key)
  );

  const skillBadges = catalog.filter((b) => b.type === 'skill');
  const achievementBadges = catalog.filter((b) => b.type === 'achievement');

  const openBadgeDetail = (badge: BadgeCatalogRecord) => {
    const grant = grantedBadges.find((g) => g.key === badge.key);
    setSelectedBadge(badge);
    setSelectedBadgeGrant(grant ?? null);
  };

  const closeBadgeDetail = () => {
    setSelectedBadge(null);
    setSelectedBadgeGrant(null);
  };

  return (
    <>
      <section className="bg-white rounded-2xl shadow-md p-6 lg:p-8">
        <header className="flex items-center gap-3 mb-6">
          <span className="profile-section-icon" aria-hidden="true">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
          </span>
          <div>
            <h2 className="font-serif text-2xl font-semibold text-hunter-green">
              My Achievements
            </h2>
            <p className="text-sm text-dark-gray">
              {isLoading
                ? 'Memuat badge…'
                : `${grantedBadges.length} badge dikoleksi dari ${catalog.length} tersedia`}
            </p>
          </div>
        </header>

        <div className="space-y-8">
          {/* Skill Badges Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-hunter-green">Skill Badges</h3>
              <span className="text-xs text-dark-gray">
                {skillBadges.filter((b) => earnedSkillKeys.has(b.key)).length} / {skillBadges.length}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {skillBadges.map((badge) => {
                const isEarned = earnedSkillKeys.has(badge.key);
                const isRequiredForNext = levelData.nextLevel
                  ? levelData.missingBadges.includes(badge.key) || (earnedSkillKeys.has(badge.key) && !levelData.missingBadges.includes(badge.key))
                  : false;

                return (
                  <button
                    key={badge.key}
                    type="button"
                    onClick={() => openBadgeDetail(badge)}
                    className={`achievement-badge group flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-all duration-300 ${isEarned
                        ? 'border-hunter-green/30 bg-hunter-green/5'
                        : 'border-light-gray bg-off-white'
                      }`}
                  >
                    <span
                      className={`achievement-icon text-3xl transition-colors duration-300 ${isEarned ? '' : 'grayscale opacity-50'
                        }`}
                      aria-hidden="true"
                    >
                      {badge.icon || '🏅'}
                    </span>
                    <span className={`achievement-label text-xs font-semibold uppercase tracking-wider transition-colors duration-300 ${isEarned ? 'text-hunter-green' : 'text-dark-gray'
                      }`}>
                      {badge.label}
                    </span>
                    <span className={`text-[0.65rem] font-semibold uppercase tracking-wider ${isEarned ? 'text-hunter-green' : 'text-dark-gray/50'
                      }`}>
                      {isEarned ? 'Earned' : 'Locked'}
                    </span>
                    {isRequiredForNext && !isEarned && (
                      <span className="rounded-full bg-paprika/10 px-1.5 py-0.5 text-[0.6rem] font-semibold text-paprika">
                        Required for next
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Achievement Badges Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-paprika">Achievement Badges</h3>
              <span className="text-xs text-dark-gray">
                {grantedBadges.filter((g) => g.type === 'achievement' && g.status === 'active').length} / {achievementBadges.length}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {achievementBadges.map((badge) => {
                const isEarned = grantedKeys.has(badge.key);

                return (
                  <button
                    key={badge.key}
                    type="button"
                    onClick={() => openBadgeDetail(badge)}
                    className={`achievement-badge group flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-all duration-300 ${isEarned
                        ? 'border-paprika/30 bg-paprika/5'
                        : 'border-light-gray bg-off-white'
                      }`}
                  >
                    <span
                      className={`achievement-icon text-3xl transition-colors duration-300 ${isEarned ? '' : 'grayscale opacity-50'
                        }`}
                      aria-hidden="true"
                    >
                      {badge.icon || '🏅'}
                    </span>
                    <span className={`achievement-label text-xs font-semibold uppercase tracking-wider transition-colors duration-300 ${isEarned ? 'text-paprika' : 'text-dark-gray'
                      }`}>
                      {badge.label}
                    </span>
                    <span className={`text-[0.65rem] font-semibold uppercase tracking-wider ${isEarned ? 'text-paprika' : 'text-dark-gray/50'
                      }`}>
                      {isEarned ? 'Earned' : 'Locked'}
                    </span>
                  </button>
                );
              })}
              {achievementBadges.length === 0 && (
                <div className="col-span-full rounded-xl border border-dashed border-light-gray bg-off-white p-8 text-center text-sm text-dark-gray">
                  Belum ada achievement badge.
                </div>
              )}
            </div>
          </div>
        </div>

        {badgesState.kind === 'error' && (
          <p className="mt-4 text-xs text-paprika">{badgesState.message}</p>
        )}
      </section>

      {/* Badge Detail Modal */}
      {selectedBadge && (
        <BadgeDetailModal
          badge={selectedBadge}
          grant={selectedBadgeGrant}
          levelData={levelData}
          onClose={closeBadgeDetail}
        />
      )}
    </>
  );
}

function emptyLevel(): PlayerLevelResult {
  return {
    currentLevel: null,
    nextLevel: null,
    progress: { earned: 0, required: 0 },
    missingBadges: [],
    allLevels: [],
  };
}

function BadgeDetailModal({
  badge,
  grant,
  levelData,
  onClose,
}: {
  badge: BadgeCatalogRecord;
  grant: GrantedBadge | null;
  levelData: PlayerLevelResult;
  onClose: () => void;
}) {
  const isEarned = !!grant && grant.status === 'active';
  const isSkillBadge = badge.type === 'skill';
  const isRequiredForNext = levelData.nextLevel
    ? levelData.missingBadges.includes(badge.key)
    : false;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-label={`Detail badge ${badge.label}`}
    >
      <div className="w-full max-w-md mx-4 rounded-2xl border border-light-gray bg-white p-6 shadow-xl max-h-[80vh] overflow-y-auto">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-lg font-semibold text-hunter-green">
            Detail Badge
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-dark-gray transition-colors hover:bg-light-gray"
            aria-label="Tutup"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="text-center mb-6">
          <span className="text-5xl" aria-hidden="true">{badge.icon || '🏅'}</span>
          <p className="mt-2 font-serif text-xl font-semibold text-hunter-green">{badge.label}</p>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider ${isSkillBadge
                ? 'bg-hunter-green/10 text-hunter-green'
                : 'bg-paprika/10 text-paprika'
              }`}>
              {isSkillBadge ? 'Skill Badge' : 'Achievement Badge'}
            </span>
            {badge.category && (
              <span className="rounded-full bg-off-white px-2 py-0.5 text-[0.65rem] font-semibold text-dark-gray">
                {badge.category}
              </span>
            )}
            <span className={`rounded-full px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider ${isEarned ? 'bg-hunter-green/10 text-hunter-green' : 'bg-paprika/10 text-paprika'
              }`}>
              {isEarned ? 'Earned' : 'Locked'}
            </span>
          </div>
        </div>

        {badge.description && (
          <div className="mb-4 p-3 rounded-lg bg-off-white">
            <p className="text-sm text-dark-gray">{badge.description}</p>
          </div>
        )}

        {badge.earningCriteria && (
          <div className="mb-4 p-3 rounded-lg bg-paprika/5 border border-paprika/20">
            <p className="text-xs font-semibold uppercase tracking-wider text-paprika mb-1">Cara Memperoleh</p>
            <p className="text-sm text-dark-gray">{badge.earningCriteria}</p>
          </div>
        )}

        {isEarned && grant && (
          <div className="mb-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-dark-gray">Diperoleh</span>
              <span className="font-medium text-hunter-green">
                {new Date(grant.grantedAt).toLocaleString('id-ID')}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-dark-gray">Oleh</span>
              <span className="font-medium text-hunter-green">{grant.grantedBy}</span>
            </div>
            {grant.note && (
              <div className="flex justify-between text-sm">
                <span className="text-dark-gray">Catatan</span>
                <span className="font-medium text-hunter-green">{grant.note}</span>
              </div>
            )}
          </div>
        )}

        {!isEarned && isSkillBadge && isRequiredForNext && levelData.nextLevel && (
          <div className="mb-4 p-3 rounded-lg bg-paprika/5 border border-paprika/20">
            <p className="text-xs font-semibold uppercase tracking-wider text-paprika mb-1">Required untuk Level Berikutnya</p>
            <p className="text-sm text-dark-gray">
              Badge ini diperlukan untuk naik ke <strong>{levelData.nextLevel.name}</strong>.
            </p>
          </div>
        )}

        {!isEarned && isSkillBadge && !isRequiredForNext && (
          <div className="mb-4 p-3 rounded-lg bg-off-white border border-light-gray">
            <p className="text-sm text-dark-gray">
              Badge skill ini belum diperoleh. Ikuti coaching/evaluation terkait untuk mendapatkannya.
            </p>
          </div>
        )}

        {!isEarned && !isSkillBadge && (
          <div className="mb-4 p-3 rounded-lg bg-off-white border border-light-gray">
            <p className="text-sm text-dark-gray">
              Achievement badge ini didapat saat memenuhi kriteria tertentu (turnamen, milestone, dll).
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-full bg-paprika px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-paprika-hover"
        >
          Tutup
        </button>
      </div>
    </div>
  );
}