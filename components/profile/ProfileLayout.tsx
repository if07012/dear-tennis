'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Reveal } from '@/components/ui/Reveal';
import { profileUser, skillByEvent } from '@/data/profile';
import type { ProfileUser, SkillKey } from '@/data/profile-types';
import { ProfileSidebar } from './ProfileSidebar';
import { AchievementsGrid } from './AchievementsGrid';
import { SkillBreakdown } from './SkillBreakdown';
import { SkillBreakdownClient } from './SkillBreakdownClient';
import { EventFilterChips } from './EventFilterChips';
import { EventHistory } from './EventHistory';
import { EventGallery } from './EventGallery';
import { SkillOverviewChartClient } from './SkillOverviewChartClient';
import { PerformanceOverviewChart } from './PerformanceOverviewChart';
import { AdminUserPicker } from './AdminUserPicker';
import { useAuth } from '@/hooks/useAuth';
import type { UserRecord } from '@/lib/users-store';

const SKILL_KEYS: SkillKey[] = ['Forehand', 'Backhand', 'Serve', 'Volley', 'Footwork'];

/**
 * Parse free-form duration strings ("90 min", "2 hours", "All day",
 * "Weekly") into fractional hours. Anything we can't parse contributes 0.
 * Best-effort: handles "<n> min", "<n> hour(s)", "<n>h", "<n>m",
 * "All day" → 8h, "Weekly" → 0.
 */
function sumDurationHours(durations: string[]): number {
  let total = 0;
  for (const raw of durations) {
    const s = raw.trim().toLowerCase();
    if (!s) continue;
    if (s.includes('all day') || s.includes('full day')) {
      total += 8;
      continue;
    }
    if (s.includes('weekly')) {
      continue;
    }
    // First "<n> min" wins; otherwise look for hours.
    const minMatch = s.match(/(\d+(?:\.\d+)?)\s*(?:m|min|minute)/);
    if (minMatch) {
      total += Number(minMatch[1]) / 60;
      continue;
    }
    const hourMatch = s.match(/(\d+(?:\.\d+)?)\s*(?:h|hr|hour)/);
    if (hourMatch) {
      total += Number(hourMatch[1]);
    }
  }
  return Math.round(total);
}

function summarize(
  selectedIds: string[],
): Partial<Record<SkillKey, number>> | null {
  if (selectedIds.length === 0) return null;
  const events = selectedIds
    .map((id) => skillByEvent[id])
    .filter((e): e is NonNullable<typeof e> => Boolean(e));
  if (events.length === 0) return null;

  const summary: Partial<Record<SkillKey, number>> = {};
  for (const key of SKILL_KEYS) {
    const values = events.map((e) => e[key]).filter((v): v is number => typeof v === 'number');
    if (values.length > 0) {
      summary[key] = Math.round(
        values.reduce((a, b) => a + b, 0) / values.length,
      );
    }
  }
  return summary;
}

/**
 * Build the ProfileUser shown in the sidebar. Real `name` + `avatarUrl`
 * come from the logged-in user (see useAuth) so the dashboard reflects who
 * is actually signed in. Everything else (rank, stats, skill breakdowns)
 * still uses the bundled mock data — the profile is otherwise static for
 * now.
 */
function buildSidebarUser(
  name: string,
  email: string,
  photo: string | undefined,
  rank: string | undefined,
  fallback: ProfileUser,
): ProfileUser {
  const safeName = name.trim() || email.split('@')[0] || fallback.name;
  // Use the user's uploaded photo (base64 data URL from the profile
  // editor) when present. Otherwise fall back to a DiceBear silhouette
  // keyed on the name so each login still shows a unique face.
  const avatarUrl =
    photo && photo.startsWith('data:image/')
      ? photo
      : `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(safeName)}`;
  // Prefer the explicit rank from the viewed user's record; fall back
  // to the bundled profile rank when nothing is stored yet.
  const safeRank = rank?.trim() || fallback.rank;
  return { ...fallback, name: safeName, avatarUrl, rank: safeRank };
}

