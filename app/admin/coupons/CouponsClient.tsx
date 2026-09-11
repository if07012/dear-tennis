'use client';

// Admin coupon manager: create/edit codes (code, %, target activity,
// active), delete, and view every claim — which member got which discount
// on which activity.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SearchIcon, XIcon } from '@/components/ui/Icons';
import { useAuth } from '@/hooks/useAuth';
import type { Coupon, CouponClaim } from '@/data/coupons-types';

type Props = {
  initialCoupons: Coupon[];
  initialClaims: CouponClaim[];
  activities: { id: string; title: string }[];
};

type SaveStatus =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved'; at: number }
  | { kind: 'error'; message: string };

type DraftCoupon = {
  id: string; // 'draft-…' for new rows
  code: string;
  discountPct: number;
  activityId: string; // '' = any activity
  userEmail: string; // '' = anyone
  active: boolean;
  expiresAt: string; // yyyy-mm-dd; '' = never expires
};

// 10 random chars, A–Z + 0–9. Guaranteed to include at least one digit
// and one letter so every generated code reads as alphanumeric.
function generateCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code: string;
  do {
    const bytes = new Uint32Array(10);
    crypto.getRandomValues(bytes);
    code = Array.from(bytes, (b) => chars[b % chars.length]).join('');
  } while (!/[0-9]/.test(code) || !/[A-Z]/.test(code));
  return code;
}

const FIELD_LABEL_CLS = 'text-xs font-semibold uppercase tracking-wider text-dark-gray';
const INPUT_CLS =
  'w-full rounded-lg border border-light-gray bg-white px-3 py-2 text-sm focus:border-hunter-green focus:outline-none';
