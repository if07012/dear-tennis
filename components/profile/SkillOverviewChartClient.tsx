'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { SkillOverviewChart } from './SkillOverviewChart';

type FetchState =
  | { kind: 'idle' }
  | { kind: 'ok'; values: number[] | null };

/**
 * Fetches the signed-in user's per-user skill values and feeds them to the
 * radar. Until the API responds (or when the user is signed out), the chart
 * falls back to the static `skillRadar` constant baked into
 * `SkillOverviewChart` — so anonymous / signed-out renders stay identical
 * to the previous behaviour.
 *
 * When `viewingEmail` is provided (admin "view as"), the API is called
 * with `?user=<email>` so the chart shows that user's data instead.
 */
export function SkillOverviewChartClient({
  viewingEmail,
}: {
  viewingEmail: string | null;
}) {
  const { user, hydrated } = useAuth();
  const [state, setState] = useState<FetchState>({ kind: 'idle' });

  useEffect(() => {
    if (!hydrated || !user?.email) {
      setState({ kind: 'idle' });
      return;
    }
    const controller = new AbortController();
    const target = viewingEmail && viewingEmail !== user.email ? viewingEmail : null;
    const url = target
      ? `/api/profile/skill-points?user=${encodeURIComponent(target)}`
      : '/api/profile/skill-points';
    fetch(url, {
      headers: { 'x-auth-email': user.email },
      signal: controller.signal,
      cache: 'no-store',
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as { values: number[] | null };
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        setState({ kind: 'ok', values: data.values });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        // Fall back to the static constant; no UI surfacing needed.
        console.warn('skill-points fetch failed:', err);
        setState({ kind: 'ok', values: null });
      });
    return () => controller.abort();
  }, [hydrated, user?.email, viewingEmail]);

  return (
    <SkillOverviewChart
      values={state.kind === 'ok' ? state.values : undefined}
    />
  );
}
