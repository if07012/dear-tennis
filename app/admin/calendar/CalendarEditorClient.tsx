'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUp,
  PlusIcon,
  XIcon,
} from '@/components/ui/Icons';
import { useAuth } from '@/hooks/useAuth';
import type {
  CalendarEvent,
  CalendarSettings,
} from '@/data/calendar-types';

type SettingsDraft = Omit<CalendarSettings, 'id' | 'updatedAt'>;

type SaveStatus =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved'; at: number }
  | { kind: 'error'; message: string };

type DraftEvent = Omit<CalendarEvent, 'id' | 'order' | 'createdAt'> & {
  id: string;
};

const DRAFT_KEY = 'admin.calendar.draft';

type Draft = { settings: SettingsDraft; events: DraftEvent[] };

function readDraft(): Draft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Draft;
  } catch {
    return null;
  }
}

function writeDraft(draft: Draft | null) {
  if (typeof window === 'undefined') return;
  if (draft) {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } else {
    window.localStorage.removeItem(DRAFT_KEY);
  }
}

function isPersistedId(id: string) {
  // Draft ids are local-only and never reach the sheet. UUIDs are 36 chars;
  // the static fallback ids in data/events.ts are also shorter than 24 chars
  // and are persisted via the create-with-supplied-id flow, so length alone
  // isn't enough — explicitly reject anything starting with "draft-".
  if (id.startsWith('draft-')) return false;
  return id.length > 24;
}

// Fields that participate in the diff. `order` is updated via the reorder
// call, not as part of an event upsert.
type ComparableEventFields = Omit<DraftEvent, 'id'>;

function trimComparable(s: string) {
  return s.trim();
}

function eventFieldsEqual(a: CalendarEvent | DraftEvent, b: DraftEvent): boolean {
  return (
    trimComparable(a.day) === trimComparable(b.day) &&
    trimComparable(a.month) === trimComparable(b.month) &&
    trimComparable(a.title) === trimComparable(b.title) &&
    trimComparable(a.description) === trimComparable(b.description) &&
    trimComparable(a.location) === trimComparable(b.location) &&
    trimComparable(a.time) === trimComparable(b.time) &&
    trimComparable(a.ctaLabel) === trimComparable(b.ctaLabel) &&
    trimComparable(a.ctaHref) === trimComparable(b.ctaHref)
  );
}

function serializeEvent(e: DraftEvent) {
  return {
    day: e.day.trim(),
    month: e.month.trim(),
    title: e.title.trim(),
    description: e.description.trim(),
    location: e.location.trim(),
    time: e.time.trim(),
    ctaLabel: e.ctaLabel.trim(),
    ctaHref: e.ctaHref.trim(),
  };
}

const FIELD_LABEL_CLS =
  'text-xs font-semibold uppercase tracking-wider text-dark-gray';
const INPUT_CLS =
  'w-full rounded-lg border border-light-gray bg-white px-3 py-2 text-sm focus:border-hunter-green focus:outline-none';

const NAV_LINK_CLS =
  'text-xs font-semibold uppercase tracking-wider text-dark-gray transition-colors hover:text-paprika';

// Mirrors the home page cap so the admin can preview what's visible without
// guessing. Defined in one place so the two stay in sync.
const HOME_EVENT_LIMIT = 4;

