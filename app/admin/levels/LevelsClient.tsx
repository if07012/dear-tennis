'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type { LevelRecord, LevelBadgeRecord, BadgeCatalogRecord } from '@/data/tennis-level-types';
import { EmojiPicker } from '@/components/ui/EmojiPicker';
import { XIcon, CheckIcon } from '@/components/ui/Icons';

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

  return (
    <div className="container-base section-padding">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-hunter-green">
            Player Levels
          </h1>
          <p className="text-sm text-dark-gray">
            Kelola level pemain. Level menentukan kemampuan tenis berdasarkan skill badge.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="rounded-2xl border border-light-gray bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={startCreate}
              className="rounded-full bg-paprika px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-paprika-hover"
            >
              + Level baru
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-light-gray text-left text-xs font-semibold uppercase tracking-wider text-dark-gray">
                  <th className="py-3 pr-4">Order</th>
                  <th className="py-3 pr-4">Level</th>
                  <th className="py-3 pr-4">Deskripsi</th>
                  <th className="py-3 pr-4">Status</th>
                  <th className="py-3 pr-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {levels.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-dark-gray">
                      Belum ada level. Tambahkan level pertama.
                    </td>
                  </tr>
                ) : (
                  levels.map((l) => (
                    <tr key={l.id} className="border-b border-light-gray/60 last:border-b-0">
                      <td className="py-3 pr-4 align-middle font-mono text-xs text-dark-gray">
                        {l.order}
                      </td>
                      <td className="py-3 pr-4 align-middle font-medium text-hunter-green">
                        {l.name}
                      </td>
                      <td className="py-3 pr-4 align-middle text-dark-gray truncate max-w-xs">
                        {l.description || '—'}
                      </td>
                      <td className="py-3 pr-4 align-middle">
                        {l.isActive ? (
                          <span className="rounded-full bg-hunter-green/10 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-hunter-green">
                            Active
                          </span>
                        ) : (
                          <span className="rounded-full bg-dark-gray/10 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-dark-gray">
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-4 align-middle text-right">
                        <button
                          type="button"
                          onClick={() => startEdit(l)}
                          className="rounded-full border border-light-gray px-3 py-1 text-xs font-semibold text-hunter-green transition-colors hover:border-hunter-green hover:bg-hunter-green/10 mr-2"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(l.id)}
                          className="rounded-full border border-light-gray px-3 py-1 text-xs font-semibold text-paprika transition-colors hover:border-paprika hover:bg-paprika/10"
                        >
                          Hapus
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
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