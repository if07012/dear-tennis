'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type { LevelRecord } from '@/data/tennis-level-types';
import { XIcon, CheckIcon } from '@/components/ui/Icons';
import { AdminTableToolbar } from '@/components/admin/AdminTableToolbar';
import { ResponsiveTable } from '@/components/admin/ResponsiveTable';
import { ResponsivePagination } from '@/components/admin/ResponsivePagination';
import { MobileActionMenu } from '@/components/admin/MobileActionMenu';

const FIELD_LABEL_CLS =
  'text-xs font-semibold uppercase tracking-wider text-dark-gray';
const INPUT_CLS =
  'w-full rounded-lg border border-light-gray bg-white px-3 py-2 text-sm focus:border-hunter-green focus:outline-none';

type Toast =
  | { kind: 'idle' }
  | { kind: 'saved'; at: number }
  | { kind: 'error'; message: string };

export function LevelsClient({ initial }: { initial: LevelRecord[] }) {
  const { user } = useAuth();
  const [levels, setLevels] = useState<LevelRecord[]>(initial);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<LevelRecord>>({
    name: '',
    description: '',
    order: 0,
    isActive: true,
  });
  const [status, setStatus] = useState<Toast>({ kind: 'idle' });
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
  const [pageSize, setPageSize] = useState(10);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/levels', {
        headers: { 'x-auth-email': user?.email ?? '' },
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { levels: LevelRecord[] };
      setLevels(body.levels ?? []);
    } catch (e) {
      setStatus({
        kind: 'error',
        message: e instanceof Error ? e.message : 'Gagal memuat level',
      });
    }
  }, [user?.email]);

  useEffect(() => {
    if (status.kind !== 'saved') return;
    const id = window.setTimeout(() => setStatus({ kind: 'idle' }), 1200);
    return () => window.clearTimeout(id);
  }, [status]);

  const startCreate = () => {
    setEditingId('__new__');
    setForm({ name: '', description: '', order: levels.length + 1, isActive: true });
  };

  const startEdit = (l: LevelRecord) => {
    setEditingId(l.id);
    setForm({ name: l.name, description: l.description, order: l.order, isActive: l.isActive });
  };

  const cancel = () => {
    setEditingId(null);
    setForm({ name: '', description: '', order: 0, isActive: true });
  };

  const save = async () => {
    const name = form.name?.trim();
    if (!name) {
      setStatus({ kind: 'error', message: 'Nama level wajib diisi' });
      return;
    }
    setSaving(true);
    setStatus({ kind: 'idle' });
    try {
      const res = await fetch('/api/admin/levels', {
        method: editingId === '__new__' ? 'POST' : 'PATCH',
        headers: {
          'content-type': 'application/json',
          'x-auth-email': user?.email ?? '',
        },
        body: JSON.stringify({
          ...(editingId !== '__new__' ? { id: editingId } : {}),
          name,
          description: form.description?.trim() || '',
          order: form.order ?? 0,
          isActive: form.isActive ?? true,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      await refresh();
      cancel();
      setStatus({ kind: 'saved', at: Date.now() });
    } catch (e) {
      setStatus({
        kind: 'error',
        message: e instanceof Error ? e.message : 'Gagal menyimpan level',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Hapus level ini? Tindakan ini tidak bisa dibatalkan.')) return;
    try {
      const res = await fetch('/api/admin/levels', {
        method: 'DELETE',
        headers: {
          'content-type': 'application/json',
          'x-auth-email': user?.email ?? '',
        },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      await refresh();
      setStatus({ kind: 'saved', at: Date.now() });
    } catch (e) {
      setStatus({
        kind: 'error',
        message: e instanceof Error ? e.message : 'Gagal menghapus level',
      });
    }
  };

  const editing = editingId !== null && (editingId === '__new__' || levels.some((l) => l.id === editingId));

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return levels;
    return levels.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        (l.description ?? '').toLowerCase().includes(q),
    );
  }, [levels, search]);

  const changePageSize = (newSize: number) => {
    setPageSize(newSize);
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const pageItems = filtered.slice(pageStart, pageStart + pageSize);

  const columns = useMemo(() => [
    {
      key: 'order',
      header: 'Order',
      priority: 1 as const,
      className: 'w-16',
      render: (l: LevelRecord) => (
        <span className="font-mono text-xs text-dark-gray">{l.order}</span>
      ),
    },
    {
      key: 'name',
      header: 'Level',
      priority: 1 as const,
      render: (l: LevelRecord) => (
        <span className="font-medium text-hunter-green">{l.name}</span>
      ),
    },
    {
      key: 'description',
      header: 'Deskripsi',
      priority: 2 as const,
      render: (l: LevelRecord) => (
        <span className="text-dark-gray truncate whitespace-pre-wrap max-w-xs">{l.description || '—'}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      priority: 1 as const,
      className: 'w-28',
      render: (l: LevelRecord) => (
        l.isActive ? (
          <span className="rounded-full bg-hunter-green/10 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-hunter-green">
            Active
          </span>
        ) : (
          <span className="rounded-full bg-dark-gray/10 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-dark-gray">
            Inactive
          </span>
        )
      ),
    },
  ], []);

  const getRowActions = (item: LevelRecord) => [
    {
      label: 'Edit',
      primary: true,
      onClick: () => startEdit(item),
    },
    {
      label: 'Hapus',
      primary: false,
      destructive: true,
      onClick: () => handleDelete(item.id),
    },
  ];

  return (
    <div className="container-base section-padding">
      <header className="admin-header">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-paprika">
            Admin
          </p>
          <h1 className="font-serif text-3xl font-bold text-hunter-green">
            Player Levels
          </h1>
          <p className="mt-1 text-sm text-dark-gray">
            Kelola level pemain. Level menentukan kemampuan tenis berdasarkan skill badge.
          </p>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="rounded-2xl border border-light-gray bg-white p-6 shadow-sm">
          <AdminTableToolbar
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Cari nama / deskripsi"
            onAdd={startCreate}
            addLabel="+ Level baru"
            loading={false}
            pageSize={pageSize}
            onPageSizeChange={changePageSize}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
          />

          <ResponsiveTable
            items={pageItems}
            rowKey={(l) => l.id}
            columns={columns}
            actions={getRowActions(pageItems[0])}
            emptyMessage={levels.length === 0 ? 'Belum ada level. Tambahkan level pertama.' : 'Tidak ada hasil untuk pencarian ini.'}
            loading={false}
            mobileCardRender={(l) => (
              <>
                <div className="admin-card-header">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono text-xs text-dark-gray shrink-0">#{l.order}</span>
                    <div className="min-w-0">
                      <h3 className="font-medium text-hunter-green truncate whitespace-pre-wrap">{l.name}</h3>
                    </div>
                  </div>
                </div>
                <div className="admin-card-body">
                  <div className="admin-card-row">
                    <span className="admin-card-label">Deskripsi:</span>
                    <span className="admin-card-value flex-1 truncate text-xs text-dark-gray">{l.description || '—'}</span>
                  </div>
                  <div className="admin-card-row">
                    <span className="admin-card-label">Status:</span>
                    <span className="admin-card-value flex-1 truncate">
                      {l.isActive ? (
                        <span className="rounded-full bg-hunter-green/10 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-hunter-green">
                          Active
                        </span>
                      ) : (
                        <span className="rounded-full bg-dark-gray/10 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-dark-gray">
                          Inactive
                        </span>
                      )}
                    </span>
                  </div>
                </div>
                <div className="admin-card-actions">
                  <button
                    type="button"
                    onClick={() => startEdit(l)}
                    className="admin-card-action-primary admin-touch-target"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(l.id)}
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
            totalPages={totalPages}
            onPageChange={setPage}
            showPageNumbers={true}
          />
        </section>

        <aside className="rounded-2xl border border-light-gray bg-white p-6 shadow-sm">
          <h2 className="mb-3 font-serif text-lg font-semibold text-hunter-green">
            {editingId === '__new__' ? 'Level baru' : 'Edit level'}
          </h2>
          {!editing ? (
            <p className="text-sm text-dark-gray">
              Klik <strong>Edit</strong> pada baris untuk mengubah level,
              atau klik <strong>+ Level baru</strong> untuk membuat entri baru.
            </p>
          ) : (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
            >
              <label className="flex flex-col gap-1">
                <span className={FIELD_LABEL_CLS}>Nama Level</span>
                <input
                  type="text"
                  value={form.name ?? ''}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Beginner"
                  maxLength={60}
                  required
                  className={INPUT_CLS}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className={FIELD_LABEL_CLS}>Deskripsi</span>
                <textarea
                  value={form.description ?? ''}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  rows={3}
                  maxLength={200}
                  className={INPUT_CLS}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className={FIELD_LABEL_CLS}>Order (Urutan)</span>
                <input
                  type="number"
                  value={form.order ?? 0}
                  onChange={(e) => setForm((p) => ({ ...p, order: Number(e.target.value) }))}
                  min={1}
                  className={INPUT_CLS}
                />
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.isActive ?? true}
                  onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
                  className="h-4 w-4 rounded border-light-gray text-hunter-green focus:ring-hunter-green"
                />
                <span className="text-xs text-dark-gray">Aktif (tampil untuk pemain)</span>
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={cancel}
                  disabled={saving}
                  className="rounded-full border border-light-gray px-3 py-1 text-xs font-semibold text-dark-gray transition-colors hover:border-dark-gray disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-full bg-paprika px-4 py-1 text-xs font-semibold text-white transition-colors hover:bg-paprika-hover disabled:opacity-50"
                >
                  {saving ? 'Menyimpan…' : 'Simpan'}
                </button>
              </div>
            </form>
          )}
          <ToastBadge status={status} />
        </aside>
      </div>
    </div>
  );
}

function ToastBadge({ status }: { status: Toast }) {
  if (status.kind === 'idle') return null;
  if (status.kind === 'saved') {
    return (
      <p className="mt-3 rounded-full bg-hunter-green/10 px-3 py-1 text-center text-xs font-semibold text-hunter-green">
        Tersimpan
      </p>
    );
  }
  return (
    <p className="mt-3 rounded-full bg-paprika/10 px-3 py-1 text-center text-xs font-semibold text-paprika">
      {status.message}
    </p>
  );
}