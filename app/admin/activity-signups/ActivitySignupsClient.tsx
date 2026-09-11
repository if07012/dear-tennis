'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type { ActivitySignup, SignupStatus } from '@/data/activity-signups-types';
import type { PagedSignups } from '@/lib/activity-signups-store';

const FIELD_LABEL_CLS =
  'text-xs font-semibold uppercase tracking-wider text-dark-gray';
const INPUT_CLS =
  'w-full rounded-lg border border-light-gray bg-white px-3 py-2 text-sm focus:border-hunter-green focus:outline-none';

const STATUS_OPTIONS: { id: SignupStatus | 'all'; label: string }[] = [
  { id: 'pending_approval', label: 'Pending Approval' },
  { id: 'waiting_payment', label: 'Waiting Payment' },
  { id: 'payment_submitted', label: 'Payment Submitted' },
  { id: 'joined', label: 'Joined' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'cancelled', label: 'Cancelled' },
  { id: 'expired', label: 'Expired' },
  { id: 'all', label: 'All' },
];

const STATUS_BADGE: Record<SignupStatus, string> = {
  pending_approval: 'bg-amber-100 text-amber-800',
  waiting_payment: 'bg-sky-100 text-sky-800',
  payment_submitted: 'bg-teal/10 text-teal',
  joined: 'bg-hunter-green/10 text-hunter-green',
  rejected: 'bg-paprika/10 text-paprika',
  cancelled: 'bg-dark-gray/10 text-dark-gray',
  expired: 'bg-dark-gray/10 text-dark-gray',
};

function formatRupiah(amount: number): string {
  if (!amount) return '—';
  return `Rp${amount.toLocaleString('id-ID')}`;
}

type Row = ActivitySignup & { activityTitle?: string };

type Toast =
  | { kind: 'idle' }
  | { kind: 'saved'; at: number }
  | { kind: 'error'; message: string };

type Props = {
  initial: PagedSignups & { items: Row[] };
  initialStatus: SignupStatus | 'all';
  pageSize: number;
  activityId?: string;
};

