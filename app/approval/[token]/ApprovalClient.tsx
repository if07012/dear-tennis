'use client';
// ============================================
// ONE-CLICK APPROVAL PAGE (no login — the token in the URL is the auth)
// ============================================
// Admin taps a WhatsApp link → this page previews the signup and offers
// approve/reject. The reject-payment flow asks for a reason (the store
// requires one when bouncing a proof back to waiting_payment).

import Link from 'next/link';
import { useEffect, useState } from 'react';

type SignupPreview = {
  id: string;
  activityId: string;
  activityTitle: string;
  userEmail: string;
  userName: string;
  status: string;
  finalAmount: number;
  couponCode: string;
  message?: string;
  paymentNote?: string;
  rejectionReason?: string;
};

type State =
  | { kind: 'loading' }
  | { kind: 'invalid' }
  | { kind: 'ready'; signup: SignupPreview }
  | { kind: 'busy'; signup: SignupPreview }
  | { kind: 'done'; signup: SignupPreview; action: string }
  | { kind: 'error'; signup: SignupPreview; message: string };

const FIELD_LABEL_CLS =
  'text-xs font-semibold uppercase tracking-wider text-dark-gray';
const INPUT_CLS =
  'w-full rounded-lg border border-light-gray bg-white px-3 py-2 text-sm focus:border-hunter-green focus:outline-none';

const STATUS_LABEL: Record<string, string> = {
  pending_approval: 'Menunggu persetujuan',
  payment_submitted: 'Bukti pembayaran menunggu verifikasi',
};

function formatRupiah(amount: number): string {
  return amount > 0 ? `Rp${amount.toLocaleString('id-ID')}` : 'Gratis';
}

