'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type { BadgeCatalogRecord, BadgeGrantRecord, GrantedBadge } from '@/data/tennis-level-types';

const FIELD_LABEL_CLS =
  'text-xs font-semibold uppercase tracking-wider text-dark-gray';
const INPUT_CLS =
  'w-full rounded-lg border border-light-gray bg-white px-3 py-2 text-sm focus:border-hunter-green focus:outline-none';

type Toast =
  | { kind: 'idle' }
  | { kind: 'saved'; at: number }
  | { kind: 'error'; message: string };

export function AwardBadgeDialog({
  user,
  catalog,
  open,
  onClose,
  onSuccess,
}: {
  user: { email: string; name: string };
  catalog: BadgeCatalogRecord[];
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { user: authUser } = useAuth();
  const [selectedBadgeKey, setSelectedBadgeKey] = useState<string>('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setSelectedBadgeKey('');
      setNote('');
      setError(null);
    }
  }, [open]);

  const handleAward = async () => {
    if (!selectedBadgeKey) {
      setError('Pilih badge terlebih dahulu');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/badges/award', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-auth-email': authUser?.email ?? '',
        },
        body: JSON.stringify({
          userEmail: user.email,
          badgeKey: selectedBadgeKey,
          note,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      onSuccess();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memberikan badge');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const skillBadges = catalog.filter((b) => b.type === 'skill' && !b.archived);
  const achievementBadges = catalog.filter((b) => b.type === 'achievement' && !b.archived);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-label={`Berikan badge untuk ${user.name || user.email}`}
    >
      <div className="w-full max-w-md mx-4 rounded-2xl border border-light-gray bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-lg font-semibold text-hunter-green">
            Berikan Badge: {user.name || user.email}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-md p-1 text-dark-gray transition-colors hover:bg-light-gray disabled:opacity-50"
            aria-label="Tutup"
          >
            ✕
          </button>
        </div>

        {error && (
          <p className="mb-4 rounded-full bg-paprika/10 px-3 py-1 text-center text-xs font-semibold text-paprika">
            {error}
          </p>
        )}

        <div className="space-y-4">
          <label className="flex flex-col gap-1">
            <span className={FIELD_LABEL_CLS}>Badge</span>
            <select
              value={selectedBadgeKey}
              onChange={(e) => setSelectedBadgeKey(e.target.value)}
              disabled={saving}
              className={INPUT_CLS}
            >
              <option value="">Pilih badge...</option>
              <optgroup label="Skill Badge (memengaruhi level)">
                {skillBadges.map((b) => (
                  <option key={b.key} value={b.key}>
                    {b.icon || '🏅'} {b.label} ({b.category})
                  </option>
                ))}
              </optgroup>
              <optgroup label="Achievement Badge">
                {achievementBadges.map((b) => (
                  <option key={b.key} value={b.key}>
                    {b.icon || '🏅'} {b.label} ({b.category})
                  </option>
                ))}
              </optgroup>
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className={FIELD_LABEL_CLS}>Catatan / Alasan</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={200}
              placeholder="e.g. Completed Basic Forehand Coaching"
              className={INPUT_CLS}
            />
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-full border border-light-gray px-3 py-1 text-xs font-semibold text-dark-gray transition-colors hover:border-dark-gray disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleAward}
            disabled={saving || !selectedBadgeKey}
            className="rounded-full bg-paprika px-4 py-1 text-xs font-semibold text-white transition-colors hover:bg-paprika-hover disabled:opacity-50"
          >
            {saving ? 'Menyimpan…' : 'Berikan Badge'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function RevokeBadgeDialog({
  grant,
  catalog,
  open,
  onClose,
  onSuccess,
}: {
  grant: GrantedBadge;
  catalog: BadgeCatalogRecord[];
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { user: authUser } = useAuth();
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setNote('');
      setError(null);
    }
  }, [open]);

  const handleRevoke = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/badges/revoke', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-auth-email': authUser?.email ?? '',
        },
        body: JSON.stringify({
          userEmail: grant.userEmail,
          badgeKey: grant.key,
          note,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      onSuccess();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal mencabut badge');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-label={`Cabut badge ${grant.label}`}
    >
      <div className="w-full max-w-md mx-4 rounded-2xl border border-light-gray bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-lg font-semibold text-paprika">
            Cabut Badge
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-md p-1 text-dark-gray transition-colors hover:bg-light-gray disabled:opacity-50"
            aria-label="Tutup"
          >
            ✕
          </button>
        </div>

        <div className="mb-4 flex items-center gap-3 p-3 rounded-lg border border-light-gray bg-off-white">
          <span className="text-2xl" aria-hidden="true">{grant.icon || '🏅'}</span>
          <div>
            <p className="font-medium text-hunter-green">{grant.label}</p>
            <p className="text-xs text-dark-gray">
              Tipe: {grant.type === 'skill' ? 'Skill' : 'Achievement'} · Kategori: {grant.category || '—'}
            </p>
            <p className="text-xs text-dark-gray">
              Diberikan: {new Date(grant.grantedAt).toLocaleString('id-ID')} oleh {grant.grantedBy}
            </p>
          </div>
        </div>

        {error && (
          <p className="mb-4 rounded-full bg-paprika/10 px-3 py-1 text-center text-xs font-semibold text-paprika">
            {error}
          </p>
        )}

        <label className="flex flex-col gap-1">
          <span className={FIELD_LABEL_CLS}>Alasan Pencabutan</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={200}
            placeholder="e.g. Failed reassessment"
            className={INPUT_CLS}
          />
        </label>

        <p className="text-xs text-paprika/80">
          {grant.type === 'skill'
            ? '⚠️ Pencabutan skill badge mungkin menurunkan level pemain.'
            : 'Pencabutan achievement badge tidak memengaruhi level pemain.'}
        </p>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-full border border-light-gray px-3 py-1 text-xs font-semibold text-dark-gray transition-colors hover:border-dark-gray disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleRevoke}
            disabled={saving}
            className="rounded-full bg-paprika px-4 py-1 text-xs font-semibold text-white transition-colors hover:bg-paprika-hover disabled:opacity-50"
          >
            {saving ? 'Mencabut…' : 'Cabut Badge'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function BadgeHistoryDialog({
  grants,
  open,
  onClose,
}: {
  grants: (BadgeGrantRecord & { badge?: BadgeCatalogRecord })[];
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  const sorted = [...grants].sort(
    (a, b) => (a.grantedAt < b.grantedAt ? 1 : a.grantedAt > b.grantedAt ? -1 : 0)
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-label="Riwayat Badge"
    >
      <div className="w-full max-w-lg mx-4 rounded-2xl border border-light-gray bg-white p-6 shadow-xl max-h-[80vh] flex flex-col">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-lg font-semibold text-hunter-green">Riwayat Badge</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-dark-gray transition-colors hover:bg-light-gray"
            aria-label="Tutup"
          >
            ✕
          </button>
        </div>

        {sorted.length === 0 ? (
          <p className="text-center text-dark-gray py-8">Belum ada riwayat badge.</p>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-3">
            {sorted.map((g, idx) => (
              <div
                key={`${g.badgeKey}-${g.grantedAt}-${idx}`}
                className={`rounded-lg border p-3 ${
                  g.status === 'active'
                    ? 'border-hunter-green/30 bg-hunter-green/5'
                    : 'border-paprika/30 bg-paprika/5'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {g.badge && <span className="text-xl" aria-hidden="true">{g.badge.icon || '🏅'}</span>}
                    <div>
                      <p className="font-medium text-hunter-green">{g.badge?.label || g.badgeKey}</p>
                      <p className="text-xs text-dark-gray">
                        {g.badge?.type === 'skill' ? 'Skill Badge' : 'Achievement Badge'}
                        {g.badge?.category && ` · ${g.badge.category}`}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider ${
                      g.status === 'active'
                        ? 'bg-hunter-green/10 text-hunter-green'
                        : 'bg-paprika/10 text-paprika'
                    }`}
                  >
                    {g.status === 'active' ? 'Aktif' : 'Dicabut'}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-1 text-xs text-dark-gray">
                  <div>Diberikan: {new Date(g.grantedAt).toLocaleString('id-ID')}</div>
                  <div>Oleh: {g.grantedBy}</div>
                  {g.revokedAt && (
                    <>
                      <div>Dicabut: {new Date(g.revokedAt).toLocaleString('id-ID')}</div>
                      <div>Oleh: {g.revokedBy || '—'}</div>
                    </>
                  )}
                  {g.note && (
                    <div className="col-span-2">Catatan: {g.note}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}