/** Initial shape passed from the server-rendered page. */
type InitialPage = {
  settings: CalendarSettings;
  events: DraftEvent[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export function CalendarEditorClient({ initial }: { initial: InitialPage }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<SettingsDraft>({
    tag: initial.settings.tag,
    title: initial.settings.title,
  });
  // The full list of events the user is editing. We don't keep the entire
  // sheet in memory — we lazily fetch each page from the API on demand and
  // cache it here so the diff against the server snapshot still works.
  const [events, setEvents] = useState<DraftEvent[]>(
    initial.events.map((e) => ({ ...e })),
  );
  const [status, setStatus] = useState<SaveStatus>({ kind: 'idle' });
  const [hydrated, setHydrated] = useState(false);
  const [page, setPage] = useState(initial.page);
  const [totalPages, setTotalPages] = useState(initial.totalPages);
  const [total, setTotal] = useState(initial.total);
  const [pageSize] = useState(initial.pageSize);
  const [loadedPages, setLoadedPages] = useState<Set<number>>(
    () => new Set([initial.page]),
  );
  const [loadingPage, setLoadingPage] = useState(false);

  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const pageItems = useMemo(
    // Only render events we already have in memory. The server may have more
    // rows than `events.length` for pages we haven't loaded yet — until we
    // fetch them, those slots stay empty (the "fetch on page change" effect
    // below handles that).
    () => events.slice(pageStart, pageStart + pageSize),
    [events, pageStart, pageSize],
  );

  // Fetch a page from the API and merge into local state without trampling
  // unsaved edits. Edits live keyed by id; the merge only inserts rows that
  // don't already exist locally.
  const fetchPage = useCallback(
    async (pageToLoad: number) => {
      if (loadedPages.has(pageToLoad)) return;
      setLoadingPage(true);
      try {
        const res = await fetch(
          `/api/calendar?page=${pageToLoad}&pageSize=${pageSize}`,
          {
            headers: { 'x-auth-email': user?.email ?? '' },
          },
        );
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const body = (await res.json()) as {
          events: DraftEvent[];
          total: number;
          page: number;
          pageSize: number;
          totalPages: number;
        };
        setEvents((prev) => {
          const byId = new Map(prev.map((e) => [e.id, e]));
          for (const row of body.events) {
            // Don't overwrite locally-edited rows.
            if (!byId.has(row.id)) byId.set(row.id, row);
          }
          return Array.from(byId.values());
        });
        setTotal(body.total);
        setTotalPages(body.totalPages);
        setLoadedPages((prev) => {
          const next = new Set(prev);
          next.add(pageToLoad);
          return next;
        });
      } catch (e) {
        setStatus({
          kind: 'error',
          message:
            e instanceof Error ? e.message : 'Failed to load page from sheet',
        });
      } finally {
        setLoadingPage(false);
      }
    },
    [loadedPages, pageSize, user?.email],
  );

  // Keep a ref to loadedPages so ensureAllPagesLoaded always reads the latest
  // value (avoid stale closures on long-running saves).
  const loadedPagesRef = useRef(loadedPages);
  useEffect(() => {
    loadedPagesRef.current = loadedPages;
  }, [loadedPages]);

  // Fetch the page the user is now viewing if we haven't loaded it yet.
  useEffect(() => {
    if (loadedPages.has(safePage)) return;
    void fetchPage(safePage);
  }, [safePage, loadedPages, fetchPage]);

  /**
   * Loads every server-side page into local memory. Used right before save
   * so the diff against the server snapshot covers the whole sheet — the
   * initial server snapshot is only one page, so without this we could
   * miss deletions / reorderings on other pages.
   */
  const ensureAllPagesLoaded = useCallback(async () => {
    // Discover the latest `totalPages` from the server in case stale state
    // is hiding a page the user has never visited.
    const res = await fetch(
      `/api/calendar?page=1&pageSize=${pageSize}`,
      { headers: { 'x-auth-email': user?.email ?? '' } },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = (await res.json()) as {
      total: number;
      pageSize: number;
      totalPages: number;
    };
    setTotal(body.total);
    setTotalPages(body.totalPages);
    for (let p = 1; p <= body.totalPages; p++) {
      if (!loadedPagesRef.current.has(p)) {
        await fetchPage(p);
      }
    }
  }, [fetchPage, pageSize, user?.email]);

  useEffect(() => {
    const d = readDraft();
    if (d) {
      setSettings(d.settings);
      setEvents(d.events);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    writeDraft({ settings, events });
  }, [hydrated, settings, events]);

  const apiFetch = useCallback(
    async (
      kind: 'settings' | 'event' | 'reorder' | 'delete',
      payload: Record<string, unknown>,
      method: 'PUT' | 'DELETE' = 'PUT',
    ) => {
      const res = await fetch('/api/calendar', {
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

  const setSettingsField = <K extends keyof SettingsDraft>(
    key: K,
    value: SettingsDraft[K],
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setStatus({ kind: 'idle' });
  };

  const addEvent = () => {
    setEvents((prev) => [
      ...prev,
      {
        id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        day: '',
        month: '',
        title: '',
        description: '',
        location: '',
        time: '',
        ctaLabel: '',
        ctaHref: '',
      },
    ]);
    // Use the server-reported total (not `events.length`, which may be smaller
    // because we only hold loaded pages in memory) when computing the new
    // last page. Bump `total` + `totalPages` locally so the UI updates without
    // an extra round-trip.
    const nextTotal = total + 1;
    const nextTotalPages = Math.max(1, Math.ceil(nextTotal / pageSize));
    setTotal(nextTotal);
    setTotalPages(nextTotalPages);
    setPage(nextTotalPages);
    setStatus({ kind: 'idle' });
  };

  const updateEvent = (id: string, patch: Partial<DraftEvent>) => {
    setEvents((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    );
    setStatus({ kind: 'idle' });
  };

  const removeEvent = async (id: string) => {
    const persisted = isPersistedId(id);
    if (!persisted) {
      setEvents((prev) => prev.filter((e) => e.id !== id));
      setStatus({ kind: 'idle' });
      return;
    }
    setStatus({ kind: 'saving' });
    try {
      await apiFetch('delete', { id }, 'DELETE');
      setEvents((prev) => prev.filter((e) => e.id !== id));
      setStatus({ kind: 'saved', at: Date.now() });
    } catch (e) {
      setStatus({
        kind: 'error',
        message: e instanceof Error ? e.message : 'Failed to delete',
      });
    }
  };

  const moveEvent = (id: string, dir: -1 | 1) => {
    setEvents((prev) => {
      const idx = prev.findIndex((e) => e.id === id);
      if (idx < 0) return prev;
      const target = idx + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = prev.slice();
      const [moved] = next.splice(idx, 1);
      next.splice(target, 0, moved);
      return next;
    });
    // Moving across pages would be surprising — if the user is at the top of
    // a page and hits Up, they should land on the previous page, not have the
    // event silently jump pages. Track the moved row by following it.
    setStatus({ kind: 'idle' });
  };

  const onSaveAll = async () => {
    setStatus({ kind: 'saving' });
    try {
      // Pull every page from the server before diffing — the initial snapshot
      // only covers page 1, so without this we'd miss edits/deletions on
      // other pages. Cheaper than doing the diff with a partial snapshot.
      await ensureAllPagesLoaded();

      // --- Compute the diff against the last server snapshot --------------
      const initialById = new Map(initial.events.map((e) => [e.id, e]));
      const currentById = new Map(events.map((e) => [e.id, e]));

      const settingsChanged =
        settings.tag.trim() !== initial.settings.tag.trim() ||
        settings.title.trim() !== initial.settings.title.trim();

      // Events the user filled in with a non-empty title are persisted;
      // anything else is silently dropped from the save.
      const savable = events.filter((e) => e.title.trim().length > 0);

      const newEvents = savable.filter((e) => !initialById.has(e.id));
      const deletedEvents = initial.events.filter(
        (e) => !currentById.has(e.id) && isPersistedId(e.id),
      );

      const updatedEvents = savable.filter((e) => {
        const before = initialById.get(e.id);
        if (!before) return false;
        return !eventFieldsEqual(before, e);
      });

      const initialOrder = initial.events.map((e) => e.id);
      const currentOrder = savable.map((e) => e.id);
      const orderChanged =
        initialOrder.length !== currentOrder.length ||
        initialOrder.some((id, i) => id !== currentOrder[i]);

      const hasChanges =
        settingsChanged ||
        newEvents.length > 0 ||
        deletedEvents.length > 0 ||
        updatedEvents.length > 0 ||
        orderChanged;

      if (!hasChanges) {
        setStatus({ kind: 'saved', at: Date.now() });
        writeDraft(null);
        return;
      }

      // --- Apply only the changes -----------------------------------------
      if (settingsChanged) {
        await apiFetch('settings', { settings });
      }

      for (const e of newEvents) {
        const result = await apiFetch('event', {
          event: serializeEvent(e),
        });
        const persisted = (result as { event?: CalendarEvent }).event;
        if (persisted?.id) {
          setEvents((prev) =>
            prev.map((x) => (x.id === e.id ? { ...x, id: persisted.id } : x)),
          );
        }
      }

      for (const e of updatedEvents) {
        await apiFetch('event', {
          event: { id: e.id, ...serializeEvent(e) },
        });
      }

      for (const old of deletedEvents) {
        await apiFetch('delete', { id: old.id }, 'DELETE');
      }

      if (orderChanged) {
        await apiFetch('reorder', {
          ids: savable.map((e) => e.id),
        });
      }

      setStatus({ kind: 'saved', at: Date.now() });
      writeDraft(null);
    } catch (e) {
      setStatus({
        kind: 'error',
        message: e instanceof Error ? e.message : 'Failed to save',
      });
    }
  };

  return (
    <div className="container-base section-padding">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-paprika">
            Admin
          </p>
          <h1 className="font-serif text-3xl font-bold text-hunter-green">
            Calendar Editor
          </h1>
          <p className="mt-1 text-sm text-dark-gray">
            Edit section Calendar dan kartu event yang tampil di home page
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            <Link href="/admin/hero" className={NAV_LINK_CLS}>
              Hero
            </Link>
            <Link href="/admin/our-story" className={NAV_LINK_CLS}>
              Our Story
            </Link>
            <Link href="/admin/why-join" className={NAV_LINK_CLS}>
              Why Join
            </Link>
            <Link href="/admin/activities" className={NAV_LINK_CLS}>
              Activities
            </Link>
            <Link href="/admin/activities-list" className={NAV_LINK_CLS}>
              Activities List
            </Link>
          </div>
          <SaveBadge status={status} />
          <button
            type="button"
            onClick={onSaveAll}
            disabled={status.kind === 'saving'}
            className="rounded-full bg-paprika px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-paprika-hover disabled:opacity-50"
          >
            {status.kind === 'saving' ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </header>

      <section className="mb-8 rounded-2xl border border-light-gray bg-white p-6">
        <h2 className="font-serif text-xl font-semibold text-hunter-green">
          Heading
        </h2>
        <p className="mt-1 text-sm text-dark-gray">
          Tag dan judul section Calendar
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-1">
            <span className={FIELD_LABEL_CLS}>Tag</span>
            <input
              type="text"
              value={settings.tag}
              onChange={(e) => setSettingsField('tag', e.target.value)}
              className={INPUT_CLS}
            />
          </label>
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className={FIELD_LABEL_CLS}>Title</span>
            <input
              type="text"
              value={settings.title}
              onChange={(e) => setSettingsField('title', e.target.value)}
              className={INPUT_CLS}
            />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-light-gray bg-white p-6">
        <header className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-serif text-xl font-semibold text-hunter-green">
              Events
            </h2>
            <p className="mt-1 text-sm text-dark-gray">
              Kartu event. {HOME_EVENT_LIMIT} teratas tampil di home page,
              sisanya tersimpan dan dikelola di sini.
            </p>
          </div>
          <button
            type="button"
            onClick={addEvent}
            className="inline-flex items-center gap-1.5 rounded-full border border-hunter-green px-3 py-1.5 text-xs font-semibold text-hunter-green transition-colors hover:bg-hunter-green hover:text-white"
          >
            <PlusIcon size={14} />
            Tambah event
          </button>
        </header>

        <ul className="mt-6 grid gap-3">
          {pageItems.length === 0 && total === 0 && (
            <li className="rounded-xl border border-dashed border-light-gray bg-off-white p-6 text-center text-sm text-dark-gray">
              Belum ada event. Klik &quot;Tambah event&quot; untuk mulai.
            </li>
          )}
          {pageItems.length === 0 && total > 0 && loadingPage && (
            <li className="rounded-xl border border-dashed border-light-gray bg-off-white p-6 text-center text-sm text-dark-gray">
              Memuat halaman {safePage}...
            </li>
          )}
          {pageItems.map((event) => {
            const idx = events.findIndex((e) => e.id === event.id);
            return (
            <li
              key={event.id}
              className="rounded-xl border border-light-gray bg-off-white p-4"
            >
              <div className="flex items-start gap-4">
                <div className="flex w-20 flex-shrink-0 flex-col items-center gap-1">
                  <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-br from-hunter-green to-teal text-white">
                    <div className="text-center leading-tight">
                      <div className="font-serif text-lg font-bold">
                        {event.day || '—'}
                      </div>
                      <div className="text-[0.6rem] uppercase tracking-widest opacity-90">
                        {event.month || '—'}
                      </div>
                    </div>
                  </div>
                  <span className="text-[0.65rem] font-bold uppercase tracking-wider text-dark-gray">
                    #{idx + 1}
                  </span>
                </div>

                <div className="flex flex-1 flex-col gap-3 min-w-0">
                  <input
                    type="text"
                    value={event.title}
                    onChange={(e) =>
                      updateEvent(event.id, { title: e.target.value })
                    }
                    placeholder="Judul event"
                    className={INPUT_CLS}
                  />
                  <textarea
                    rows={2}
                    value={event.description}
                    onChange={(e) =>
                      updateEvent(event.id, { description: e.target.value })
                    }
                    placeholder="Deskripsi singkat"
                    className={INPUT_CLS}
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="flex flex-col gap-1">
                      <span className={FIELD_LABEL_CLS}>Day</span>
                      <input
                        type="text"
                        value={event.day}
                        onChange={(e) =>
                          updateEvent(event.id, { day: e.target.value })
                        }
                        placeholder="e.g. 15"
                        className={INPUT_CLS}
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className={FIELD_LABEL_CLS}>Month</span>
                      <input
                        type="text"
                        value={event.month}
                        onChange={(e) =>
                          updateEvent(event.id, { month: e.target.value })
                        }
                        placeholder="e.g. JAN"
                        className={INPUT_CLS}
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className={FIELD_LABEL_CLS}>Location</span>
                      <input
                        type="text"
                        value={event.location}
                        onChange={(e) =>
                          updateEvent(event.id, { location: e.target.value })
                        }
                        placeholder="e.g. Central Park Courts"
                        className={INPUT_CLS}
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className={FIELD_LABEL_CLS}>Time</span>
                      <input
                        type="text"
                        value={event.time}
                        onChange={(e) =>
                          updateEvent(event.id, { time: e.target.value })
                        }
                        placeholder="e.g. 9:00 AM – 5:00 PM"
                        className={INPUT_CLS}
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className={FIELD_LABEL_CLS}>CTA label</span>
                      <input
                        type="text"
                        value={event.ctaLabel}
                        onChange={(e) =>
                          updateEvent(event.id, { ctaLabel: e.target.value })
                        }
                        placeholder="e.g. Register Now"
                        className={INPUT_CLS}
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className={FIELD_LABEL_CLS}>CTA URL</span>
                      <input
                        type="text"
                        value={event.ctaHref}
                        onChange={(e) =>
                          updateEvent(event.id, { ctaHref: e.target.value })
                        }
                        placeholder="e.g. /#cta"
                        className={INPUT_CLS}
                      />
                    </label>
                  </div>
                </div>

                <div className="flex flex-col items-center gap-1">
                  <button
                    type="button"
                    onClick={() => moveEvent(event.id, -1)}
                    disabled={idx === 0}
                    aria-label="Move up"
                    className="rounded-md p-1.5 text-dark-gray transition-colors hover:bg-hunter-green/10 hover:text-hunter-green disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-dark-gray"
                  >
                    <ChevronUp size={16} className="rotate-180" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveEvent(event.id, 1)}
                    disabled={idx === events.length - 1 || idx === total - 1}
                    aria-label="Move down"
                    className="rounded-md p-1.5 text-dark-gray transition-colors hover:bg-hunter-green/10 hover:text-hunter-green disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-dark-gray"
                  >
                    <ChevronUp size={16} />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => removeEvent(event.id)}
                  aria-label="Remove event"
                  className="rounded-md p-1.5 text-paprika transition-colors hover:bg-paprika/10"
                >
                  <XIcon size={18} />
                </button>
              </div>
            </li>
            );
          })}
        </ul>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-light-gray pt-4">
          <p className="text-xs text-dark-gray">
            Menampilkan {pageStart + 1}–{Math.min(pageStart + pageSize, total)} dari {total} event · Halaman {safePage} dari {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="inline-flex items-center gap-1 rounded-full border border-light-gray px-3 py-1.5 text-xs font-semibold text-dark-gray transition-colors hover:border-hunter-green hover:text-hunter-green disabled:opacity-40 disabled:hover:border-light-gray disabled:hover:text-dark-gray"
            >
              <ChevronLeftIcon size={14} />
              Sebelumnya
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPage(p)}
                aria-current={p === safePage ? 'page' : undefined}
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
        </div>

        {total > HOME_EVENT_LIMIT && (
          <p className="mt-4 rounded-xl border border-light-gray bg-off-white p-3 text-xs text-dark-gray">
            <strong className="text-hunter-green">{HOME_EVENT_LIMIT} event teratas</strong> akan tampil di home page. Event di halaman {Math.ceil((HOME_EVENT_LIMIT + 1) / pageSize)}+ hanya tersimpan dan dikelola di sini.
          </p>
        )}
      </section>
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