export function ApprovalClient({ token }: { token: string }) {
  const [state, setState] = useState<State>({ kind: 'loading' });
  // Payment reject needs a reason; kept at top level so it survives re-renders.
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/approval/${encodeURIComponent(token)}`, {
          cache: 'no-store',
        });
        if (cancelled) return;
        if (!res.ok) {
          setState({ kind: 'invalid' });
          return;
        }
        const body = (await res.json()) as { signup?: SignupPreview };
        if (!body.signup) {
          setState({ kind: 'invalid' });
          return;
        }
        setState({ kind: 'ready', signup: body.signup });
      } catch {
        if (!cancelled) setState({ kind: 'invalid' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const decide = async (action: string, reason?: string) => {
    if (state.kind !== 'ready' && state.kind !== 'error') return;
    const signup = state.signup;
    setState({ kind: 'busy', signup });
    try {
      const res = await fetch(`/api/approval/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, reason }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) {
        setState({ kind: 'error', signup, message: body.error ?? `HTTP ${res.status}` });
        return;
      }
      setState({ kind: 'done', signup, action });
    } catch (e) {
      setState({
        kind: 'error',
        signup,
        message: e instanceof Error ? e.message : 'Gagal menghubungi server',
      });
    }
  };

  const isRegistration = state.kind !== 'loading' && state.kind !== 'invalid'
    ? state.signup.status === 'pending_approval'
    : false;

  return (
    <div className="min-h-screen bg-off-white">
      <div className="container-base flex min-h-screen items-center justify-center py-16">
        <div className="w-full max-w-md">
          <header className="mb-8 text-center">
            <Link
              href="/"
              className="font-serif text-2xl font-bold text-hunter-green"
            >
              Dear Tennis
            </Link>
            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-paprika">
              Persetujuan Admin
            </p>
          </header>

          <div className="rounded-2xl border border-light-gray bg-white p-6 shadow-sm">
            {state.kind === 'loading' && (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <div className="h-10 w-10 animate-spin rounded-full border-2 border-light-gray border-t-hunter-green" />
                <p className="text-sm text-dark-gray">Memuat pendaftaran...</p>
              </div>
            )}

            {state.kind === 'invalid' && (
              <div className="space-y-4 py-6 text-center">
                <h1 className="font-serif text-xl font-semibold text-hunter-green">
                  Tautan tidak valid
                </h1>
                <p className="text-sm text-dark-gray">
                  Token tidak dikenali atau pendaftaran sudah tidak ditemukan.
                  Buka dashboard admin untuk mengelola pendaftaran.
                </p>
                <Link
                  href="/admin/activity-signups"
                  className="inline-flex rounded-full border border-light-gray px-4 py-2 text-xs font-semibold text-dark-gray transition-colors hover:border-hunter-green hover:text-hunter-green"
                >
                  Buka dashboard admin
                </Link>
              </div>
            )}

            {(state.kind === 'ready' || state.kind === 'busy' || state.kind === 'error') && (
              <div className="space-y-5">
                <div>
                  <h1 className="font-serif text-xl font-semibold text-hunter-green">
                    {isRegistration ? 'Persetujuan Pendaftaran' : 'Verifikasi Pembayaran'}
                  </h1>
                  <p className="mt-1 text-sm text-dark-gray">
                    {STATUS_LABEL[state.signup.status] ?? state.signup.status}
                  </p>
                </div>

                <dl className="space-y-3 rounded-xl bg-off-white p-4 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className={FIELD_LABEL_CLS}>Member</dt>
                    <dd className="text-right font-medium text-graphite">
                      {state.signup.userName}
                      <span className="block text-xs text-dark-gray">
                        {state.signup.userEmail}
                      </span>
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className={FIELD_LABEL_CLS}>Activity</dt>
                    <dd className="text-right font-medium text-graphite">
                      {state.signup.activityTitle}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className={FIELD_LABEL_CLS}>Biaya</dt>
                    <dd className="text-right font-medium text-graphite">
                      {formatRupiah(state.signup.finalAmount)}
                      {state.signup.couponCode && (
                        <span className="block text-xs text-paprika">
                          Kupon {state.signup.couponCode}
                        </span>
                      )}
                    </dd>
                  </div>
                  {state.signup.message && (
                    <div className="flex justify-between gap-4">
                      <dt className={FIELD_LABEL_CLS}>Pesan</dt>
                      <dd className="max-w-[60%] text-right text-dark-gray">
                        {state.signup.message}
                      </dd>
                    </div>
                  )}
                  {state.signup.paymentNote && (
                    <div className="flex justify-between gap-4">
                      <dt className={FIELD_LABEL_CLS}>Catatan</dt>
                      <dd className="max-w-[60%] text-right text-dark-gray">
                        {state.signup.paymentNote}
                      </dd>
                    </div>
                  )}
                </dl>

                {state.kind === 'error' && (
                  <div
                    role="alert"
                    className="rounded-lg border border-paprika/30 bg-paprika/10 px-3 py-2 text-xs font-semibold text-paprika"
                  >
                    {state.message}
                  </div>
                )}

                {!isRegistration && (
                  <label className="flex flex-col gap-1">
                    <span className={FIELD_LABEL_CLS}>
                      Alasan penolakan (wajib saat menolak pembayaran)
                    </span>
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      maxLength={500}
                      rows={2}
                      disabled={state.kind === 'busy'}
                      className={INPUT_CLS}
                      placeholder="Contoh: nominal tidak sesuai"
                    />
                  </label>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled={state.kind === 'busy'}
                    onClick={() =>
                      decide(isRegistration ? 'approve' : 'approve-payment')
                    }
                    className="rounded-full bg-hunter-green px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-60"
                  >
                    {state.kind === 'busy' ? 'Memproses...' : 'Setujui'}
                  </button>
                  <button
                    type="button"
                    disabled={state.kind === 'busy'}
                    onClick={() => {
                      if (!isRegistration && !rejectReason.trim()) {
                        setState({
                          kind: 'error',
                          signup: state.signup,
                          message: 'Alasan penolakan wajib diisi',
                        });
                        return;
                      }
                      decide(
                        isRegistration ? 'reject' : 'reject-payment',
                        isRegistration ? undefined : rejectReason.trim(),
                      );
                    }}
                    className="rounded-full border border-paprika px-5 py-2.5 text-sm font-semibold text-paprika transition-colors hover:bg-paprika hover:text-white disabled:opacity-60"
                  >
                    Tolak
                  </button>
                </div>

                <p className="text-center text-xs text-dark-gray">
                  Member akan otomatis diberi tahu lewat WhatsApp setelah keputusan.
                </p>
              </div>
            )}

            {state.kind === 'done' && (
              <div className="space-y-5 py-6 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-hunter-green/10 text-hunter-green">
                  ✓
                </div>
                <h1 className="font-serif text-xl font-semibold text-hunter-green">
                  {state.action.includes('approve') ? 'Keputusan tersimpan' : 'Ditolak'}
                </h1>
                <p className="text-sm text-dark-gray">
                  Pendaftaran {state.signup.userName} untuk{' '}
                  <span className="font-semibold">{state.signup.activityTitle}</span>{' '}
                  sudah diproses. Member diberi tahu lewat WhatsApp.
                </p>
                <Link
                  href="/admin/activity-signups"
                  className="inline-flex rounded-full bg-paprika px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-paprika-hover"
                >
                  Buka dashboard admin
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