export function CouponsClient({ initialCoupons, initialClaims, activities }: Props) {
  const { user } = useAuth();
  const [coupons, setCoupons] = useState<Coupon[]>(initialCoupons);
  const [claims, setClaims] = useState<CouponClaim[]>(initialClaims);
  const [status, setStatus] = useState<SaveStatus>({ kind: 'idle' });
  const [editing, setEditing] = useState<DraftCoupon | null>(null);

  const activityTitle = useMemo(() => {
    const m = new Map(activities.map((a) => [a.id, a.title]));
    return (id: string) => m.get(id) ?? id;
  }, [activities]);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/coupons/claims', {
        headers: { 'x-auth-email': user?.email ?? '' },
        cache: 'no-store',
      });
      if (!res.ok) return;
      const body = (await res.json()) as {
        coupons: Coupon[];
        claims: CouponClaim[];
      };
      setCoupons(body.coupons);
      setClaims(body.claims);
    } catch {
      // Keep current lists — a refresh failure is non-fatal.
    }
  }, [user?.email]);

  useEffect(() => {
    if (status.kind !== 'saved') return;
    const t = setTimeout(() => setStatus({ kind: 'idle' }), 2500);
    return () => clearTimeout(t);
  }, [status]);

  const save = async (draft: DraftCoupon) => {
    setStatus({ kind: 'saving' });
    try {
      const res = await fetch('/api/coupons', {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          'x-auth-email': user?.email ?? '',
        },
        body: JSON.stringify({
          kind: 'coupon',
          coupon: {
            id: draft.id.startsWith('draft-') ? undefined : draft.id,
            code: draft.code,
            discountPct: draft.discountPct,
            activityId: draft.activityId,
            userEmail: draft.userEmail,
            active: draft.active,
            expiresAt: draft.expiresAt,
          },
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setEditing(null);
      await refresh();
      setStatus({ kind: 'saved', at: Date.now() });
    } catch (e) {
      setStatus({
        kind: 'error',
        message: e instanceof Error ? e.message : 'Failed to save',
      });
    }
  };

  const remove = async (coupon: Coupon) => {
    if (!window.confirm(`Hapus kupon ${coupon.code}? Klaim lama tetap tersimpan.`)) return;
    setStatus({ kind: 'saving' });
    try {
      const res = await fetch('/api/coupons', {
        method: 'DELETE',
        headers: {
          'content-type': 'application/json',
          'x-auth-email': user?.email ?? '',
        },
        body: JSON.stringify({ id: coupon.id }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      await refresh();
      setStatus({ kind: 'saved', at: Date.now() });
    } catch (e) {
      setStatus({
        kind: 'error',
        message: e instanceof Error ? e.message : 'Failed to delete',
      });
    }
  };

  const openCreate = () => {
    setEditing({
      id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      code: generateCode(),
      discountPct: 10,
      activityId: '',
      userEmail: '',
      active: true,
      expiresAt: '',
    });
  };

  const openEdit = (c: Coupon) => {
    setEditing({
      id: c.id,
      code: c.code,
      discountPct: c.discountPct,
      activityId: c.activityId,
      userEmail: c.userEmail,
      active: c.active,
      expiresAt: c.expiresAt,
    });
  };

  return (
    <div className="container-base section-padding">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-paprika">
            Admin
          </p>
          <h1 className="font-serif text-3xl font-bold text-hunter-green">Coupons</h1>
          <p className="mt-1 text-sm text-dark-gray">
            Buat kode diskon; discount tercatat saat member klaim kodenya.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={openCreate}
            className="rounded-full bg-paprika px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-white transition-colors hover:bg-paprika-hover"
          >
            + Kupon baru
          </button>
          <SaveBadge status={status} />
        </div>
      </header>

      <section className="rounded-2xl border border-light-gray bg-white p-6">
        <h2 className="mb-4 font-serif text-xl font-semibold text-hunter-green">
          Semua Kupon ({coupons.length})
        </h2>
        {coupons.length === 0 ? (
          <p className="text-sm text-dark-gray">Belum ada kupon.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-light-gray text-left text-xs font-semibold uppercase tracking-wider text-dark-gray">
                  <th className="py-3 pr-4">Kode</th>
                  <th className="py-3 pr-4">Diskon</th>
                  <th className="py-3 pr-4">Activity</th>
                  <th className="py-3 pr-4">Khusus member</th>
                  <th className="py-3 pr-4">Kedaluwarsa</th>
                  <th className="py-3 pr-4">Status</th>
                  <th className="py-3 pr-4">Diklaim</th>
                  <th className="py-3 pr-4" />
                </tr>
              </thead>
              <tbody>
                {coupons.map((c) => {
                  const claimCount = claims.filter((cl) => cl.couponId === c.id).length;
                  const expired =
                    c.expiresAt !== '' &&
                    new Date(c.expiresAt).getTime() + 24 * 60 * 60 * 1000 <= Date.now();
                  return (
                    <tr key={c.id} className="border-b border-light-gray/60">
                      <td className="py-3 pr-4 font-bold uppercase tracking-wider text-hunter-green">
                        {c.code}
                      </td>
                      <td className="py-3 pr-4 font-semibold text-paprika">
                        {c.discountPct}%
                      </td>
                      <td className="py-3 pr-4 text-dark-gray">
                        {c.activityId ? activityTitle(c.activityId) : 'Semua activity'}
                      </td>
                      <td className="py-3 pr-4 text-dark-gray">
                        {c.userEmail || 'Semua member'}
                      </td>
                      <td className="py-3 pr-4 text-dark-gray">
                        {c.expiresAt
                          ? new Date(c.expiresAt).toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })
                          : 'Selamanya'}
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={[
                            'rounded-full px-2.5 py-0.5 text-xs font-semibold',
                            !c.active || expired
                              ? 'bg-light-gray text-dark-gray'
                              : 'bg-hunter-green/10 text-hunter-green',
                          ].join(' ')}
                        >
                          {expired ? 'Kadaluarsa' : c.active ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-dark-gray">{claimCount}×</td>
                      <td className="py-3 pr-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEdit(c)}
                            className="rounded-full border border-hunter-green px-3 py-1 text-xs font-semibold text-hunter-green transition-colors hover:bg-hunter-green hover:text-white"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => remove(c)}
                            className="rounded-full border border-paprika px-3 py-1 text-xs font-semibold text-paprika transition-colors hover:bg-paprika hover:text-white"
                          >
                            Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-8 rounded-2xl border border-light-gray bg-white p-6">
        <h2 className="mb-4 font-serif text-xl font-semibold text-hunter-green">
          Klaim Member ({claims.length})
        </h2>
        <p className="mb-4 text-xs text-dark-gray">
          Diskon yang didapat setiap member saat mereka klaim kupon.
        </p>
        {claims.length === 0 ? (
          <p className="text-sm text-dark-gray">Belum ada klaim.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-light-gray text-left text-xs font-semibold uppercase tracking-wider text-dark-gray">
                  <th className="py-3 pr-4">Kode</th>
                  <th className="py-3 pr-4">Member</th>
                  <th className="py-3 pr-4">Activity</th>
                  <th className="py-3 pr-4">Diskon didapat</th>
                  <th className="py-3 pr-4">Waktu klaim</th>
                </tr>
              </thead>
              <tbody>
                {claims.map((cl) => (
                  <tr key={cl.id} className="border-b border-light-gray/60">
                    <td className="py-3 pr-4 font-bold uppercase tracking-wider text-hunter-green">
                      {cl.code}
                    </td>
                    <td className="py-3 pr-4 text-dark-gray">{cl.userEmail}</td>
                    <td className="py-3 pr-4 text-dark-gray">
                      {cl.activityId ? activityTitle(cl.activityId) : '—'}
                    </td>
                    <td className="py-3 pr-4 font-semibold text-paprika">
                      {cl.discountPct}%
                    </td>
                    <td className="py-3 pr-4 text-xs text-dark-gray">
                      {new Date(cl.claimedAt).toLocaleString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false,
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editing && (
        <CouponEditDrawer
          draft={editing}
          authEmail={user?.email ?? ''}
          activityTitleFor={activityTitle}
          onCancel={() => setEditing(null)}
          onSave={save}
        />
      )}
    </div>
  );
}

function CouponEditDrawer({
  draft,
  authEmail,
  activityTitleFor,
  onCancel,
  onSave,
}: {
  draft: DraftCoupon;
  authEmail: string;
  activityTitleFor: (id: string) => string;
  onCancel: () => void;
  onSave: (draft: DraftCoupon) => void | Promise<void>;
}) {
  const [state, setState] = useState(draft);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (state.code.trim().length === 0) return;
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
        className="w-full max-w-md rounded-t-2xl bg-white p-6 shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-xl font-semibold text-hunter-green">
            {state.id.startsWith('draft-') ? 'Kupon baru' : `Edit ${draft.code}`}
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
          <label className="flex flex-col gap-1">
            <span className={FIELD_LABEL_CLS}>Kode</span>
            <div className="flex gap-2">
              <input
                type="text"
                value={state.code}
                onChange={(e) =>
                  setState((p) => ({ ...p, code: e.target.value.toUpperCase() }))
                }
                placeholder="e.g. TENNIS10"
                className={INPUT_CLS}
                required
              />
              <button
                type="button"
                onClick={() => setState((p) => ({ ...p, code: generateCode() }))}
                title="Buat kode acak (10 karakter huruf & angka)"
                className="shrink-0 rounded-lg border border-hunter-green px-3 py-2 text-xs font-semibold text-hunter-green transition-colors hover:bg-hunter-green hover:text-white"
              >
                Generate
              </button>
            </div>
          </label>
          <label className="flex flex-col gap-1">
            <span className={FIELD_LABEL_CLS}>Diskon (%)</span>
            <input
              type="number"
              min={1}
              max={100}
              value={state.discountPct}
              onChange={(e) =>
                setState((p) => ({
                  ...p,
                  discountPct: Math.max(1, Math.min(100, Number(e.target.value) || 0)),
                }))
              }
              className={INPUT_CLS}
              required
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={FIELD_LABEL_CLS}>Kedaluwarsa (opsional)</span>
            <input
              type="date"
              value={state.expiresAt}
              onChange={(e) => setState((p) => ({ ...p, expiresAt: e.target.value }))}
              className={INPUT_CLS}
            />
            <span className="text-xs text-dark-gray/70">
              Kosongkan agar kupon berlaku selamanya.
            </span>
          </label>
          <label className="flex flex-col gap-1">
            <span className={FIELD_LABEL_CLS}>Berlaku untuk</span>
            <RemoteSearchSelect
              type="activity"
              authEmail={authEmail}
              value={state.activityId}
              selectedLabel={activityTitleFor(state.activityId)}
              emptyOption="Semua activity"
              placeholder="Cari activity..."
              onChange={(v) => setState((p) => ({ ...p, activityId: v }))}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={FIELD_LABEL_CLS}>Khusus member (opsional)</span>
            <RemoteSearchSelect
              type="member"
              authEmail={authEmail}
              value={state.userEmail}
              selectedLabel={state.userEmail}
              emptyOption="Semua member"
              placeholder="Cari nama atau email..."
              onChange={(v) => setState((p) => ({ ...p, userEmail: v }))}
            />
            <span className="text-xs text-dark-gray/70">
              Pilih member agar kupon hanya bisa diklaim oleh mereka.
            </span>
          </label>
          <label className="mt-1 flex items-center gap-3 rounded-lg border border-light-gray bg-off-white px-3 py-2.5">
            <input
              type="checkbox"
              checked={state.active}
              onChange={(e) => setState((p) => ({ ...p, active: e.target.checked }))}
              className="h-4 w-4 cursor-pointer rounded border-light-gray text-paprika focus:ring-paprika"
            />
            <span className="text-xs font-semibold uppercase tracking-wider text-dark-gray">
              Aktif (bisa diklaim member)
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
            disabled={saving || state.code.trim().length === 0}
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
    return <span className="text-xs text-dark-gray">Belum ada perubahan</span>;
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

// Debounced server-side search dropdown. `type` selects the endpoint's
// dataset (activity | member). `selectedLabel` shows the saved value even
// when it is not in the current result page. `emptyOption` renders a
// "Semua activity"-style reset row.
function RemoteSearchSelect({
  type,
  authEmail,
  value,
  selectedLabel,
  emptyOption,
  placeholder,
  onChange,
}: {
  type: 'activity' | 'member';
  authEmail: string;
  value: string;
  selectedLabel: string;
  emptyOption: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [items, setItems] = useState<{ id: string; label: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [dirty, setDirty] = useState(false); // results match current q
  const boxRef = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Debounced fetch.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ type, q: q.trim() });
        const res = await fetch(`/api/coupons/search?${params.toString()}`, {
          headers: { 'x-auth-email': authEmail },
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as { items: { id: string; label: string }[] };
        if (!cancelled) {
          setItems(body.items ?? []);
          setDirty(true);
        }
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
      setLoading(false);
    };
  }, [open, type, q, authEmail]);

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`${INPUT_CLS} flex items-center justify-between text-left`}
      >
        <span className={`truncate ${value ? '' : 'text-dark-gray/60'}`}>
          {value ? selectedLabel : emptyOption}
        </span>
        <span aria-hidden="true" className="ml-2 shrink-0 text-xs text-dark-gray">▾</span>
      </button>
      {open && (
        <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-light-gray bg-white shadow-xl">
          <label className="flex items-center gap-2 border-b border-light-gray px-3 py-2">
            <SearchIcon size={14} className="text-dark-gray" />
            <input
              type="search"
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={placeholder}
              className="w-full border-0 bg-transparent text-sm focus:outline-none"
            />
          </label>
          <div className="max-h-56 overflow-y-auto">
            <button
              type="button"
              onClick={() => {
                onChange('');
                setOpen(false);
              }}
              className="block w-full px-3 py-2 text-left text-sm text-dark-gray hover:bg-hunter-green/5"
            >
              {emptyOption}
            </button>
            {loading && !dirty && <p className="px-3 py-2 text-xs text-dark-gray">Memuat...</p>}
            {dirty &&
              !loading &&
              items.length === 0 && (
                <p className="px-3 py-2 text-xs text-dark-gray">Tidak ada hasil.</p>
              )}
            {items.map((it) => (
              <button
                key={it.id}
                type="button"
                onClick={() => {
                  onChange(it.id);
                  setOpen(false);
                }}
                className={[
                  'block w-full truncate px-3 py-2 text-left text-sm hover:bg-hunter-green/5',
                  it.id === value ? 'font-semibold text-hunter-green' : 'text-graphite',
                ].join(' ')}
              >
                {it.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
