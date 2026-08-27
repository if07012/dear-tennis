'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useCallback, useMemo, useState } from 'react';
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
  const [filter, setFilter] = useState<ActivityCategory | 'all'>('all');

  const filtered = useMemo(
    () =>
      filter === 'all'
        ? activities
        : activities.filter((a) => a.category === filter),
    [activities, filter],
  );

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
    } catch (e) {
      setStatus({
        kind: 'error',
        message: e instanceof Error ? e.message : 'Failed to save',
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
    });
  };

  const openEdit = (item: ActivityItem) => {
    setEditing({ ...item });
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
                  : `${key} (${
                      activities.filter((a) => a.category === key).length
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

                <div className="flex flex-1 flex-col gap-1 min-w-0">
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
                </div>

                <div className="flex flex-col items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleMove(activity.id, -1)}
                    disabled={!canUp}
                    aria-label="Move up"
                    className="rounded-md p-1.5 text-dark-gray transition-colors hover:bg-hunter-green/10 hover:text-hunter-green disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-dark-gray"
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
                    className="rounded-md p-1.5 text-dark-gray transition-colors hover:bg-hunter-green/10 hover:text-hunter-green disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-dark-gray"
                  >
                    <ChevronUp size={16} />
                  </button>
                </div>

                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => openEdit(activity)}
                    className="rounded-md px-3 py-1 text-xs font-semibold text-hunter-green transition-colors hover:bg-hunter-green/10"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(activity.id)}
                    className="rounded-md px-3 py-1 text-xs font-semibold text-paprika transition-colors hover:bg-paprika/10"
                  >
                    Hapus
                  </button>
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
                type="text"
                value={state.time}
                onChange={(e) => update('time', e.target.value)}
                placeholder="e.g. Saturdays 09:00"
                className={INPUT_CLS}
              />
            </label>
          </div>
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