function formatDate(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

type PatchAction =
  | 'approve'
  | 'reject'
  | 'approve-payment'
  | 'reject-payment';

export function ActivitySignupsClient({
  initial,
  initialStatus,
  pageSize,
  activityId,
}: Props) {
  const { user } = useAuth();
  const [items, setItems] = useState<Row[]>(initial.items);
  const [countsByStatus, setCountsByStatus] = useState<
    Record<string, number> | undefined
  >(undefined);
  const [total, setTotal] = useState(initial.total);
  const [page, setPage] = useState(initial.page);
  const [totalPages, setTotalPages] = useState(initial.totalPages);
  const [status, setStatus] = useState<SignupStatus | 'all'>(initialStatus);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast>({ kind: 'idle' });
  // Payment reject flow: which row's reason prompt is open + its draft text.
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  // Payment proof viewer: data URL or remote URL, rendered full-size, with
  // the member's note and upload time.
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [proofIsPdf, setProofIsPdf] = useState(false);
  const [proofNote, setProofNote] = useState<string | undefined>(undefined);
  const [proofUploadedAt, setProofUploadedAt] = useState<string | undefined>(undefined);

  const fetchPage = useCallback(
    async (targetPage: number, targetStatus: SignupStatus | 'all') => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(targetPage),
          pageSize: String(pageSize),
          status: targetStatus,
        });
        if (activityId) params.set('activity', activityId);
        const res = await fetch(
          `/api/admin/activity-signups?${params.toString()}`,
          { headers: { 'x-auth-email': user?.email ?? '' } },
        );
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        const body = (await res.json()) as PagedSignups & {
          items: Row[];
          countsByStatus?: Record<string, number>;
        };
        setItems(body.items);
        setCountsByStatus(body.countsByStatus);
        setTotal(body.total);
        setPage(body.page);
        setTotalPages(body.totalPages);
      } catch (e) {
        setToast({
          kind: 'error',
          message: e instanceof Error ? e.message : 'Failed to load signups',
        });
      } finally {
        setLoading(false);
      }
    },
    [user?.email, pageSize, activityId],
  );

  useEffect(() => {
    void fetchPage(page, status);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, status]);

  const changeStatus = (next: SignupStatus | 'all') => {
    setStatus(next);
    setPage(1);
  };

  const decide = async (target: Row, action: PatchAction, reason?: string) => {
    setBusyId(target.id);
    setToast({ kind: 'idle' });
    try {
      const res = await fetch('/api/admin/activity-signups', {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          'x-auth-email': user?.email ?? '',
        },
        body: JSON.stringify({ id: target.id, action, reason }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      // Refetch current page so the table reflects removal/reclassification
      // without us having to track which status bucket the row landed in.
      await fetchPage(page, status);
      setToast({ kind: 'saved', at: Date.now() });
    } catch (e) {
      setToast({
        kind: 'error',
        message: e instanceof Error ? e.message : 'Failed to update',
      });
    } finally {
      setBusyId(null);
      setRejectingId(null);
      setRejectReason('');
    }
  };

  const remove = async (target: Row) => {
    if (!window.confirm(`Hapus pendaftaran dari ${target.userEmail}?`)) return;
    setBusyId(target.id);
    setToast({ kind: 'idle' });
    try {
      const res = await fetch('/api/admin/activity-signups', {
        method: 'DELETE',
        headers: {
          'content-type': 'application/json',
          'x-auth-email': user?.email ?? '',
        },
        body: JSON.stringify({ id: target.id }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      await fetchPage(page, status);
      setToast({ kind: 'saved', at: Date.now() });
    } catch (e) {
      setToast({
        kind: 'error',
        message: e instanceof Error ? e.message : 'Failed to delete',
      });
    } finally {
      setBusyId(null);
    }
  };

  const openProof = (row: Row) => {
    if (!row.paymentProofUrl) return;
    setProofIsPdf(row.paymentProofUrl.startsWith('data:application/pdf'));
    setProofUrl(row.paymentProofUrl);
    setProofNote(row.paymentNote || undefined);
    setProofUploadedAt(row.uploadedAt || undefined);
  };

  const pageStart = (page - 1) * pageSize;

  return (
    <div className="container-base section-padding">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-paprika">
            Admin
          </p>
          <h1 className="font-serif text-3xl font-bold text-hunter-green">
            Activity Signups
          </h1>
          <p className="mt-1 text-sm text-dark-gray">
            Approve pendaftaran, verifikasi bukti pembayaran, dan kelola slot.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ToastBadge toast={toast} />
        </div>
      </header>

      <section className="rounded-2xl border border-light-gray bg-white p-6">
        {activityId && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-hunter-green/30 bg-hunter-green/5 px-3 py-2 text-xs">
            <span className="font-semibold text-hunter-green">
              Filter: hanya signup untuk activity{' '}
              <strong>
                {items[0]?.activityTitle ?? activityId}
              </strong>{' '}
              ({total} baris)
            </span>
            <Link
              href="/admin/activity-signups"
              className="rounded-full border border-hunter-green px-3 py-1 text-[0.7rem] font-semibold text-hunter-green transition-colors hover:bg-hunter-green hover:text-white"
            >
              Lihat semua activity
            </Link>
          </div>
        )}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <span className={FIELD_LABEL_CLS}>Filter status</span>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => changeStatus(opt.id)}
                  className={[
                    'rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
                    status === opt.id
                      ? 'bg-paprika text-white'
                      : 'bg-off-white text-dark-gray hover:bg-light-gray',
                  ].join(' ')}
                >
                  {opt.label}
                  {countsByStatus && (
                    <span
                      className={[
                        'ml-1.5 inline-block rounded-full px-1.5 text-[0.65rem]',
                        status === opt.id
                          ? 'bg-white/25 text-white'
                          : 'bg-light-gray text-dark-gray',
                      ].join(' ')}
                    >
                      {opt.id === 'all'
                        ? Object.values(countsByStatus).reduce((a, b) => a + b, 0)
                        : countsByStatus[opt.id] ?? 0}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs text-dark-gray">
            {total === 0
              ? '0 permintaan'
              : `Menampilkan ${pageStart + 1}–${Math.min(
                  pageStart + pageSize,
                  total,
                )} dari ${total} permintaan`}
          </p>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-light-gray text-left text-xs font-semibold uppercase tracking-wider text-dark-gray">
                <th className="py-3 pr-4">Aktivitas</th>
                <th className="py-3 pr-4">Member</th>
                <th className="py-3 pr-4">Pembayaran</th>
                <th className="py-3 pr-4">Status</th>
                <th className="py-3 pr-4">Diajukan</th>
                <th className="py-3 pr-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading && items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-dark-gray">
                    Memuat...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-dark-gray">
                    Belum ada permintaan untuk filter ini.
                  </td>
                </tr>
              ) : (
                items.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-light-gray/60 last:border-b-0 align-top"
                  >
                    <td className="py-3 pr-4">
                      <div className="font-medium text-hunter-green">
                        {row.activityTitle ?? row.activityId}
                      </div>
                      <div className="mt-0.5 text-[0.65rem] uppercase tracking-wider text-dark-gray">
                        {row.activityId}
                      </div>
                      <div className="mt-0.5 max-w-[240px] text-xs text-dark-gray">
                        {row.message ? (
                          <span className="line-clamp-2 whitespace-pre-wrap">
                            {row.message}
                          </span>
                        ) : (
                          <span className="italic">—</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="font-medium text-graphite">{row.userName || row.userEmail}</div>
                      <div className="text-xs text-dark-gray">{row.userEmail}</div>
                    </td>
                    <td className="py-3 pr-4">
                      {row.originalAmount > 0 ? (
                        <div className="text-xs">
                          <div className="text-dark-gray">
                            Harga: {formatRupiah(row.originalAmount)}
                          </div>
                          {row.couponCode && (
                            <div className="text-teal">
                              Kupon {row.couponCode} (−{row.discountPct}%)
                            </div>
                          )}
                          <div className="font-semibold text-hunter-green">
                            Bayar: {formatRupiah(row.finalAmount)}
                          </div>
                          {row.paymentProofUrl ? (
                            <button
                              type="button"
                              onClick={() => openProof(row)}
                              className="mt-1 rounded-full border border-hunter-green px-2 py-0.5 text-[0.65rem] font-semibold text-hunter-green transition-colors hover:bg-hunter-green hover:text-white"
                            >
                              Lihat bukti
                            </button>
                          ) : (
                            <div className="mt-1 italic text-dark-gray">
                              belum ada bukti
                            </div>
                          )}
                          {row.rejectionReason && (
                            <div className="mt-1 max-w-[220px] text-[0.65rem] text-paprika">
                              Ditolak: {row.rejectionReason}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs italic text-dark-gray">gratis</span>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={[
                          'inline-block rounded-full px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-wider',
                          STATUS_BADGE[row.status],
                        ].join(' ')}
                      >
                        {row.status.replace(/_/g, ' ')}
                      </span>
                      {row.expiresAt && row.status === 'waiting_payment' && (
                        <div className="mt-1 text-[0.65rem] text-dark-gray">
                          Deadline: {formatDate(row.expiresAt)}
                        </div>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-xs text-dark-gray">
                      {formatDate(row.requestedAt)}
                    </td>
                    <td className="py-3 pr-4">
                      {row.status === 'pending_approval' ? (
                        <div className="flex flex-wrap justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => decide(row, 'approve')}
                            disabled={busyId === row.id}
                            className="rounded-full bg-hunter-green px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-hunter-green-dark disabled:opacity-50"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => decide(row, 'reject')}
                            disabled={busyId === row.id}
                            className="rounded-full border border-paprika px-3 py-1 text-xs font-semibold text-paprika transition-colors hover:bg-paprika hover:text-white disabled:opacity-50"
                          >
                            Reject
                          </button>
                          <button
                            type="button"
                            onClick={() => remove(row)}
                            disabled={busyId === row.id}
                            className="rounded-full border border-light-gray px-3 py-1 text-xs font-semibold text-dark-gray transition-colors hover:border-paprika hover:text-paprika disabled:opacity-50"
                          >
                            Hapus
                          </button>
                        </div>
                      ) : row.status === 'payment_submitted' ? (
                        rejectingId === row.id ? (
                          <div className="flex w-56 flex-col gap-2">
                            <textarea
                              value={rejectReason}
                              onChange={(e) => setRejectReason(e.target.value)}
                              placeholder="Alasan penolakan (wajib)"
                              rows={2}
                              maxLength={300}
                              className={INPUT_CLS}
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setRejectingId(null);
                                  setRejectReason('');
                                }}
                                className="rounded-full border border-light-gray px-3 py-1 text-xs font-semibold text-dark-gray"
                              >
                                Batal
                              </button>
                              <button
                                type="button"
                                onClick={() => decide(row, 'reject-payment', rejectReason)}
                                disabled={busyId === row.id || !rejectReason.trim()}
                                className="rounded-full bg-paprika px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
                              >
                                Tolak
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-wrap justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => decide(row, 'approve-payment')}
                              disabled={busyId === row.id}
                              className="rounded-full bg-hunter-green px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-hunter-green-dark disabled:opacity-50"
                            >
                              Approve Payment
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setRejectingId(row.id);
                                setRejectReason('');
                              }}
                              disabled={busyId === row.id}
                              className="rounded-full border border-paprika px-3 py-1 text-xs font-semibold text-paprika transition-colors hover:bg-paprika hover:text-white disabled:opacity-50"
                            >
                              Reject Payment
                            </button>
                          </div>
                        )
                      ) : (
                        <div className="flex flex-wrap justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => remove(row)}
                            disabled={busyId === row.id}
                            className="rounded-full border border-light-gray px-3 py-1 text-xs font-semibold text-dark-gray transition-colors hover:border-paprika hover:text-paprika disabled:opacity-50"
                          >
                            Hapus
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-light-gray pt-4">
          <p className="text-xs text-dark-gray">
            Halaman {page} dari {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className={INPUT_CLS + ' !w-auto px-3 py-1.5 text-xs font-semibold text-dark-gray disabled:opacity-40'}
            >
              Sebelumnya
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className={INPUT_CLS + ' !w-auto px-3 py-1.5 text-xs font-semibold text-dark-gray disabled:opacity-40'}
            >
              Berikutnya
            </button>
          </div>
        </div>
      </section>

      {proofUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-graphite/70 p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Bukti pembayaran"
          onClick={() => setProofUrl(null)}
        >
          <div
            className="flex max-h-full w-full max-w-2xl flex-col gap-3 rounded-2xl bg-white p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-lg font-semibold text-hunter-green">
                Bukti Pembayaran
              </h3>
              <button
                type="button"
                onClick={() => setProofUrl(null)}
                className="rounded-md px-2 py-1 text-sm text-dark-gray hover:bg-light-gray"
              >
                Tutup
              </button>
            </div>
            <div className="rounded-lg border border-light-gray bg-off-white px-3 py-2 text-xs text-dark-gray">
              {proofNote && (
                <p>
                  <span className="font-semibold text-graphite">Catatan member: </span>
                  {proofNote}
                </p>
              )}
              {proofUploadedAt && <p>Diunggah: {formatDate(proofUploadedAt)}</p>}
              {!proofNote && !proofUploadedAt && <p className="italic">Tanpa catatan</p>}
            </div>
            <div className="overflow-auto rounded-lg border border-light-gray bg-off-white p-2">
              {proofIsPdf ? (
                <iframe
                  src={proofUrl}
                  title="Bukti pembayaran"
                  className="h-[70vh] w-full"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={proofUrl}
                  alt="Bukti pembayaran"
                  className="mx-auto max-h-[70vh] w-auto"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ToastBadge({ toast }: { toast: Toast }) {
  if (toast.kind === 'idle') return null;
  if (toast.kind === 'saved') {
    return (
      <span className="rounded-full bg-hunter-green/10 px-3 py-1 text-xs font-semibold text-hunter-green">
        Tersimpan
      </span>
    );
  }
  return (
    <span className="rounded-full bg-paprika/10 px-3 py-1 text-xs font-semibold text-paprika">
      {toast.message}
    </span>
  );
}
