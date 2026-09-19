'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type { LevelRecord, PlayerLevelResult } from '@/data/tennis-level-types';
import { TrophyIcon, LockIcon, CheckIcon } from '@/components/ui/Icons';

type FetchState =
  | { kind: 'loading' }
  | { kind: 'ok'; level: PlayerLevelResult }
  | { kind: 'error'; message: string };

export function TennisLevelWidget({
  viewingEmail,
  selfEmail,
}: {
  viewingEmail: string | null;
  selfEmail: string | null;
}) {
  const { user, hydrated } = useAuth();
  const [state, setState] = useState<FetchState>({ kind: 'loading' });

  useEffect(() => {
    if (!hydrated) return;
    const requester = user?.email ?? selfEmail ?? '';
    if (!requester) {
      setState({ kind: 'ok', level: emptyLevel() });
      return;
    }
    const controller = new AbortController();
    setState({ kind: 'loading' });
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
        setState({ kind: 'ok', level: body.level ?? emptyLevel() });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          kind: 'error',
          message: err instanceof Error ? err.message : 'Gagal memuat level',
        });
      });
    return () => controller.abort();
  }, [hydrated, user?.email, selfEmail, viewingEmail]);

  const isLoading = state.kind === 'loading';
  const levelData = state.kind === 'ok' ? state.level : emptyLevel();

  return (
    <section className="bg-white rounded-2xl shadow-md p-6 lg:p-8">
      <header className="flex items-center gap-3 mb-6">
        <span className="profile-section-icon" aria-hidden="true">
          <TrophyIcon />
        </span>
        <div>
          <h2 className="font-serif text-2xl font-semibold text-hunter-green">
            My Tennis Level
          </h2>
          <p className="text-sm text-dark-gray">
            {isLoading
              ? 'Memuat level…'
              : levelData.currentLevel
                ? `Current: ${levelData.currentLevel.name}`
                : 'Belum memiliki level'}
          </p>
        </div>
      </header>

      {isLoading ? (
        <TennisLevelSkeleton />
      ) : levelData.currentLevel ? (
        <div className="space-y-6">
          {/* Current Level Display */}
          <div className="relative rounded-2xl border border-hunter-green/30 bg-hunter-green/5 p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-hunter-green/10">
                  <span className="text-3xl" aria-hidden="true">🎾</span>
                </div>
                <div>
                  <p className="font-serif text-3xl font-bold text-hunter-green">
                    {levelData.currentLevel.name}
                  </p>
                  {levelData.currentLevel.description && (
                    <p className="text-sm text-dark-gray">{levelData.currentLevel.description}</p>
                  )}
                </div>
              </div>
              {levelData.nextLevel && (
                <div className="text-right">
                  <p className="text-xs font-semibold uppercase tracking-wider text-dark-gray">
                    Next Level
                  </p>
                  <p className="font-serif text-xl font-semibold text-paprika">
                    {levelData.nextLevel.name}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          {levelData.nextLevel && levelData.progress.required > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-hunter-green">
                  Progress ke {levelData.nextLevel.name}
                </p>
                <p className="text-sm text-dark-gray">
                  {levelData.progress.earned} / {levelData.progress.required} skill badge
                </p>
              </div>
              <div className="h-3 rounded-full bg-light-gray overflow-hidden">
                <div
                  className="h-full rounded-full bg-hunter-green transition-all duration-500"
                  style={{
                    width: `${Math.round((levelData.progress.earned / levelData.progress.required) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Required Skill Badges */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-dark-gray">
              Required Skill Badges
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {levelData.allLevels.flatMap((lvl) => {
                // Only show badges for current and next level
                if (lvl.id !== levelData.currentLevel?.id && lvl.id !== levelData.nextLevel?.id) return [];
                // We need to fetch level badges - for now show what we have
                return [];
              })}
              {/* We'll show all skill badges for the current/next level in a separate component */}
            </div>
          </div>

          {/* Missing badges hint */}
          {levelData.missingBadges.length > 0 && levelData.nextLevel && (
            <div className="rounded-lg border border-paprika/30 bg-paprika/5 p-4">
              <p className="text-sm font-medium text-paprika mb-2">
                Belum diperoleh untuk {levelData.nextLevel.name}:
              </p>
              <ul className="space-y-1">
                {levelData.missingBadges.slice(0, 4).map((key) => (
                  <li key={key} className="flex items-center gap-2 text-sm text-dark-gray">
                    <LockIcon className="w-4 h-4 text-paprika" />
                    <span className="capitalize">{key.replace(/-/g, ' ')}</span>
                  </li>
                ))}
                {levelData.missingBadges.length > 4 && (
                  <li className="text-sm text-paprika/80">
                    +{levelData.missingBadges.length - 4} badge lainnya...
                  </li>
                )}
              </ul>
            </div>
          )}

          {/* Earned skill badges for current level */}
          {levelData.currentLevel && levelData.progress.earned > 0 && levelData.progress.required > 0 && (
            <div className="rounded-lg border border-hunter-green/30 bg-hunter-green/5 p-4">
              <p className="text-sm font-medium text-hunter-green mb-2">
                Sudah diperoleh untuk {levelData.currentLevel.name}:
              </p>
              <div className="flex flex-wrap gap-2">
                {/* In a real implementation, we'd list the earned badges here */}
                <span className="text-sm text-hunter-green">
                  {levelData.progress.earned} dari {levelData.progress.required} badge
                </span>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-light-gray bg-off-white p-8 text-center">
          <TrophyIcon className="mx-auto h-12 w-12 text-dark-gray/30" />
          <p className="mt-3 text-dark-gray">Belum memiliki level tenis.</p>
          <p className="text-sm text-dark-gray/70 mt-1">
            Level akan muncul setelah admin memberikan skill badge pertama.
          </p>
        </div>
      )}

      {state.kind === 'error' && (
        <p className="mt-4 text-xs text-paprika">{state.message}</p>
      )}
    </section>
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

function TennisLevelSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="rounded-2xl bg-off-white p-6">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-light-gray" />
          <div>
            <div className="h-8 w-40 bg-light-gray rounded" />
            <div className="h-4 w-24 bg-light-gray rounded mt-2" />
          </div>
        </div>
      </div>
      <div className="h-3 bg-light-gray rounded-full" />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-light-gray bg-off-white p-3">
            <div className="h-8 w-8 rounded bg-light-gray mx-auto" />
            <div className="h-3 w-16 bg-light-gray rounded mx-auto mt-2" />
          </div>
        ))}
      </div>
    </div>
  );
}