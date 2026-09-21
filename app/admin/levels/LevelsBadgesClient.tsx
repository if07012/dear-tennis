'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type { LevelRecord, LevelBadgeRecord, BadgeCatalogRecord } from '@/data/tennis-level-types';

const FIELD_LABEL_CLS =
  'text-xs font-semibold uppercase tracking-wider text-dark-gray';
const INPUT_CLS =
  'w-full rounded-lg border border-light-gray bg-white px-3 py-2 text-sm focus:border-hunter-green focus:outline-none';

type Toast =
  | { kind: 'idle' }
  | { kind: 'saved'; at: number }
  | { kind: 'error'; message: string };

export function LevelsBadgesClient({
  initialLevels,
  initialBadges,
}: {
  initialLevels: LevelRecord[];
  initialBadges: BadgeCatalogRecord[];
}) {
  const { user } = useAuth();
  const [levels, setLevels] = useState<LevelRecord[]>(initialLevels);
  const [badges, setBadges] = useState<BadgeCatalogRecord[]>(initialBadges);
  const [selectedLevelId, setSelectedLevelId] = useState<string | null>(null);
  const [levelBadges, setLevelBadges] = useState<string[]>([]);
  const [status, setStatus] = useState<Toast>({ kind: 'idle' });
  const [saving, setSaving] = useState(false);

  const refreshLevels = useCallback(async () => {
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

  const refreshLevelBadges = useCallback(async (levelId: string) => {
    try {
      const res = await fetch(`/api/admin/levels/badges?levelId=${encodeURIComponent(levelId)}`, {
        headers: { 'x-auth-email': user?.email ?? '' },
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { badgeKeys: string[] };
      setLevelBadges(body.badgeKeys ?? []);
    } catch (e) {
      setStatus({
        kind: 'error',
        message: e instanceof Error ? e.message : 'Gagal memuat badge requirement',
      });
    }
  }, [user?.email]);

  useEffect(() => {
    if (selectedLevelId) {
      refreshLevelBadges(selectedLevelId);
    } else {
      setLevelBadges([]);
    }
  }, [selectedLevelId, refreshLevelBadges]);

  useEffect(() => {
    if (status.kind !== 'saved') return;
    const id = window.setTimeout(() => setStatus({ kind: 'idle' }), 1200);
    return () => window.clearTimeout(id);
  }, [status]);

  const skillBadges = useMemo(
    () => badges.filter((b) => b.type === 'skill' && !b.archived),
    [badges],
  );

  const handleLevelChange = (levelId: string | null) => {
    setSelectedLevelId(levelId);
  };

  const handleBadgeToggle = (badgeKey: string) => {
    setLevelBadges((prev) =>
      prev.includes(badgeKey)
        ? prev.filter((k) => k !== badgeKey)
        : [...prev, badgeKey],
    );
  };

  const save = async () => {
    if (!selectedLevelId) return;
    setSaving(true);
    setStatus({ kind: 'idle' });
    try {
      const res = await fetch('/api/admin/levels/badges', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-auth-email': user?.email ?? '',
        },
        body: JSON.stringify({
          levelId: selectedLevelId,
          badgeKeys: levelBadges,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      await refreshLevels();
      setStatus({ kind: 'saved', at: Date.now() });
    } catch (e) {
      setStatus({
        kind: 'error',
        message: e instanceof Error ? e.message : 'Gagal menyimpan badge requirement',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container-base section-padding">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-hunter-green">
            Level Badge Requirements
          </h1>
          <p className="text-sm text-dark-gray">
            Konfigurasi skill badge yang diperlukan untuk tiap level. Player naik level otomatis saat semua skill badge terpenuhi.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <section className="rounded-2xl border border-light-gray bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-serif text-lg font-semibold text-hunter-green">Pilih Level</h2>
          <ul className="space-y-2 max-h-96 overflow-y-auto">
            {levels.length === 0 ? (
              <li className="text-center text-dark-gray py-8">Belum ada level. Buat level di halaman Player Levels.</li>
            ) : (
              levels.map((l) => (
                <li key={l.id}>
                  <button
                    type="button"
                    onClick={() => handleLevelChange(l.id)}
                    className={`w-full text-left rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      selectedLevelId === l.id
                        ? 'bg-hunter-green/10 text-hunter-green border border-hunter-green/30'
                        : 'text-dark-gray hover:bg-off-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{l.name}</span>
                      <span className="font-mono text-xs text-dark-gray">Order {l.order}</span>
                    </div>
                    <div className="text-xs text-dark-gray/70 truncate whitespace-pre-wrap mt-0.5">{l.description || '—'}</div>
                  </button>
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="rounded-2xl border border-light-gray bg-white p-6 shadow-sm">
          {selectedLevelId ? (
            <>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-serif text-lg font-semibold text-hunter-green">
                  Skill Badge untuk: {levels.find((l) => l.id === selectedLevelId)?.name || 'Level'}
                </h2>
                <button
                  type="button"
                  onClick={save}
                  disabled={saving}
                  className="rounded-full bg-paprika px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-paprika-hover disabled:opacity-50"
                >
                  {saving ? 'Menyimpan…' : 'Simpan'}
                </button>
              </div>
              <p className="mb-4 text-xs text-dark-gray">
                Centang skill badge yang diperlukan untuk level ini. Player harus memiliki SEMUA badge tercentang untuk mencapai level ini.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
                {skillBadges.length === 0 ? (
                  <div className="col-span-full text-center text-dark-gray py-8">
                    Belum ada skill badge. Tambahkan di halaman <strong>Badge Catalog</strong> dengan tipe Skill.
                  </div>
                ) : (
                  skillBadges.map((b) => (
                    <label
                      key={b.key}
                      className={`flex items-center gap-2 rounded-lg p-3 border transition-colors cursor-pointer ${
                        levelBadges.includes(b.key)
                          ? 'border-hunter-green/30 bg-hunter-green/5'
                          : 'border-light-gray hover:border-hunter-green/30'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={levelBadges.includes(b.key)}
                        onChange={() => handleBadgeToggle(b.key)}
                        className="h-4 w-4 rounded border-light-gray text-hunter-green focus:ring-hunter-green"
                      />
                      <span className="text-2xl" aria-hidden="true">{b.icon || '🏅'}</span>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-hunter-green truncate whitespace-pre-wrap">{b.label}</p>
                        <p className="text-[0.65rem] text-dark-gray/70 truncate whitespace-pre-wrap">{b.category || '—'}</p>
                      </div>
                    </label>
                  ))
                )}
              </div>
              {status.kind !== 'idle' && (
                <div className="mt-4">
                  <ToastBadge status={status} />
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12">
              <p className="text-dark-gray">Pilih level di kiri untuk mengkonfigurasi badge requirement.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function ToastBadge({ status }: { status: Toast }) {
  if (status.kind === 'idle') return null;
  if (status.kind === 'saved') {
    return (
      <p className="rounded-full bg-hunter-green/10 px-3 py-1 text-center text-xs font-semibold text-hunter-green">
        Tersimpan
      </p>
    );
  }
  return (
    <p className="rounded-full bg-paprika/10 px-3 py-1 text-center text-xs font-semibold text-paprika">
      {status.message}
    </p>
  );
}