'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUp,
  ClockSmallIcon,
  MapPinIcon,
  PlusIcon,
  UsersSmallIcon,
  XIcon,
} from '@/components/ui/Icons';
import { useAuth } from '@/hooks/useAuth';
import { ActivitySkillPointsDrawer } from './ActivitySkillPointsDrawer';
import { ActivityPerformanceDrawer } from './ActivityPerformanceDrawer';
import { ActivityMatchesDrawer } from './ActivityMatchesDrawer';
import { ActivityStandingsDrawer } from './ActivityStandingsDrawer';
import { RowActionMenu } from './RowActionMenu';
import type {
  ActivityCategory,
  ActivityItem,
} from '@/data/activities-types';

type SaveStatus =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved'; at: number }
  | { kind: 'error'; message: string };

type DraftActivity = Omit<ActivityItem, 'id' | 'createdAt' | 'order'> & {
  id: string;
};

const CATEGORY_OPTIONS: Array<{ key: ActivityCategory; label: string }> = [
  { key: 'training', label: 'Training' },
  { key: 'social', label: 'Social Play' },
  { key: 'competitive', label: 'Competitive' },
];

const CATEGORY_TAG_STYLES: Record<ActivityCategory, string> = {
  training: 'bg-hunter-green/10 text-hunter-green',
  social: 'bg-teal/10 text-teal',
  competitive: 'bg-paprika/10 text-paprika',
};

const FIELD_LABEL_CLS = 'text-xs font-semibold uppercase tracking-wider text-dark-gray';
const INPUT_CLS =
  'w-full rounded-lg border border-light-gray bg-white px-3 py-2 text-sm focus:border-hunter-green focus:outline-none';

const NAV_LINK_CLS =
  'text-xs font-semibold uppercase tracking-wider text-dark-gray transition-colors hover:text-paprika';

function isPersistedId(id: string) {
  if (id.startsWith('draft-')) return false;
  return id.length > 24; // UUIDs from server
}

type Props = {
  initialActivities: ActivityItem[];
  pageSize: number;
};

