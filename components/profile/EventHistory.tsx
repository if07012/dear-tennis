'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type { EventType, FilterableEvent } from '@/data/profile-types';
// EventType stays imported for the legacy fallback in the tag chip below —
// new admin-catalogued events carry `category` and skip the fallback.
import { DateRangeFilter, type DateRange } from '@/components/ui/DateRangeFilter';
import { FilterIcon, CalendarIcon, MapPinIcon, UsersIcon } from '@/components/ui/Icons';
import {
  SKILL_DISPLAY_ORDER,
  SKILL_LABELS,
  type SkillValues,
} from '@/data/user-skill-points-types';
import { MatchScorecard } from './MatchScorecard';

// Mirrors the admin "Edit activity" categories so a change in the editor
// shows up here automatically. Keep labels in sync with
// app/admin/activities-list/ActivitiesListClient.tsx.
const CATEGORY_OPTIONS: Array<{
  key: 'training' | 'social' | 'competitive';
  label: string;
}> = [
  { key: 'training', label: 'Training' },
  { key: 'social', label: 'Social Play' },
  { key: 'competitive', label: 'Competitive' },
];

const CATEGORY_LABEL: Record<(typeof CATEGORY_OPTIONS)[number]['key'], string> =
  CATEGORY_OPTIONS.reduce(
    (acc, opt) => {
      acc[opt.key] = opt.label;
      return acc;
    },
    {} as Record<(typeof CATEGORY_OPTIONS)[number]['key'], string>,
  );

type CategoryFilter = (typeof CATEGORY_OPTIONS)[number]['key'] | 'all';

// Legacy EventType label map — used only as a fallback when an event
// arrives without a `category` (e.g. older mock data in profile.html).
const TYPE_LABEL: Partial<Record<EventType, string>> = {
  training: 'Training',
  open: 'Social Play',
  tournament: 'Competitive',
  championship: 'Championship',
  funmatch: 'Fun Match',
};

function withinRange(dateISO: string, range: DateRange): boolean {
  if (!range) return true;
  const t = new Date(dateISO).getTime();
  const start = new Date(range.start).getTime();
  const end = new Date(range.end).getTime() + 24 * 60 * 60 * 1000 - 1; // inclusive end-of-day
  return t >= start && t <= end;
}

const PAGE_SIZE = 4;

type FetchState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ok'; events: FilterableEvent[] }
  | { kind: 'error'; message: string };

function totalOf(values: SkillValues): number {
  return SKILL_DISPLAY_ORDER.reduce((sum, k) => sum + values[k], 0);
}

