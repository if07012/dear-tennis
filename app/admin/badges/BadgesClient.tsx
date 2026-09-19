'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type { BadgeCatalogRecord } from '@/data/tennis-level-types';
import { EmojiPicker } from '@/components/ui/EmojiPicker';
import { XIcon } from '@/components/ui/Icons';

const FIELD_LABEL_CLS =
  'text-xs font-semibold uppercase tracking-wider text-dark-gray';
const INPUT_CLS =
  'w-full rounded-lg border border-light-gray bg-white px-3 py-2 text-sm focus:border-hunter-green focus:outline-none';

type Toast =
  | { kind: 'idle' }
  | { kind: 'saved'; at: number }
  | { kind: 'error'; message: string };

type FormState = {
  key: string;
  label: string;
  icon: string;
  description: string;
  type: 'skill' | 'achievement';
  category: string;
  earningCriteria: string;
  archived: boolean;
};

const EMPTY_FORM: FormState = {
  key: '',
  label: '',
  icon: '🏅',
  description: '',
  type: 'skill',
  category: '',
  earningCriteria: '',
  archived: false,
};

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
}

export function BadgesClient({ initial }: { initial: BadgeCatalogRecord[] }) {
  const { user } = useAuth();
  const [badges, setBadges] = useState<BadgeCatalogRecord[]>(initial);
  const [search, setSearch] = useState('');
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [status, setStatus] = useState<Toast>({ kind: 'idle' });
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/badges', {
        headers: { 'x-auth-email': user?.email ?? '' },
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { badges: BadgeCatalogRecord[] };
      setBadges(body.badges ?? []);
    } catch (e) {
      setStatus({
        kind: 'error',
        message: e instanceof Error ? e.message : 'Gagal memuat katalog',
      });
    }
  }, [user?.email]);

  useEffect(() => {
    if (status.kind !== 'saved') return;
    const id = window.setTimeout(() => setStatus({ kind: 'idle' }), 1200);
    return () => window.clearTimeout(id);
  }, [status]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return badges;
    return badges.filter(
      (b) =>
        b.key.toLowerCase().includes(q) ||
        b.label.toLowerCase().includes(q) ||
        b.description.toLowerCase().includes(q),
    );
  }, [badges, search]);

  const startCreate = () => {
    setEditingKey('__new__');
    setForm(EMPTY_FORM);
  };

  const startEdit = (b: BadgeCatalogRecord) => {
    setEditingKey(b.key);
    setForm({
      key: b.key,
      label: b.label,
      icon: b.icon || '🏅',
      description: b.description,
      type: b.type,
      category: b.category,
      earningCriteria: b.earningCriteria,
      archived: b.archived,
    });
  };

  const cancel = () => {
    setEditingKey(null);
    setForm(EMPTY_FORM);
  };

  const save = async () => {
    const key = form.key.trim().toLowerCase();
    const label = form.label.trim();
    if (!key || !label) {
      setStatus({ kind: 'error', message: 'Key dan label wajib diisi' });
      return;
    }
    if (!/^[a-z0-9-]+$/.test(key)) {
      setStatus({
        kind: 'error',
        message: 'Key hanya boleh huruf kecil, angka, dan tanda hubung',
      });
      return;
    }
    setSaving(true);
    setStatus({ kind: 'idle' });
    try {
      const res = await fetch('/api/admin/badges', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-auth-email': user?.email ?? '',
        },
        body: JSON.stringify({
          key,
          label,
          icon: form.icon,
          description: form.description,
          type: form.type,
          category: form.category,
          earningCriteria: form.earningCriteria,
          archived: form.archived,
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
        message: e instanceof Error ? e.message : 'Gagal menyimpan badge',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (key: string) => {
    if (!window.confirm('Hapus badge ini? Tindakan ini tidak bisa dibatalkan.')) return;
    try {
      const res = await fetch('/api/admin/badges', {
        method: 'DELETE',
        headers: {
          'content-type': 'application/json',
          'x-auth-email': user?.email ?? '',
        },
        body: JSON.stringify({ key }),
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
        message: e instanceof Error ? e.message : 'Gagal menghapus badge',
      });
    }
  };

  const editing =
    editingKey !== null &&
    (editingKey === '__new__' || badges.some((b) => b.key === editingKey));

  return (
    <div className="container-base section-padding">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-hunter-green">
            Badge Catalog
          </h1>
          <p className="text-sm text-dark-gray">
            Kelola badge yang bisa diberikan admin ke user. Skill badge memengaruhi level, achievement badge tidak.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <section className="rounded-2xl border border-light-gray bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <label className={FIELD_LABEL_CLS}>
              Cari
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="key / label / deskripsi / kategori"
                className={`mt-1 ${INPUT_CLS}`}
              />
            </label>
            <button
              type="button"
              onClick={startCreate}
              className="rounded-full bg-paprika px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-paprika-hover"
            >
              + Badge baru
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-light-gray text-left text-xs font-semibold uppercase tracking-wider text-dark-gray">
                  <th className="py-3 pr-4">Badge</th>
                  <th className="py-3 pr-4">Key</th>
                  <th className="py-3 pr-4">Type</th>
                  <th className="py-3 pr-4">Kategori</th>
                  <th className="py-3 pr-4">Status</th>
                  <th className="py-3 pr-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-dark-gray">
                      {badges.length === 0
                        ? 'Belum ada badge. Tambahkan badge pertama.'
                        : 'Tidak ada hasil untuk pencarian ini.'}
                    </td>
                  </tr>
                ) : (
                  filtered.map((b) => (
                    <tr key={b.key} className="border-b border-light-gray/60 last:border-b-0">
                      <td className="py-3 pr-4 align-middle">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl" aria-hidden="true">
                            {b.icon || '🏅'}
                          </span>
                          <div className="min-w-0">
                            <p className="font-medium text-hunter-green truncate">{b.label}</p>
                            {b.description && (
                              <p className="text-xs text-dark-gray truncate">{b.description}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-4 align-middle font-mono text-xs text-dark-gray">{b.key}</td>
                      <td className="py-3 pr-4 align-middle">
                        <span className={`rounded-full px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider ${
                          b.type === 'skill'
                            ? 'bg-hunter-green/10 text-hunter-green'
                            : 'bg-paprika/10 text-paprika'
                        }`}>
                          {b.type === 'skill' ? 'Skill' : 'Achievement'}
                        </span>
                      </td>
                      <td className="py-3 pr-4 align-middle text-xs text-dark-gray">
                        {b.category || '—'}
                      </td>
                      <td className="py-3 pr-4 align-middle">
                        {b.archived ? (
                          <span className="rounded-full bg-dark-gray/10 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-dark-gray">
                            Archived
                          </span>
                        ) : (
                          <span className="rounded-full bg-hunter-green/10 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-hunter-green">
                            Active
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-4 align-middle text-right">
                        <button
                          type="button"
                          onClick={() => startEdit(b)}
                          className="rounded-full border border-light-gray px-3 py-1 text-xs font-semibold text-hunter-green transition-colors hover:border-hunter-green hover:bg-hunter-green/10 mr-2"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(b.key)}
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
            {editingKey === '__new__' ? 'Badge baru' : 'Edit badge'}
          </h2>
          {!editing ? (
            <p className="text-sm text-dark-gray">
              Pilih <strong>Edit</strong> pada baris untuk mengubah badge,
              atau klik <strong>+ Badge baru</strong> untuk membuat entri baru.
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
                <span className={FIELD_LABEL_CLS}>Key</span>
                <input
                  type="text"
                  value={form.key}
                  readOnly
                  disabled
                  placeholder="auto-generated dari deskripsi"
                  maxLength={60}
                  className={`${INPUT_CLS} cursor-not-allowed bg-off-white opacity-80`}
                />
                <span className="text-[0.65rem] text-dark-gray">
                  Otomatis dari deskripsi (huruf kecil, tanpa spasi).
                </span>
              </label>
              <label className="flex flex-col gap-1">
                <span className={FIELD_LABEL_CLS}>Label</span>
                <input
                  type="text"
                  value={form.label}
                  onChange={(e) => {
                    const nextLabel = e.target.value;
                    setForm((prev) => {
                      if (editingKey !== '__new__') {
                        return { ...prev, label: nextLabel };
                      }
                      const source = prev.description.trim() || nextLabel;
                      return { ...prev, label: nextLabel, key: slugify(source) };
                    });
                  }}
                  placeholder="e.g. Basic Forehand"
                  maxLength={80}
                  required
                  className={INPUT_CLS}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className={FIELD_LABEL_CLS}>Tipe</span>
                <select
                  value={form.type}
                  onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as 'skill' | 'achievement' }))}
                  className={INPUT_CLS}
                >
                  <option value="skill">Skill (memengaruhi level)</option>
                  <option value="achievement">Achievement (tidak memengaruhi level)</option>
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className={FIELD_LABEL_CLS}>Icon (emoji)</span>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={form.icon}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, icon: e.target.value.slice(0, 4) }))
                    }
                    placeholder="🏅"
                    maxLength={4}
                    className={INPUT_CLS}
                  />
                  <EmojiPicker value={form.icon} onChange={(emoji) => setForm((prev) => ({ ...prev, icon: emoji }))} />
                </div>
              </label>
              <label className="flex flex-col gap-1">
                <span className={FIELD_LABEL_CLS}>Kategori</span>
                <input
                  type="text"
                  value={form.category}
                  onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                  placeholder="e.g. Groundstroke, Serve, Match, Milestone"
                  maxLength={40}
                  className={INPUT_CLS}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className={FIELD_LABEL_CLS}>Deskripsi</span>
                <textarea
                  value={form.description}
                  onChange={(e) => {
                    const nextDesc = e.target.value;
                    setForm((prev) => {
                      if (editingKey !== '__new__') {
                        return { ...prev, description: nextDesc };
                      }
                      const source = nextDesc.trim() || prev.label.trim();
                      return { ...prev, description: nextDesc, key: slugify(source) };
                    });
                  }}
                  rows={3}
                  maxLength={200}
                  className={INPUT_CLS}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className={FIELD_LABEL_CLS}>Kriteria Perolehan</span>
                <textarea
                  value={form.earningCriteria}
                  onChange={(e) => setForm((p) => ({ ...p, earningCriteria: e.target.value }))}
                  rows={2}
                  maxLength={200}
                  placeholder="e.g. Player mengikuti Basic Forehand Coaching dan dinyatakan memenuhi standar oleh Coach/Admin"
                  className={INPUT_CLS}
                />
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.archived}
                  onChange={(e) => setForm((p) => ({ ...p, archived: e.target.checked }))}
                  className="h-4 w-4 rounded border-light-gray text-hunter-green focus:ring-hunter-green"
                />
                <span className="text-xs text-dark-gray">Arsipkan (tidak muncul untuk user baru)</span>
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