export function ActivitiesListClient({ initialActivities, pageSize }: Props) {
  const { user } = useAuth();
  const [activities, setActivities] = useState<ActivityItem[]>(initialActivities);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<SaveStatus>({ kind: 'idle' });
  const [editing, setEditing] = useState<DraftActivity | null>(null);
  const [pointsActivity, setPointsActivity] = useState<ActivityItem | null>(null);
  const [recurringActivity, setRecurringActivity] = useState<ActivityItem | null>(
    null,
  );
  const [performanceActivity, setPerformanceActivity] =
    useState<ActivityItem | null>(null);
  const [matchesActivity, setMatchesActivity] = useState<ActivityItem | null>(null);
  const [standingsActivity, setStandingsActivity] = useState<ActivityItem | null>(null);
  const [filter, setFilter] = useState<ActivityCategory | 'all'>('all');
  const [archiveFilter, setArchiveFilter] = useState<'active' | 'archived' | 'all'>(
    'active',
  );
  const [signupCounts, setSignupCounts] = useState<Record<string, number>>({});

  const refreshSignupCounts = useCallback(async () => {
    try {
      const res = await fetch('/api/activity-signups/counts', {
        cache: 'no-store',
      });
      if (!res.ok) return;
      const body = (await res.json()) as { counts?: Record<string, number> };
      setSignupCounts(body.counts ?? {});
    } catch {
      // Non-fatal — admin list still works without counts.
    }
  }, []);

  useEffect(() => {
    refreshSignupCounts();
  }, [refreshSignupCounts]);

  const filtered = useMemo(() => {
    let out = activities;
    if (archiveFilter === 'active') {
      out = out.filter((a) => a.archived !== true);
    } else if (archiveFilter === 'archived') {
      out = out.filter((a) => a.archived === true);
    }
    if (filter !== 'all') {
      out = out.filter((a) => a.category === filter);
    }
    return out;
  }, [activities, filter, archiveFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const pageItems = filtered.slice(pageStart, pageStart + pageSize);

  const apiFetch = useCallback(
    async (
      kind: 'settings' | 'activity' | 'reorder' | 'delete',
      payload: Record<string, unknown>,
      method: 'PUT' | 'DELETE' = 'PUT',
    ) => {
      const res = await fetch('/api/activities', {
        method,
        headers: {
          'content-type': 'application/json',
          'x-auth-email': user?.email ?? '',
        },
        body: JSON.stringify({ kind, ...payload }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      return res.json();
    },
    [user?.email],
  );

  const handleSave = async (draft: DraftActivity) => {
    setStatus({ kind: 'saving' });
    try {
      const payload = {
        category: draft.category,
        title: draft.title.trim(),
        description: draft.description,
        image: draft.image,
        duration: draft.duration,
        groupSize: draft.groupSize,
        location: draft.location,
        time: draft.time,
        isFull: draft.isFull === true,
        archived: draft.archived === true,
      };

      if (!isPersistedId(draft.id)) {
        const result = await apiFetch('activity', { activity: payload });
        const persisted = (result as { activity?: ActivityItem }).activity;
        if (persisted) {
          setActivities((prev) => [...prev, persisted]);
        }
      } else {
        await apiFetch('activity', {
          activity: { id: draft.id, ...payload },
        });
        setActivities((prev) =>
          prev.map((a) => (a.id === draft.id ? { ...a, ...payload } : a)),
        );
      }

      setEditing(null);
      setStatus({ kind: 'saved', at: Date.now() });
      refreshSignupCounts();
    } catch (e) {
      setStatus({
        kind: 'error',
        message: e instanceof Error ? e.message : 'Failed to save',
      });
    }
  };

  const handleClone = async (item: ActivityItem) => {
    setStatus({ kind: 'saving' });
    try {
      const payload = {
        category: item.category,
        title: `${item.title} (copy)`,
        description: item.description,
        image: item.image,
        duration: item.duration,
        groupSize: item.groupSize,
        location: item.location,
        time: item.time,
        isFull: false,
        archived: false,
      };
      const result = await apiFetch('activity', { activity: payload });
      const persisted = (result as { activity?: ActivityItem }).activity;
      if (persisted) {
        setActivities((prev) => [...prev, persisted]);
        // Pop the edit drawer on the freshly persisted clone so the admin
        // can tweak the title and any other field before moving on.
        setEditing({ ...persisted });
      }
      setStatus({ kind: 'saved', at: Date.now() });
      refreshSignupCounts();
    } catch (e) {
      setStatus({
        kind: 'error',
        message: e instanceof Error ? e.message : 'Failed to clone',
      });
    }
  };

  // Per-row archive/restore. The full update body is required by the API
  // (we spread the existing row and only flip `archived`) so the row's
  // other fields aren't wiped to empty strings on the sheet.
  const handleArchiveToggle = async (item: ActivityItem) => {
    const nextArchived = !(item.archived === true);
    const confirmMsg = nextArchived
      ? `Archive activity "${item.title}"? Activity ini tidak akan tampil di home page.`
      : `Restore activity "${item.title}"? Activity ini akan tampil lagi di home page.`;
    if (!window.confirm(confirmMsg)) return;
    setStatus({ kind: 'saving' });
    try {
      await apiFetch('activity', {
        activity: {
          id: item.id,
          category: item.category,
          title: item.title,
          description: item.description,
          image: item.image,
          duration: item.duration,
          groupSize: item.groupSize,
          location: item.location,
          time: item.time,
          isFull: item.isFull === true,
          archived: nextArchived,
        },
      });
      setActivities((prev) =>
        prev.map((a) => (a.id === item.id ? { ...a, archived: nextArchived } : a)),
      );
      setStatus({ kind: 'saved', at: Date.now() });
    } catch (e) {
      setStatus({
        kind: 'error',
        message:
          e instanceof Error ? e.message : 'Failed to update archive state',
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus activity ini?')) return;
    setStatus({ kind: 'saving' });
    try {
      if (isPersistedId(id)) {
        await apiFetch('delete', { id }, 'DELETE');
      }
      const next = activities
        .filter((a) => a.id !== id)
        .map((a, i) => ({ ...a, order: i }));
      setActivities(next);
      // Renumber remaining persisted rows so order column stays consistent.
      const ids = next.filter((a) => isPersistedId(a.id)).map((a) => a.id);
      if (ids.length > 0) {
        await apiFetch('reorder', { ids });
      }
      setStatus({ kind: 'saved', at: Date.now() });
      refreshSignupCounts();
    } catch (e) {
      setStatus({
        kind: 'error',
        message: e instanceof Error ? e.message : 'Failed to delete',
      });
    }
  };

  const handleMove = async (id: string, dir: -1 | 1) => {
    const idx = activities.findIndex((a) => a.id === id);
    if (idx < 0) return;
    const target = idx + dir;
    if (target < 0 || target >= activities.length) return;
    const next = activities.slice();
    const [moved] = next.splice(idx, 1);
    next.splice(target, 0, moved);
    const renumbered = next.map((a, i) => ({ ...a, order: i }));
    setActivities(renumbered);

    const ids = renumbered
      .filter((a) => isPersistedId(a.id))
      .map((a) => a.id);
    if (ids.length > 0) {
      try {
        await apiFetch('reorder', { ids });
      } catch {
        // Best-effort reorder; UI already updated optimistically.
      }
    }
  };

  // Duplicate one activity N times, each copy exactly 1 week later than the
  // previous — keeps weekday and time-of-day identical. Runs sequentially so
  // the server's `order = existing.length` assigns distinct positions.
  const handleDuplicateRecurring = async (
    item: ActivityItem,
    weeks: number,
  ) => {
    setRecurringActivity(null);
    setStatus({ kind: 'saving' });
    const created: ActivityItem[] = [];
    try {
      const base = new Date(item.time);
      if (Number.isNaN(base.getTime())) {
        throw new Error('Activity has no valid date — set the Time first');
      }
      for (let i = 1; i <= weeks; i++) {
        const next = new Date(base.getTime() + i * 7 * 24 * 60 * 60 * 1000);
        // datetime-local format: YYYY-MM-DDTHH:mm (no seconds/timezone)
        const time = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}T${String(next.getHours()).padStart(2, '0')}:${String(next.getMinutes()).padStart(2, '0')}`;
        const payload = {
          category: item.category,
          title: item.title,
          description: item.description,
          image: item.image,
          duration: item.duration,
          groupSize: item.groupSize,
          location: item.location,
          time,
          isFull: false,
          archived: false,
        };
        const result = await apiFetch('activity', { activity: payload });
        const persisted = (result as { activity?: ActivityItem }).activity;
        if (persisted) created.push(persisted);
      }
      if (created.length > 0) {
        setActivities((prev) => [...prev, ...created]);
      }
      setStatus({ kind: 'saved', at: Date.now() });
      refreshSignupCounts();
    } catch (e) {
      if (created.length > 0) {
        setActivities((prev) => [...prev, ...created]);
      }
      setStatus({
        kind: 'error',
        message:
          e instanceof Error
            ? `${e.message} (${created.length}/${weeks} dibuat)`
            : 'Failed to duplicate',
      });
    }
  };

  const openCreate = () => {
    setEditing({
      id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      category: 'training',
      title: '',
      description: '',
      image: '',
      duration: '',
      groupSize: '',
      location: '',
      time: '',
      isFull: false,
      archived: false,
    });
  };

  // datetime-local needs YYYY-MM-DDTHH:mm; legacy free-text values
  // ("Saturdays 09:00") render as empty and would be silently wiped on
  // save, so drop them only when editing that row.
  const toDatetimeLocal = (raw: string) =>
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(raw) ? raw : '';

  const openEdit = (item: ActivityItem) => {
    setEditing({ ...item, time: toDatetimeLocal(item.time) });
  };

  return (
    <div className="container-base section-padding">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-paprika">
            Admin
          </p>
          <h1 className="font-serif text-3xl font-bold text-hunter-green">
            Activities List
          </h1>
          <p className="mt-1 text-sm text-dark-gray">
            Kelola seluruh activity ({activities.length} total). 6 teratas
            ditampilkan di home page.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            <Link href="/admin/hero" className={NAV_LINK_CLS}>Hero</Link>
            <Link href="/admin/our-story" className={NAV_LINK_CLS}>Our Story</Link>
            <Link href="/admin/why-join" className={NAV_LINK_CLS}>Why Join</Link>
            <Link href="/admin/activities" className={NAV_LINK_CLS}>
              Activities Heading
            </Link>
            <Link href="/admin/calendar" className={NAV_LINK_CLS}>Calendar</Link>
          </div>
          <SaveBadge status={status} />
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 rounded-full bg-paprika px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-paprika-hover"
          >
            <PlusIcon size={14} />
            Tambah activity
          </button>
        </div>
      </header>

      <section className="rounded-2xl border border-light-gray bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-light-gray px-5 py-3">
          <div className="flex flex-wrap gap-2">
            {(['active', 'archived', 'all'] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setArchiveFilter(key);
                  setPage(1);
                }}
                className={[
                  'rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors',
                  archiveFilter === key
                    ? 'bg-paprika text-white'
                    : 'bg-off-white text-dark-gray hover:bg-light-gray',
                ].join(' ')}
              >
                {key === 'active'
                  ? `Active (${activities.filter((a) => a.archived !== true).length
                  })`
                  : key === 'archived'
                    ? `Archived (${activities.filter((a) => a.archived === true).length
                    })`
                    : `All (${activities.length})`}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-light-gray px-5 py-3">
          <div className="flex flex-wrap gap-2">
            {(['all', 'training', 'social', 'competitive'] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setFilter(key);
                  setPage(1);
                }}
                className={[
                  'rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors',
                  filter === key
                    ? 'bg-hunter-green text-white'
                    : 'bg-off-white text-dark-gray hover:bg-light-gray',
                ].join(' ')}
              >
                {key === 'all'
                  ? `All (${activities.length})`
                  : `${key} (${activities.filter((a) => a.category === key).length
                  })`}
              </button>
            ))}
          </div>
          <p className="text-xs text-dark-gray">
            Halaman {safePage} dari {totalPages}
          </p>
        </div>

        <div className="divide-y divide-light-gray">
          {pageItems.length === 0 && (
            <div className="px-5 py-12 text-center text-sm text-dark-gray">
              Belum ada activity untuk filter ini.
            </div>
          )}
          {pageItems.map((activity) => {
            const realIndex = activities.findIndex((a) => a.id === activity.id);
            const canUp = realIndex > 0;
            const canDown = realIndex >= 0 && realIndex < activities.length - 1;
            const isCompetitive = activity.category === 'competitive';
            const isPersisted = isPersistedId(activity.id);
            return (
              <article
                key={activity.id}
                className="flex items-start gap-4 px-5 py-4"
              >
                <div className="relative h-20 w-28 flex-shrink-0 overflow-hidden rounded-lg border border-light-gray bg-off-white">
                  {activity.image ? (
                    <Image
                      src={activity.image}
                      alt={activity.title}
                      fill
                      sizes="112px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-dark-gray">
                      No image
                    </div>
                  )}
                </div>

                <div className="flex flex-1 flex-col gap-2 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-serif text-base font-semibold text-hunter-green truncate">
                      {activity.title || '(tanpa judul)'}
                    </h3>
                    <span
                      className={[
                        'px-2 py-0.5 rounded-full text-[0.65rem] font-semibold uppercase tracking-wider',
                        CATEGORY_TAG_STYLES[activity.category],
                      ].join(' ')}
                    >
                      {activity.category}
                    </span>
                    {activity.isFull && (
                      <span className="px-2 py-0.5 rounded-full text-[0.65rem] font-semibold uppercase tracking-wider bg-light-gray text-dark-gray">
                        Full
                      </span>
                    )}
                    {activity.archived && (
                      <span className="px-2 py-0.5 rounded-full text-[0.65rem] font-semibold uppercase tracking-wider bg-paprika/10 text-paprika">
                        Archived
                      </span>
                    )}
                  </div>

                  {activity.description && (
                    <p className="text-xs text-dark-gray line-clamp-2 text-pretty">
                      {activity.description}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[0.7rem] text-dark-gray">
                    {activity.duration && (
                      <span className="inline-flex items-center gap-1">
                        <ClockSmallIcon />
                        {activity.duration}
                      </span>
                    )}
                    {activity.time && (
                      <span className="inline-flex items-center gap-1">
                        <ClockSmallIcon />
                        {activity.time}
                      </span>
                    )}
                    {activity.location && (
                      <span className="inline-flex items-center gap-1">
                        <MapPinIcon />
                        {activity.location}
                      </span>
                    )}
                    {activity.groupSize && (
                      <span className="inline-flex items-center gap-1">
                        <UsersSmallIcon />
                        {activity.groupSize}
                      </span>
                    )}
                  </div>

                  {isPersisted && (
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <Link
                        href={`/admin/activity-signups?activity=${encodeURIComponent(activity.id)}`}
                        className="inline-flex items-center gap-1.5 rounded-full bg-hunter-green px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-wider text-white transition-colors hover:bg-hunter-green/90"
                        title="Lihat pendaftar activity ini"
                      >
                        <UsersSmallIcon size={11} />
                        {signupCounts[activity.id] ?? 0} members
                      </Link>
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-center justify-between self-stretch gap-1">
                  <button
                    type="button"
                    onClick={() => handleMove(activity.id, -1)}
                    disabled={!canUp}
                    aria-label="Move up"
                    className="rounded-md p-1 text-dark-gray transition-colors hover:bg-hunter-green/10 hover:text-hunter-green disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-dark-gray"
                  >
                    <ChevronUp size={16} className="rotate-180" />
                  </button>
                  <span className="text-[0.65rem] font-bold uppercase tracking-wider text-dark-gray">
                    #{realIndex + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleMove(activity.id, 1)}
                    disabled={!canDown}
                    aria-label="Move down"
                    className="rounded-md p-1 text-dark-gray transition-colors hover:bg-hunter-green/10 hover:text-hunter-green disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-dark-gray"
                  >
                    <ChevronUp size={16} />
                  </button>
                </div>

                <div className="flex flex-col items-end gap-1.5">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => openEdit(activity)}
                      className="inline-flex items-center justify-center rounded-full bg-hunter-green px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-hunter-green/90"
                    >
                      Edit
                    </button>
                    {isPersisted && (
                      <RowActionMenu
                        label={`More actions for ${activity.title}`}
                        items={[
                         ...(!isCompetitive ? [{
                            key: 'points',
                            label: 'Set Skill Points',
                            onSelect: () => setPointsActivity(activity),
                          },
                          {
                            key: 'performance',
                            label: 'Set Performance',
                            onSelect: () => setPerformanceActivity(activity),
                          }] : []),
                          ...(isCompetitive
                            ? [
                              {
                                key: 'matches',
                                label: 'Matches',
                                onSelect: () => setMatchesActivity(activity),
                              },
                              {
                                key: 'standings',
                                label: 'Standings',
                                onSelect: () => setStandingsActivity(activity),
                              },
                            ]
                            : []),
                          { kind: 'divider', key: 'sep-1' },
                          {
                            key: 'clone',
                            label: 'Clone',
                            onSelect: () => handleClone(activity),
                            disabled: status.kind === 'saving',
                          },
                          {
                            key: 'recurring',
                            label: 'Duplicate weekly…',
                            onSelect: () => setRecurringActivity(activity),
                            disabled:
                              status.kind === 'saving' ||
                              Number.isNaN(new Date(activity.time).getTime()),
                          },
                          {
                            key: 'archive',
                            label: activity.archived ? 'Restore' : 'Archive',
                            onSelect: () => handleArchiveToggle(activity),
                            disabled: status.kind === 'saving',
                          },
                          { kind: 'divider', key: 'sep-2' },
                          {
                            key: 'delete',
                            label: 'Hapus',
                            onSelect: () => handleDelete(activity.id),
                            destructive: true,
                          },
                        ]}
                      />
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-3 border-t border-light-gray px-5 py-3">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="inline-flex items-center gap-1 rounded-full border border-light-gray px-3 py-1.5 text-xs font-semibold text-dark-gray transition-colors hover:border-hunter-green hover:text-hunter-green disabled:opacity-40 disabled:hover:border-light-gray disabled:hover:text-dark-gray"
            >
              <ChevronLeftIcon size={14} />
              Sebelumnya
            </button>
            <div className="flex flex-wrap gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p)}
                  className={[
                    'h-8 min-w-8 rounded-md px-2 text-xs font-semibold transition-colors',
                    p === safePage
                      ? 'bg-hunter-green text-white'
                      : 'bg-off-white text-dark-gray hover:bg-light-gray',
                  ].join(' ')}
                >
                  {p}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="inline-flex items-center gap-1 rounded-full border border-light-gray px-3 py-1.5 text-xs font-semibold text-dark-gray transition-colors hover:border-hunter-green hover:text-hunter-green disabled:opacity-40 disabled:hover:border-light-gray disabled:hover:text-dark-gray"
            >
              Berikutnya
              <ChevronRightIcon size={14} />
            </button>
          </div>
        )}
      </section>

      {editing && (
        <EditDrawer
          draft={editing}
          onCancel={() => setEditing(null)}
          onSave={handleSave}
        />
      )}

      {pointsActivity && (
        <ActivitySkillPointsDrawer
          activityId={pointsActivity.id}
          activityTitle={pointsActivity.title}
          onClose={() => setPointsActivity(null)}
        />
      )}
      {recurringActivity && (
        <RecurringDuplicateDrawer
          activity={recurringActivity}
          onClose={() => setRecurringActivity(null)}
          onSubmit={(weeks) =>
            handleDuplicateRecurring(recurringActivity, weeks)
          }
        />
      )}
      {performanceActivity && (
        <ActivityPerformanceDrawer
          activityId={performanceActivity.id}
          activityTitle={performanceActivity.title}
          onClose={() => setPerformanceActivity(null)}
        />
      )}
      {matchesActivity && (
        <ActivityMatchesDrawer
          activityId={matchesActivity.id}
          activityTitle={matchesActivity.title}
          onClose={() => setMatchesActivity(null)}
          onSaved={() => {
            setMatchesActivity(null);
          }}
        />
      )}
      {standingsActivity && (
        <ActivityStandingsDrawer
          activityId={standingsActivity.id}
          activityTitle={standingsActivity.title}
          onClose={() => setStandingsActivity(null)}
        />
      )}
    </div>
  );
}

type EditDrawerProps = {
  draft: DraftActivity;
  onCancel: () => void;
  onSave: (draft: DraftActivity) => void | Promise<void>;
};

function EditDrawer({ draft, onCancel, onSave }: EditDrawerProps) {
  const [state, setState] = useState<DraftActivity>(draft);
  const [saving, setSaving] = useState(false);

  const update = <K extends keyof DraftActivity>(key: K, value: DraftActivity[K]) => {
    setState((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (state.title.trim().length === 0) return;
    setSaving(true);
    try {
      await onSave(state);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-graphite/40 sm:items-center sm:p-6"
      onClick={onCancel}
    >
      <form
        className="w-full max-w-2xl rounded-t-2xl bg-white p-6 shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-xl font-semibold text-hunter-green">
            {isPersistedId(state.id) ? 'Edit activity' : 'Tambah activity'}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close"
            className="rounded-md p-1.5 text-dark-gray transition-colors hover:bg-light-gray"
          >
            <XIcon size={20} />
          </button>
        </div>

        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <label className="flex flex-col gap-1">
              <span className={FIELD_LABEL_CLS}>Judul</span>
              <input
                type="text"
                value={state.title}
                onChange={(e) => update('title', e.target.value)}
                placeholder="Judul activity"
                className={INPUT_CLS}
                required
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className={FIELD_LABEL_CLS}>Category</span>
              <select
                value={state.category}
                onChange={(e) =>
                  update('category', e.target.value as ActivityCategory)
                }
                className={`${INPUT_CLS} w-auto ${CATEGORY_TAG_STYLES[state.category]}`}
              >
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.key} value={opt.key}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="flex flex-col gap-1">
            <span className={FIELD_LABEL_CLS}>Deskripsi</span>
            <textarea
              rows={3}
              value={state.description}
              onChange={(e) => update('description', e.target.value)}
              placeholder="Deskripsi singkat"
              className={INPUT_CLS}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className={FIELD_LABEL_CLS}>Image URL</span>
            <input
              type="url"
              value={state.image}
              onChange={(e) => update('image', e.target.value)}
              placeholder="https://images.unsplash.com/..."
              className={INPUT_CLS}
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className={FIELD_LABEL_CLS}>Duration</span>
              <input
                type="text"
                value={state.duration}
                onChange={(e) => update('duration', e.target.value)}
                placeholder="e.g. 90 min"
                className={INPUT_CLS}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className={FIELD_LABEL_CLS}>Group size</span>
              <input
                type="text"
                value={state.groupSize}
                onChange={(e) => update('groupSize', e.target.value)}
                placeholder="e.g. 4-6 players"
                className={INPUT_CLS}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className={FIELD_LABEL_CLS}>Location</span>
              <input
                type="text"
                value={state.location}
                onChange={(e) => update('location', e.target.value)}
                placeholder="e.g. Senayan Sports Club"
                className={INPUT_CLS}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className={FIELD_LABEL_CLS}>Time</span>
              <input
                type="datetime-local"
                value={state.time}
                onChange={(e) => update('time', e.target.value)}
                className={INPUT_CLS}
              />
            </label>
          </div>

          <label className="mt-1 flex items-center gap-3 rounded-lg border border-light-gray bg-off-white px-3 py-2.5">
            <input
              type="checkbox"
              checked={state.isFull === true}
              onChange={(e) => update('isFull', e.target.checked)}
              className="h-4 w-4 cursor-pointer rounded border-light-gray text-paprika focus:ring-paprika"
            />
            <span className="flex flex-col">
              <span className="text-xs font-semibold uppercase tracking-wider text-dark-gray">
                Tandai Full Book
              </span>
              <span className="text-[0.7rem] text-dark-gray">
                Tombol Join di home page berubah menjadi &quot;Full Book&quot; (abu-abu, tidak bisa diklik).
              </span>
            </span>
          </label>

          <label className="mt-1 flex items-center gap-3 rounded-lg border border-light-gray bg-off-white px-3 py-2.5">
            <input
              type="checkbox"
              checked={state.archived === true}
              onChange={(e) => update('archived', e.target.checked)}
              className="h-4 w-4 cursor-pointer rounded border-light-gray text-paprika focus:ring-paprika"
            />
            <span className="flex flex-col">
              <span className="text-xs font-semibold uppercase tracking-wider text-dark-gray">
                Archive activity
              </span>
              <span className="text-[0.7rem] text-dark-gray">
                Tidak tampil di home page. Bisa di-restore kapan saja dari halaman ini.
              </span>
            </span>
          </label>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-light-gray px-4 py-2 text-sm font-semibold text-dark-gray transition-colors hover:border-dark-gray"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={saving || state.title.trim().length === 0}
            className="rounded-full bg-paprika px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-paprika-hover disabled:opacity-50"
          >
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </form>
    </div>
  );
}

function RecurringDuplicateDrawer({
  activity,
  onClose,
  onSubmit,
}: {
  activity: ActivityItem;
  onClose: () => void;
  onSubmit: (weeks: number) => void;
}) {
  const [weeks, setWeeks] = useState(4);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const base = new Date(activity.time);
  const valid = !Number.isNaN(base.getTime());
  const preview = valid
    ? Array.from(
        { length: Math.min(weeks, 8) },
        (_, i) =>
          new Date(base.getTime() + (i + 1) * 7 * 24 * 60 * 60 * 1000),
      )
    : [];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirming) {
      setConfirming(true);
      return;
    }
    onSubmit(weeks);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-graphite/40 sm:items-center sm:p-6"
      onClick={onClose}
    >
      <form
        className="w-full max-w-md rounded-t-2xl bg-white p-6 shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-xl font-semibold text-hunter-green">
            Duplicate weekly
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1.5 text-dark-gray transition-colors hover:bg-light-gray"
          >
            <XIcon size={20} />
          </button>
        </div>

        <p className="mb-4 text-sm text-dark-gray">
          Membuat <strong>{weeks}</strong> salinan &quot;{activity.title}&quot;
          dengan tanggal sama setiap minggu (hari &amp; jam identik).
        </p>

        <label className="mb-4 flex flex-col gap-1">
          <span className={FIELD_LABEL_CLS}>Jumlah minggu</span>
          <input
            type="number"
            min={1}
            max={52}
            value={weeks}
            onChange={(e) => {
              setWeeks(Math.max(1, Math.min(52, Number(e.target.value) || 1)));
              setConfirming(false);
            }}
            className={INPUT_CLS}
            required
          />
        </label>

        {preview.length > 0 && (
          <div className="mb-4 rounded-lg border border-light-gray bg-off-white px-3 py-2">
            <p className={FIELD_LABEL_CLS}>Contoh tanggal</p>
            <ul className="mt-1 flex flex-col gap-0.5 text-xs text-dark-gray">
              {preview.map((d) => (
                <li key={d.toISOString()}>
                  {d.toLocaleString('en-GB', {
                    weekday: 'long',
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                  })}
                  {weeks > 8 && d === preview[preview.length - 1]
                    ? ' …'
                    : ''}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex items-center justify-end gap-3">
          {confirming ? (
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="rounded-full border border-light-gray px-4 py-2 text-sm font-semibold text-dark-gray transition-colors hover:border-dark-gray"
            >
              Batal
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-light-gray px-4 py-2 text-sm font-semibold text-dark-gray transition-colors hover:border-dark-gray"
            >
              Batal
            </button>
          )}
          <button
            type="submit"
            className="rounded-full bg-paprika px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-paprika-hover"
          >
            {confirming ? `Ya, buat ${weeks} salinan` : 'Lanjut'}
          </button>
        </div>
      </form>
    </div>
  );
}

function SaveBadge({ status }: { status: SaveStatus }) {
  if (status.kind === 'idle') {
    return (
      <span className="text-xs text-dark-gray">Belum ada perubahan disimpan</span>
    );
  }
  if (status.kind === 'saving') {
    return <span className="text-xs text-dark-gray">Menyimpan...</span>;
  }
  if (status.kind === 'saved') {
    return (
      <span className="rounded-full bg-hunter-green/10 px-3 py-1 text-xs font-semibold text-hunter-green">
        Tersimpan
      </span>
    );
  }
  return (
    <span className="rounded-full bg-paprika/10 px-3 py-1 text-xs font-semibold text-paprika">
      {status.message}
    </span>
  );
}