export function ProfileLayout({
  isAdmin = false,
  viewingEmail,
  selfEmail,
}: {
  isAdmin?: boolean;
  viewingEmail: string | null;
  selfEmail: string | null;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [viewedUser, setViewedUser] = useState<UserRecord | null>(null);
  const [joinedCount, setJoinedCount] = useState<number | null>(null);
  const [joinedHours, setJoinedHours] = useState<number | null>(null);
  const [badgesCount, setBadgesCount] = useState<number | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const skillSummary = useMemo(() => summarize(selectedEvents), [selectedEvents]);

  // When admin views another user, fetch that user's record so the sidebar
  // shows their name / photo / rank instead of the admin's own.
  useEffect(() => {
    if (!isAdmin || !viewingEmail || viewingEmail === selfEmail) {
      setViewedUser(null);
      return;
    }
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch(
          `/api/admin/users/by-email?email=${encodeURIComponent(viewingEmail)}`,
          { headers: { 'x-auth-email': selfEmail ?? '' }, signal: controller.signal },
        );
        if (!res.ok) {
          setViewedUser(null);
          return;
        }
        const body = (await res.json()) as { user: UserRecord | null };
        setViewedUser(body.user);
      } catch {
        setViewedUser(null);
      }
    })();
    return () => controller.abort();
  }, [isAdmin, viewingEmail, selfEmail]);

  // Fetch the joined-activities count for the active sidebar subject
  // (the viewed user when admin view-as, otherwise the signed-in user).
  useEffect(() => {
    const targetEmail =
      isAdmin && viewingEmail && viewingEmail !== selfEmail
        ? viewingEmail
        : user?.email ?? null;
    if (!targetEmail) {
      setJoinedCount(null);
      setJoinedHours(null);
      setStatsLoading(true);
      return;
    }
    setStatsLoading(true);
    const controller = new AbortController();
    fetch(
      `/api/profile/joined-activities?user=${encodeURIComponent(targetEmail)}`,
      {
        headers: { 'x-auth-email': user?.email ?? selfEmail ?? '' },
        signal: controller.signal,
        cache: 'no-store',
      },
    )
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as {
          events: Array<{ duration?: string }>;
        };
      })
      .then((body) => {
        if (controller.signal.aborted) return;
        setJoinedCount(body.events.length);
        setJoinedHours(sumDurationHours(body.events.map((e) => e.duration ?? '')));
        setStatsLoading(false);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setJoinedCount(null);
        setJoinedHours(null);
        setStatsLoading(false);
      });
    return () => controller.abort();
  }, [isAdmin, viewingEmail, selfEmail, user?.email]);

  // Fetch the granted-badges count for the active sidebar subject so the
  // "Badges" stat tile matches the Achievements panel.
  useEffect(() => {
    const targetEmail =
      isAdmin && viewingEmail && viewingEmail !== selfEmail
        ? viewingEmail
        : user?.email ?? null;
    if (!targetEmail) {
      setBadgesCount(null);
      setStatsLoading(true);
      return;
    }
    setStatsLoading(true);
    const controller = new AbortController();
    fetch(
      `/api/profile/badges?user=${encodeURIComponent(targetEmail)}&count=1`,
      {
        headers: { 'x-auth-email': user?.email ?? selfEmail ?? '' },
        signal: controller.signal,
        cache: 'no-store',
      },
    )
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as { count: number };
      })
      .then((body) => {
        if (controller.signal.aborted) return;
        setBadgesCount(body.count);
        setStatsLoading(false);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setBadgesCount(null);
        setStatsLoading(false);
      });
    return () => controller.abort();
  }, [isAdmin, viewingEmail, selfEmail, user?.email]);

  const sidebarUser = useMemo<ProfileUser>(() => {
    const base = viewedUser
      ? buildSidebarUser(
          viewedUser.name,
          viewedUser.email,
          viewedUser.photo,
          viewedUser.rank,
          profileUser,
        )
      : buildSidebarUser(
          user?.name ?? '',
          user?.email ?? '',
          user?.photo,
          user?.rank,
          profileUser,
        );
    if (joinedCount === null && badgesCount === null && joinedHours === null) return base;
    return {
      ...base,
      stats: {
        ...base.stats,
        sessions: joinedCount ?? base.stats.sessions,
        hours: joinedHours ?? base.stats.hours,
        badges: badgesCount ?? base.stats.badges,
      },
    };
  }, [viewedUser, user?.name, user?.email, user?.photo, user?.rank, joinedCount, joinedHours, badgesCount]);

  const isViewingOther = isAdmin && !!viewingEmail && viewingEmail !== selfEmail;
  const viewingQuery = isViewingOther ? `?user=${encodeURIComponent(viewingEmail!)}` : '';

  const onSelectUser = (u: UserRecord) => {
    setPickerOpen(false);
    router.push(`/profile?user=${encodeURIComponent(u.email)}`);
  };

  return (
    <div className="container-base section-padding">
      {isAdmin && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-paprika/30 bg-paprika/5 px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-paprika">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-paprika text-[0.6rem] font-bold text-white">
              A
            </span>
            <span className="font-semibold">Admin Mode</span>
            {isViewingOther ? (
              <span className="text-paprika/80">
                · Viewing as <strong>{viewedUser?.name || viewingEmail}</strong>
              </span>
            ) : (
              <span className="text-paprika/80">· Viewing your own profile</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="rounded-full border border-paprika bg-white px-3 py-1 text-xs font-semibold text-paprika transition-colors hover:bg-paprika hover:text-white"
            >
              {isViewingOther ? 'Ganti user' : 'View sebagai user lain'}
            </button>
            {isViewingOther && (
              <button
                type="button"
                onClick={() => router.push('/profile')}
                className="rounded-full border border-paprika/40 bg-white px-3 py-1 text-xs font-semibold text-paprika transition-colors hover:bg-paprika/10"
              >
                Kembali ke profil sendiri
              </button>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[300px_1fr]">
        <Reveal>
          <ProfileSidebar user={sidebarUser} readOnly={isViewingOther} loading={statsLoading} />
        </Reveal>

        <main className="flex flex-col gap-8 min-w-0">
          <Reveal>
            <SkillOverviewChartClient viewingEmail={viewingEmail} />
          </Reveal>

          <Reveal>
            <SkillBreakdownClient viewingEmail={viewingEmail} isAdmin={isAdmin} />
          </Reveal>

          <Reveal>
            <PerformanceOverviewChart
              selectedEvents={selectedEvents}
              viewingEmail={viewingEmail}
              isAdmin={isAdmin}
            />
          </Reveal>

          <Reveal>
            <AchievementsGrid viewingEmail={viewingEmail} selfEmail={selfEmail} />
          </Reveal>

          <Reveal>
            <EventHistory viewingEmail={viewingEmail} />
          </Reveal>
        </main>
      </div>

      <AdminUserPicker
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={onSelectUser}
      />
      {/* viewingQuery is exposed so children can read the active ?user param
          through React state (avoids extra useSearchParams() calls in each
          chart component). */}
      <span className="hidden" data-viewing-query={viewingQuery} />
    </div>
  );
}