export function EventHistory({
  viewingEmail,
}: {
  viewingEmail: string | null;
}) {
  const { user, hydrated } = useAuth();
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [range, setRange] = useState<DateRange>(null);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [state, setState] = useState<FetchState>({ kind: 'idle' });
  const [pointsByActivity, setPointsByActivity] = useState<Record<string, SkillValues>>({});

  useEffect(() => {
    if (!hydrated) return;
    if (!user?.email) {
      setState({ kind: 'ok', events: [] });
      setPointsByActivity({});
      return;
    }

    const controller = new AbortController();
    setState({ kind: 'loading' });
    const target = viewingEmail && viewingEmail !== user.email ? viewingEmail : null;
    const userQS = target ? `?user=${encodeURIComponent(target)}` : '';

    Promise.all([
      fetch(`/api/profile/joined-activities${userQS}`, {
        headers: { 'x-auth-email': user.email },
        signal: controller.signal,
        cache: 'no-store',
      }).then(async (res) => {
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        return (await res.json()) as { events?: FilterableEvent[] };
      }),
      fetch(`/api/profile/skill-points-activities${userQS}`, {
        headers: { 'x-auth-email': user.email },
        signal: controller.signal,
        cache: 'no-store',
      })
        .then(async (res) => {
          if (!res.ok) return { items: [] };
          return (await res.json()) as {
            items?: { activityId: string; values: SkillValues }[];
          };
        })
        .catch(() => ({ items: [] })),
    ])
      .then(([joined, points]) => {
        if (controller.signal.aborted) return;
        setState({ kind: 'ok', events: joined.events ?? [] });
        const map: Record<string, SkillValues> = {};
        for (const item of points.items ?? []) {
          map[item.activityId] = item.values;
        }
        setPointsByActivity(map);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        const message =
          err instanceof Error ? err.message : 'Failed to load joined activities';
        setState({ kind: 'error', message });
      });

    return () => controller.abort();
  }, [hydrated, user?.email, viewingEmail]);

  const events = state.kind === 'ok' ? state.events : [];

  // When the user picks "All", keep both date inputs visible (and the row
  // height balanced against the type filter) by mirroring the actual data
  // span. Pass-through to `withinRange` still returns true for null.
  const dataSpan = useMemo<string | null>(() => {
    if (events.length === 0) return null;
    let min: string | null = null;
    let max: string | null = null;
    for (const e of events) {
      const d = e.date.slice(0, 10);
      if (!d || Number.isNaN(new Date(d).getTime())) continue;
      if (min === null || d < min) min = d;
      if (max === null || d > max) max = d;
    }
    if (!min || !max) return null;
    return `${min}|${max}`;
  }, [events]);
  const displayRange: DateRange = useMemo(() => {
    if (range) return range;
    if (!dataSpan) return null;
    const [start, end] = dataSpan.split('|');
    return { start, end };
  }, [range, dataSpan]);

  const filtered = useMemo<FilterableEvent[]>(() => {
    return events.filter((evt) => {
      if (category !== 'all' && evt.category !== category) return false;
      if (!withinRange(evt.date, range)) return false;
      return true;
    });
  }, [events, category, range]);

  const shown = filtered.slice(0, visible);
  const hasMore = filtered.length > visible;
  const isLoading = state.kind === 'loading' || state.kind === 'idle';

  return (
    <section className="bg-white rounded-2xl shadow-md p-6 lg:p-8">
      <header className="mb-6 flex items-center gap-3">
        <span className="profile-section-icon" aria-hidden="true">
          <CalendarIcon />
        </span>
        <div>
          <h2 className="font-serif text-2xl font-semibold text-hunter-green">
            Joined Activities
          </h2>
          <p className="text-sm text-dark-gray">
            Aktivitas yang sudah kamu daftar dan disetujui admin
          </p>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-3 sm:items-end">
        <div className="flex flex-col gap-2 sm:col-span-1">
          <label className="flex items-center gap-2 text-sm font-semibold text-graphite">
            <FilterIcon size={16} />
            Category
          </label>
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value as CategoryFilter);
              setVisible(PAGE_SIZE);
            }}
            className="rounded-lg border border-light-gray bg-white px-3 py-2 text-sm text-graphite focus:border-hunter-green focus:outline-none"
          >
            <option value="all">All Categories</option>
            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <DateRangeFilter
            value={displayRange}
            onChange={(next) => {
              setRange(next);
              setVisible(PAGE_SIZE);
            }}
          />
        </div>
      </div>

      <p className="mt-4 text-xs text-dark-gray">
        Menampilkan <span className="font-bold text-hunter-green">{shown.length}</span>{' '}
        dari <span className="font-bold text-hunter-green">{filtered.length}</span> aktivitas
      </p>

      <div className="mt-3 grid gap-3">
        {shown.map((evt) => {
          const points = pointsByActivity[evt.id];
          const total = points ? totalOf(points) : 0;
          return (
            <article
              key={evt.id}
              className={`event-history-item ${evt.type} flex flex-col gap-3 rounded-xl border border-light-gray bg-off-white p-4`}
            >
              <div className="flex items-stretch gap-4">
                <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-light-gray sm:h-28 sm:w-28">
                  {evt.photos && evt.photos.length > 0 ? (
                    <img
                      src={evt.photos[0]}
                      alt={evt.title}
                      className="absolute inset-0 h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-3xl" aria-hidden="true">
                      {evt.icon}
                    </div>
                  )}
                </div>

                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-serif text-base font-semibold text-hunter-green">
                      {evt.title}
                    </h3>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="rounded-full bg-white px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wider text-graphite border border-light-gray">
                        {evt.category ? CATEGORY_LABEL[evt.category] : TYPE_LABEL[evt.type] ?? evt.type}
                      </span>
                      {points && evt.category !== 'competitive' && (
                        <span className="rounded-full bg-hunter-green/10 px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wider text-hunter-green">
                          {total} pts
                        </span>
                      )}
                    </div>
                  </div>

                  {evt.description && (
                    <p
                      className="mt-1 text-xs text-dark-gray"
                      style={{
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {evt.description}
                    </p>
                  )}

                  {points && evt.category !== 'competitive' && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {SKILL_DISPLAY_ORDER.map((key) => (
                        <span
                          key={key}
                          className="rounded-md bg-white px-2 py-0.5 text-[0.65rem] font-semibold tabular-nums text-graphite border border-light-gray"
                        >
                          {SKILL_LABELS[key]} {points[key]}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-2 text-xs text-dark-gray">
                    <span className="inline-flex items-center gap-1">
                      <CalendarIcon size={12} />
                      {new Date(evt.date).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MapPinIcon size={12} />
                      {evt.location}
                    </span>
                    {typeof evt.eventRank === 'number' && (
                      <span className="inline-flex items-center gap-1 font-semibold text-paprika">
                        Rank #{evt.eventRank}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {evt.matches && evt.matches.length > 0 && (
                <div className="border-t border-light-gray pt-3">
                  <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-dark-gray">
                    <span className="inline-flex items-center gap-1.5 font-semibold uppercase tracking-wider text-hunter-green">
                      <UsersIcon size={14} />
                      Matches ({evt.matches.length})
                    </span>
                    {(() => {
                      const tally = { win: 0, loss: 0, draw: 0 };
                      for (const m of evt.matches) tally[m.result] += 1;
                      return (
                        <>
                          <span className="font-semibold text-hunter-green">
                            {tally.win}W
                          </span>
                          <span className="font-semibold text-paprika">
                            {tally.loss}L
                          </span>
                          {tally.draw > 0 && (
                            <span className="font-semibold text-dark-gray">
                              {tally.draw}D
                            </span>
                          )}
                        </>
                      );
                    })()}
                  </div>
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {evt.matches.map((match, idx) => (
                      <MatchScorecard
                        key={idx}
                        match={match}
                        index={idx}
                      />
                    ))}
                  </div>
                </div>
              )}
            </article>
          );
        })}

        {isLoading && (
          <div className="rounded-xl border border-dashed border-light-gray bg-off-white p-8 text-center text-sm text-dark-gray">
            Memuat aktivitas kamu…
          </div>
        )}

        {!isLoading && state.kind === 'error' && (
          <div className="rounded-xl border border-dashed border-paprika/40 bg-paprika/5 p-8 text-center text-sm text-paprika">
            Gagal memuat aktivitas: {state.message}
          </div>
        )}

        {!isLoading && state.kind === 'ok' && filtered.length === 0 && (
          <div className="rounded-xl border border-dashed border-light-gray bg-off-white p-8 text-center text-sm text-dark-gray">
            {events.length === 0
              ? 'Kamu belum bergabung di aktivitas manapun. Cek halaman utama untuk daftar program yang tersedia.'
              : 'Tidak ada aktivitas yang cocok dengan filter kamu.'}
          </div>
        )}
      </div>

      {hasMore && (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={() => setVisible((v) => v + PAGE_SIZE)}
            className="rounded-full border border-hunter-green px-5 py-2 text-sm font-semibold text-hunter-green transition-colors hover:bg-hunter-green hover:text-white"
          >
            Load more activities
          </button>
        </div>
      )}
    </section>
  );
}

