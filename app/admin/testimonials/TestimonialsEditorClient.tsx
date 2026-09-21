'use client';

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
  Testimonial,
  TestimonialsSettings,
} from '@/data/testimonials-types';

type SettingsDraft = Omit<TestimonialsSettings, 'id' | 'updatedAt'>;

type SaveStatus =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved'; at: number }
  | { kind: 'error'; message: string };

type DraftItem = Omit<Testimonial, 'order' | 'createdAt'> & {
  id: string;
  order: number;
};

const DRAFT_KEY = 'admin.testimonials.draft';

type Draft = { settings: SettingsDraft; items: DraftItem[] };

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
  if (id.startsWith('draft-')) return false;
  return id.length > 24;
}

const FIELD_LABEL_CLS =
  'text-xs font-semibold uppercase tracking-wider text-dark-gray';
const INPUT_CLS =
  'w-full rounded-lg border border-light-gray bg-white px-3 py-2 text-sm focus:border-hunter-green focus:outline-none';

type InitialPage = {
  settings: TestimonialsSettings;
  items: DraftItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export function TestimonialsEditorClient({ initial }: { initial: InitialPage }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<SettingsDraft>({
    tag: initial.settings.tag,
    title: initial.settings.title,
    subtitle: initial.settings.subtitle,
  });
  const [items, setItems] = useState<DraftItem[]>(
    initial.items.map((i) => ({
      id: i.id,
      quote: i.quote,
      name: i.name,
      since: i.since,
      avatar: i.avatar,
      order: i.order,
    })),
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
  const sortedItems = useMemo(
    () => [...items].sort((a, b) => a.order - b.order),
    [items],
  );
  const pageItems = useMemo(
    () => sortedItems.slice(pageStart, pageStart + pageSize),
    [sortedItems, pageStart, pageSize],
  );

  const fetchPage = useCallback(
    async (pageToLoad: number) => {
      if (loadedPages.has(pageToLoad)) return;
      setLoadingPage(true);
      try {
        const res = await fetch(
          `/api/testimonials?page=${pageToLoad}&pageSize=${pageSize}`,
          {
            headers: { 'x-auth-email': user?.email ?? '' },
          },
        );
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const body = (await res.json()) as {
          items: DraftItem[];
          total: number;
          page: number;
          pageSize: number;
          totalPages: number;
        };
        setItems((prev) => {
          const byId = new Map(prev.map((i) => [i.id, i]));
          for (const row of body.items) {
            if (!byId.has(row.id)) {
              byId.set(row.id, {
                id: row.id,
                quote: row.quote,
                name: row.name,
                since: row.since,
                avatar: row.avatar,
                order: row.order,
              });
            }
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

  const loadedPagesRef = useRef(loadedPages);
  useEffect(() => {
    loadedPagesRef.current = loadedPages;
  }, [loadedPages]);

  useEffect(() => {
    if (loadedPages.has(safePage)) return;
    void fetchPage(safePage);
  }, [safePage, loadedPages, fetchPage]);

  const ensureAllPagesLoaded = useCallback(async () => {
    const res = await fetch(
      `/api/testimonials?page=1&pageSize=${pageSize}`,
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
      setItems(d.items);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    writeDraft({ settings, items });
  }, [hydrated, settings, items]);

  const apiFetch = useCallback(
    async (
      kind: 'settings' | 'item' | 'reorder' | 'delete',
      payload: Record<string, unknown>,
      method: 'PUT' | 'DELETE' = 'PUT',
    ) => {
      const res = await fetch('/api/testimonials', {
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

  const addItem = () => {
    setItems((prev) => {
      const next = [
        ...prev,
        {
          id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          quote: '',
          name: '',
          since: '',
          avatar: '',
          order: prev.length,
        },
      ];
      const newPage = Math.max(1, Math.ceil(next.length / pageSize));
      const newTotal = total + 1;
      setTotal(newTotal);
      setTotalPages(Math.max(1, Math.ceil(newTotal / pageSize)));
      setPage(newPage);
      setLoadedPages((loaded) => {
        const updated = new Set(loaded);
        updated.add(newPage);
        return updated;
      });
      return next;
    });
    setStatus({ kind: 'idle' });
  };

  const updateItem = (id: string, patch: Partial<DraftItem>) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    );
    setStatus({ kind: 'idle' });
  };

  const removeItem = async (id: string) => {
    const persisted = isPersistedId(id);
    if (!persisted) {
      setItems((prev) =>
        prev.filter((i) => i.id !== id).map((i, idx) => ({ ...i, order: idx })),
      );
      setStatus({ kind: 'idle' });
      return;
    }
    setStatus({ kind: 'saving' });
    try {
      await apiFetch('delete', { id }, 'DELETE');
      setItems((prev) =>
        prev.filter((i) => i.id !== id).map((i, idx) => ({ ...i, order: idx })),
      );
      setTotal((t) => Math.max(0, t - 1));
      setStatus({ kind: 'saved', at: Date.now() });
    } catch (e) {
      setStatus({
        kind: 'error',
        message: e instanceof Error ? e.message : 'Failed to delete',
      });
    }
  };

  const moveItem = (id: string, dir: -1 | 1) => {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.id === id);
      if (idx < 0) return prev;
      const target = idx + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = prev.slice();
      const [moved] = next.splice(idx, 1);
      next.splice(target, 0, moved);
      return next.map((i, k) => ({ ...i, order: k }));
    });
    setStatus({ kind: 'idle' });
  };

  const onSaveAll = async () => {
    setStatus({ kind: 'saving' });
    try {
      await ensureAllPagesLoaded();

      const initialById = new Map(initial.items.map((i) => [i.id, i]));
      const currentById = new Map(items.map((i) => [i.id, i]));

      const settingsChanged =
        settings.tag.trim() !== initial.settings.tag.trim() ||
        settings.title.trim() !== initial.settings.title.trim() ||
        settings.subtitle.trim() !== initial.settings.subtitle.trim();

      const savable = items.filter(
        (i) => i.quote.trim().length > 0 && i.name.trim().length > 0,
      );

      const newItems = savable.filter((i) => !initialById.has(i.id));
      const deletedItems = initial.items.filter(
        (i) => !currentById.has(i.id) && isPersistedId(i.id),
      );

      const updatedItems = savable.filter((i) => {
        const before = initialById.get(i.id);
        if (!before) return false;
        return (
          before.quote !== i.quote ||
          before.name !== i.name ||
          before.since !== i.since ||
          before.avatar !== i.avatar
        );
      });

      const initialOrder = initial.items.map((i) => i.id);
      const currentOrder = savable.map((i) => i.id);
      const orderChanged =
        initialOrder.length !== currentOrder.length ||
        initialOrder.some((id, i) => id !== currentOrder[i]);

      const hasChanges =
        settingsChanged ||
        newItems.length > 0 ||
        deletedItems.length > 0 ||
        updatedItems.length > 0 ||
        orderChanged;

      if (!hasChanges) {
        setStatus({ kind: 'saved', at: Date.now() });
        writeDraft(null);
        return;
      }

      if (settingsChanged) {
        await apiFetch('settings', { settings });
      }

      for (const i of newItems) {
        const result = await apiFetch('item', {
          item: {
            quote: i.quote.trim(),
            name: i.name.trim(),
            since: i.since.trim(),
            avatar: i.avatar.trim(),
          },
        });
        const persisted = (result as { item?: Testimonial }).item;
        if (persisted?.id) {
          setItems((prev) =>
            prev.map((x) => (x.id === i.id ? { ...x, id: persisted.id } : x)),
          );
        }
      }

      for (const i of updatedItems) {
        await apiFetch('item', {
          item: {
            id: i.id,
            quote: i.quote.trim(),
            name: i.name.trim(),
            since: i.since.trim(),
            avatar: i.avatar.trim(),
          },
        });
      }

      for (const old of deletedItems) {
        await apiFetch('delete', { id: old.id }, 'DELETE');
      }

      if (orderChanged) {
        await apiFetch('reorder', {
          ids: savable.map((i) => i.id),
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
      <header className="admin-header">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-paprika">
            Admin
          </p>
          <h1 className="font-serif text-3xl font-bold text-hunter-green">
            Testimonials Editor
          </h1>
          <p className="mt-1 text-sm text-dark-gray">
            Edit section Member Experiences dan kartu kutipan yang tampil di
            home page
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
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
          Tag, judul, dan subtitle section Member Experiences
        </p>

        <div className="mt-6 admin-form-grid">
          <label className="flex flex-col gap-1">
            <span className={FIELD_LABEL_CLS}>Tag</span>
            <input
              type="text"
              value={settings.tag}
              onChange={(e) => setSettingsField('tag', e.target.value)}
              className={INPUT_CLS}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={FIELD_LABEL_CLS}>Title</span>
            <input
              type="text"
              value={settings.title}
              onChange={(e) => setSettingsField('title', e.target.value)}
              className={INPUT_CLS}
            />
          </label>
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className={FIELD_LABEL_CLS}>Subtitle</span>
            <input
              type="text"
              value={settings.subtitle}
              onChange={(e) => setSettingsField('subtitle', e.target.value)}
              className={INPUT_CLS}
            />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-light-gray bg-white p-6">
        <header className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-serif text-xl font-semibold text-hunter-green">
              Items
            </h2>
            <p className="mt-1 text-sm text-dark-gray">
              Kartu kutipan yang tampil di section Member Experiences. Quote dan
              nama wajib diisi; avatar dan since bersifat opsional.
            </p>
          </div>
          <button
            type="button"
            onClick={addItem}
            className="inline-flex items-center gap-1.5 rounded-full border border-hunter-green px-3 py-1.5 text-xs font-semibold text-hunter-green transition-colors hover:bg-hunter-green hover:text-white"
          >
            <PlusIcon size={14} />
            Tambah kutipan
          </button>
        </header>

        <ul className="mt-6 grid gap-3">
          {pageItems.length === 0 && total === 0 && (
            <li className="rounded-xl border border-dashed border-light-gray bg-off-white p-6 text-center text-sm text-dark-gray">
              Belum ada kutipan. Klik &quot;Tambah kutipan&quot; untuk mulai.
            </li>
          )}
          {pageItems.length === 0 && total > 0 && loadingPage && (
            <li className="rounded-xl border border-dashed border-light-gray bg-off-white p-6 text-center text-sm text-dark-gray">
              Memuat halaman {safePage}...
            </li>
          )}
          {pageItems.map((item) => {
            const idx = sortedItems.findIndex((i) => i.id === item.id);
            return (
              <li
                key={item.id}
                className="rounded-xl border border-light-gray bg-off-white p-4"
              >
                <div className="flex flex-col md:flex-row items-start gap-4">
                  <div className="flex w-20 flex-shrink-0 flex-col items-center gap-1">
                    <div className="relative h-16 w-16 overflow-hidden rounded-full bg-light-gray">
                      {item.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.avatar}
                          alt={item.name || 'preview'}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[0.6rem] font-bold uppercase tracking-wider text-dark-gray">
                          No avatar
                        </div>
                      )}
                    </div>
                    <span className="text-[0.65rem] font-bold uppercase tracking-wider text-dark-gray">
                      #{idx + 1}
                    </span>
                  </div>

                  <div className="flex flex-1 flex-col gap-3 min-w-0">
                    <label className="flex flex-col gap-1">
                      <span className={FIELD_LABEL_CLS}>Quote</span>
                      <textarea
                        value={item.quote}
                        onChange={(e) =>
                          updateItem(item.id, { quote: e.target.value })
                        }
                        rows={3}
                        placeholder="Kutipan dari member"
                        className={`${INPUT_CLS} resize-y`}
                      />
                    </label>
                    <div className="admin-form-grid">
                      <label className="flex flex-col gap-1">
                        <span className={FIELD_LABEL_CLS}>Name</span>
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) =>
                            updateItem(item.id, { name: e.target.value })
                          }
                          placeholder="Nama member"
                          className={INPUT_CLS}
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className={FIELD_LABEL_CLS}>Since</span>
                        <input
                          type="text"
                          value={item.since}
                          onChange={(e) =>
                            updateItem(item.id, { since: e.target.value })
                          }
                          placeholder="Member since 2021"
                          className={INPUT_CLS}
                        />
                      </label>
                    </div>
                    <label className="flex flex-col gap-1">
                      <span className={FIELD_LABEL_CLS}>Avatar URL</span>
                      <input
                        type="url"
                        value={item.avatar}
                        onChange={(e) =>
                          updateItem(item.id, { avatar: e.target.value })
                        }
                        placeholder="https://images.unsplash.com/..."
                        className={INPUT_CLS}
                      />
                    </label>
                  </div>

                  <div className="flex flex-col items-center gap-1 md:w-[60px]">
                    <button
                      type="button"
                      onClick={() => moveItem(item.id, -1)}
                      disabled={idx === 0}
                      aria-label="Move up"
                      className="rounded-md p-1.5 text-dark-gray transition-colors hover:bg-hunter-green/10 hover:text-hunter-green disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-dark-gray"
                    >
                      <ChevronUp size={16} className="rotate-180" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveItem(item.id, 1)}
                      disabled={idx === sortedItems.length - 1 || idx === total - 1}
                      aria-label="Move down"
                      className="rounded-md p-1.5 text-dark-gray transition-colors hover:bg-hunter-green/10 hover:text-hunter-green disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-dark-gray"
                    >
                      <ChevronUp size={16} />
                    </button>
                  </div>

                  <div className="flex flex-col items-end gap-1.5 md:w-[60px]">
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      aria-label="Remove item"
                      className="rounded-md p-1.5 text-paprika transition-colors hover:bg-paprika/10"
                    >
                      <XIcon size={18} />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        <div className="admin-pager border-t border-light-gray pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-dark-gray">
              Menampilkan {total === 0 ? 0 : pageStart + 1}–
              {Math.min(pageStart + pageSize, total)} dari {total} kutipan ·
              Halaman {safePage} dari {totalPages}
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
        </div>
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