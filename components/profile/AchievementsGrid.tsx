'use client';

import { useEffect, useState } from 'react';
import { AwardIcon } from '@/components/ui/Icons';
import { useAuth } from '@/hooks/useAuth';
import type { GrantedBadge } from '@/data/achievements-types';

type FetchState =
  | { kind: 'loading' }
  | { kind: 'ok'; badges: GrantedBadge[] }
  | { kind: 'error'; message: string };

/**
 * Achievements grid. Fetches the granted badges for the active viewer
 * (signed-in user, or the admin's view-as target) and renders one card
 * per badge. Falls back to an empty state when the user has no grants.
 */
export function AchievementsGrid({
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
      setState({ kind: 'ok', badges: [] });
      return;
    }
    const controller = new AbortController();
    setState({ kind: 'loading' });
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
        setState({ kind: 'ok', badges: body.badges ?? [] });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          kind: 'error',
          message: err instanceof Error ? err.message : 'Gagal memuat badge',
        });
      });
    return () => controller.abort();
  }, [hydrated, user?.email, selfEmail, viewingEmail]);

  const isLoading = state.kind === 'loading';
  const badges = state.kind === 'ok' ? state.badges : [];

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
            {isLoading
              ? 'Memuat badge…'
              : badges.length === 0
                ? 'Belum ada badge. Admin dapat授予 badge dari halaman Manage User.'
                : `${badges.length} badge dikoleksi`}
          </p>
        </div>
      </header>

      <div
        className="grid grid-cols-2 sm:grid-cols-3 gap-4"
        aria-busy={isLoading}
        aria-live="polite"
      >
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => (
              <AchievementSkeleton key={i} />
            ))
          : badges.length === 0
            ? null
            : badges.map((badge) => (
                <div
                  key={badge.key}
                  className="achievement-badge group flex flex-col items-center gap-2 rounded-xl border border-light-gray bg-off-white p-4 text-center transition-all duration-300 cursor-default"
                >
                  <span
                    className="achievement-icon text-3xl transition-colors duration-300"
                    aria-hidden="true"
                  >
                    {badge.icon || '🏅'}
                  </span>
                  <span className="achievement-label text-xs font-semibold uppercase tracking-wider text-dark-gray transition-colors duration-300">
                    {badge.label}
                  </span>
                  {badge.description && (
                    <span className="text-[0.65rem] text-dark-gray/80 leading-snug">
                      {badge.description}
                    </span>
                  )}
                </div>
              ))}
      </div>

      {state.kind === 'error' && (
        <p className="mt-4 text-xs text-paprika">{state.message}</p>
      )}
    </section>
  );
}

function AchievementSkeleton() {
  return (
    <div
      className="animate-pulse flex flex-col items-center gap-2 rounded-xl border border-light-gray bg-off-white p-4"
      aria-hidden="true"
    >
      <div className="h-8 w-8 rounded-full bg-light-gray" />
      <div className="h-2 w-16 rounded bg-light-gray" />
      <div className="h-1.5 w-24 rounded bg-light-gray/70" />
    </div>
  );
}