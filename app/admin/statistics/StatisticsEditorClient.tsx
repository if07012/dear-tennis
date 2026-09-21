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
import type { Statistic } from '@/data/statistics-types';
import { AdminTableToolbar } from '@/components/admin/AdminTableToolbar';
import { ResponsiveTable } from '@/components/admin/ResponsiveTable';
import { ResponsivePagination } from '@/components/admin/ResponsivePagination';
import { MobileActionMenu } from '@/components/admin/MobileActionMenu';

type SaveStatus =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved'; at: number }
  | { kind: 'error'; message: string };

type DraftItem = Omit<Statistic, 'order' | 'createdAt'> & {
  id: string;
  order: number;
};

const DRAFT_KEY = 'admin.statistics.draft';

type Draft = { items: DraftItem[] };

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
  items: DraftItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export function StatisticsEditorClient({ initial }: { initial: InitialPage }) {
  const { user } = useAuth();
  const [items, setItems] = useState<DraftItem[]>(
    initial.items.map((i) => ({
      id: i.id,
      value: i.value,
      label: i.label,
      suffix: i.suffix,
      order: i.order,
    })),
  );
  const [status, setStatus] = useState<SaveStatus>({ kind: 'idle' });
  const [hydrated, setHydrated] = useState(false);
  const [page, setPage] = useState(initial.page);
  const [totalPages, setTotalPages] = useState(initial.totalPages);
  const [total, setTotal] = useState(initial.total);
  const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
  const [pageSize, setPageSize] = useState(initial.pageSize);
  const [loadedPages, setLoadedPages] = useState<Set<number>>(
    () => new Set([initial.page]),
  );
  const [loadingPage, setLoadingPage] = useState(false);
  const [search, setSearch] = useState('');

  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const sortedItems = useMemo(
    () => [...items].sort((a, b) => a.order - b.order),
    [items],
  );

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sortedItems;
    return sortedItems.filter(
      (i) =>
        i.label.toLowerCase().includes(q) ||
        i.suffix?.toLowerCase().includes(q),
    );
  }, [sortedItems, search]);

  const pageItems = useMemo(
    () => filteredItems.slice(pageStart, pageStart + pageSize),
    [filteredItems, pageStart, pageSize],
  );
  const totalPagesFiltered = Math.max(1, Math.ceil(filteredItems.length / pageSize));

  const fetchPage = useCallback(
    async (pageToLoad: number) => {
      if (loadedPages.has(pageToLoad)) return;
      setLoadingPage(true);
      try {
        const res = await fetch(
          `/api/statistics?page=${pageToLoad}&pageSize=${pageSize}`,
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
                value: row.value,
                label: row.label,
                suffix: row.suffix,
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
      `/api/statistics?page=1&pageSize=${pageSize}`,
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
      setItems(d.items);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    writeDraft({ items });
  }, [hydrated, items]);

  const apiFetch = useCallback(
    async (
      kind: 'item' | 'reorder' | 'delete',
      payload: Record<string, unknown>,
      method: 'PUT' | 'DELETE' = 'PUT',
    ) => {
      const res = await fetch('/api/statistics', {
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

  const addItem = () => {
    setItems((prev) => {
      const next = [
        ...prev,
        {
          id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          value: 0,
          label: '',
          suffix: '',
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

      const savable = items.filter(
        (i) => i.label.trim().length > 0 && i.value > 0,
      );

      const newItems = savable.filter((i) => !initialById.has(i.id));
      const deletedItems = initial.items.filter(
        (i) => !currentById.has(i.id) && isPersistedId(i.id),
      );

      const updatedItems = savable.filter((i) => {
        const before = initialById.get(i.id);
        if (!before) return false;
        const beforeSuffix = before.suffix ?? '';
        const afterSuffix = i.suffix ?? '';
        return (
          before.value !== i.value ||
          before.label !== i.label ||
          beforeSuffix !== afterSuffix
        );
      });

      const initialOrder = initial.items.map((i) => i.id);
      const currentOrder = savable.map((i) => i.id);
      const orderChanged =
        initialOrder.length !== currentOrder.length ||
        initialOrder.some((id, i) => id !== currentOrder[i]);

      const hasChanges =
        newItems.length > 0 ||
        deletedItems.length > 0 ||
        updatedItems.length > 0 ||
        orderChanged;

      if (!hasChanges) {
        setStatus({ kind: 'saved', at: Date.now() });
        writeDraft(null);
        return;
      }

      for (const i of newItems) {
        const result = await apiFetch('item', {
          item: {
            value: i.value,
            label: i.label.trim(),
            suffix: i.suffix?.trim() || undefined,
          },
        });
        const persisted = (result as { item?: Statistic }).item;
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
            value: i.value,
            label: i.label.trim(),
            suffix: i.suffix?.trim() || undefined,
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

  const statisticColumns = useMemo(() => [
    {
      key: 'number',
      header: '#',
      priority: 1 as const,
      className: 'w-12',
      render: (item: DraftItem) => {
        const idx = sortedItems.findIndex((i) => i.id === item.id);
        return (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-paprika/10 font-serif text-base font-bold text-paprika">
            {idx + 1}.
          </div>
        );
      },
    },
    {
      key: 'value',
      header: 'Value',
      priority: 1 as const,
      className: 'w-24',
      render: (item: DraftItem) => (
        <input
          type="number"
          value={item.value}
          onChange={(e) => updateItem(item.id, { value: Number(e.target.value) })}
          className={INPUT_CLS}
          min="0"
        />
      ),
    },
    {
      key: 'label',
      header: 'Label',
      priority: 1 as const,
      render: (item: DraftItem) => (
        <input
          type="text"
          value={item.label}
          onChange={(e) => updateItem(item.id, { label: e.target.value })}
          className={INPUT_CLS}
          placeholder="Label"
        />
      ),
    },
    {
      key: 'suffix',
      header: 'Suffix',
      priority: 2 as const,
      className: 'w-16',
      render: (item: DraftItem) => (
        <input
          type="text"
          value={item.suffix ?? ''}
          onChange={(e) => updateItem(item.id, { suffix: e.target.value })}
          className={INPUT_CLS}
          placeholder="Suffix"
        />
      ),
    },
  ], [updateItem]);

  const getRowActions = (item: DraftItem) => {
    const idx = sortedItems.findIndex((i) => i.id === item.id);
    return [
      {
        label: '↑',
        primary: false,
        onClick: () => moveItem(item.id, -1),
        disabled: () => idx === 0,
      },
      {
        label: '↓',
        primary: false,
        onClick: () => moveItem(item.id, 1),
        disabled: () => idx === sortedItems.length - 1,
      },
      {
        label: 'Hapus',
        primary: false,
        destructive: true,
        onClick: () => removeItem(item.id),
      },
    ];
  };

  return (
    <div className="container-base section-padding">
      <header className="admin-header">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-paprika">
            Admin
          </p>
          <h1 className="font-serif text-3xl font-bold text-hunter-green">
            Statistics Editor
          </h1>
          <p className="mt-1 text-sm text-dark-gray">
            Edit angka-angka besar yang tampil di strip Statistics home page
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

      <section className="rounded-2xl border border-light-gray bg-white p-6">
        <header className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-serif text-xl font-semibold text-hunter-green">
              Items
            </h2>
            <p className="mt-1 text-sm text-dark-gray">
              Setiap kartu menampilkan angka yang beranimasi ketika scroll
              masuk. Label wajib diisi; suffix bersifat opsional (mis.
              " %" untuk Satisfaction).
            </p>
          </div>
          <button
            type="button"
            onClick={addItem}
            className="inline-flex items-center gap-1.5 rounded-full border border-hunter-green px-3 py-1.5 text-xs font-semibold text-hunter-green transition-colors hover:bg-hunter-green hover:text-white"
          >
            <PlusIcon size={14} />
            Tambah stat
          </button>
        </header>

        <AdminTableToolbar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Cari label / suffix"
          onAdd={addItem}
          addLabel="Tambah stat"
          loading={loadingPage}
          pageSize={pageSize}
          onPageSizeChange={(newSize) => { setPageSize(newSize); setPage(1); }}
          pageSizeOptions={[10, 25, 50, 100]}
        />

        <ResponsiveTable
          items={pageItems}
          rowKey={(i) => i.id}
          columns={statisticColumns}
          actions={getRowActions}
          emptyMessage={items.length === 0 ? 'Belum ada stat. Klik "Tambah stat" untuk mulai.' : 'Tidak ada hasil untuk pencarian ini.'}
          loading={loadingPage}
          mobileCardRender={(item) => (
            <>
              <div className="admin-card-header">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-paprika/10 text-paprika">
                    <span className="font-serif text-lg font-bold">#{sortedItems.findIndex((i) => i.id === item.id) + 1}</span>
                  </div>
                  <div className="min-w-0">
                    <input
                      type="text"
                      value={item.label}
                      onChange={(e) => updateItem(item.id, { label: e.target.value })}
                      className="font-medium text-hunter-green bg-transparent border-0 focus:outline-none focus:ring-0 w-full"
                      placeholder="Label"
                    />
                    <p className="text-xs text-dark-gray">Value: {item.value}{item.suffix ? ` ${item.suffix}` : ''}</p>
                  </div>
                </div>
              </div>
              <div className="admin-card-body space-y-3">
                <div className="admin-card-row flex flex-col items-start gap-1">
                  <span className="admin-card-label">Value</span>
                  <input
                    type="number"
                    value={item.value}
                    onChange={(e) => updateItem(item.id, { value: Number(e.target.value) })}
                    className={INPUT_CLS}
                    min="0"
                  />
                </div>
                <div className="admin-card-row flex flex-col items-start gap-1">
                  <span className="admin-card-label">Label</span>
                  <input
                    type="text"
                    value={item.label}
                    onChange={(e) => updateItem(item.id, { label: e.target.value })}
                    className={INPUT_CLS}
                    placeholder="Label"
                  />
                </div>
                <div className="admin-card-row flex flex-col items-start gap-1">
                  <span className="admin-card-label">Suffix</span>
                  <input
                    type="text"
                    value={item.suffix ?? ''}
                    onChange={(e) => updateItem(item.id, { suffix: e.target.value })}
                    className={INPUT_CLS}
                    placeholder="Suffix"
                  />
                </div>
              </div>
              <div className="admin-card-actions">
                <button
                  type="button"
                  onClick={() => moveItem(item.id, -1)}
                  disabled={sortedItems.findIndex((i) => i.id === item.id) === 0}
                  className="admin-card-action-primary admin-touch-target"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => moveItem(item.id, 1)}
                  disabled={sortedItems.findIndex((i) => i.id === item.id) === sortedItems.length - 1}
                  className="admin-card-action-primary admin-touch-target"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  className="admin-card-action-primary admin-card-action-destructive admin-touch-target"
                >
                  Hapus
                </button>
              </div>
            </>
          )}
        />

        <ResponsivePagination
          page={safePage}
          totalPages={totalPagesFiltered}
          onPageChange={setPage}
          showPageNumbers={true}
        />
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