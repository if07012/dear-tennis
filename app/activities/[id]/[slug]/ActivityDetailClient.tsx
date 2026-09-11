'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ClockSmallIcon,
  MapPinIcon,
  UsersSmallIcon,
} from '@/components/ui/Icons';
import { useAuth } from '@/hooks/useAuth';
import { formatActivityTime } from '@/lib/activity-utils';
import { JoinConfirmDialog, type JoinCouponOption } from '@/components/ui/JoinConfirmDialog';
import { parsePriceToAmount, type SignupStatus } from '@/data/activity-signups-types';
import type { ActivityItem } from '@/data/activities-types';
import type { MatchRecord } from '@/data/matches-types';

const TAG_STYLES: Record<string, string> = {
  training: 'bg-white text-hunter-green border border-hunter-green/30',
  social: 'bg-white text-teal border border-teal/30',
  competitive: 'bg-white text-paprika border border-paprika/30',
};

const ROUND_LABEL: Record<string, string> = {
  RR: 'Round Robin',
};

type ActivityMemberView = {
  email: string;
  name: string;
  photo?: string | null;
  rank: string | null;
};

type MySignup = {
  id: string;
  activityId: string;
  status: SignupStatus;
  couponCode: string;
  discountPct: number;
  originalAmount: number;
  finalAmount: number;
  rejectionReason?: string;
  expiresAt?: string;
  paymentProofUrl?: string;
};

type Props = {
  activity: ActivityItem | null;
  members: ActivityMemberView[];
  matches: MatchRecord[];
  capacity: number;
};

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function avatarBgFor(name: string): string {
  const palette = [
    'bg-hunter-green/15 text-hunter-green',
    'bg-teal/15 text-teal',
    'bg-paprika/15 text-paprika',
    'bg-amber-100 text-amber-800',
    'bg-sky-100 text-sky-800',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return palette[Math.abs(hash) % palette.length];
}

function setScore(m: MatchRecord): string {
  const sets = [
    m.set1A !== undefined || m.set1B !== undefined ? `${m.set1A}-${m.set1B}` : '',
    m.set2A !== undefined || m.set2B !== undefined ? `${m.set2A}-${m.set2B}` : '',
    m.set3A !== undefined || m.set3B !== undefined ? `${m.set3A}-${m.set3B}` : '',
  ].filter(Boolean);
  return sets.join(', ') || '-';
}

function MatchRow({ m, nameOf }: { m: MatchRecord; nameOf: (email: string) => string }) {
  const sideA = m.sideA.split(',').map(nameOf).join(' & ');
  const sideB = m.sideB.split(',').map(nameOf).join(' & ');
  const aWon = m.winner === 'A';
  const bWon = m.winner === 'B';
  return (
    <li className="flex flex-col gap-1 rounded-xl border border-light-gray bg-white px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-hunter-green/10 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-hunter-green">
          {ROUND_LABEL[m.round] ?? m.round}
        </span>
        {m.isDoubles && (
          <span className="rounded-full bg-hunter-green/10 px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wider text-hunter-green">
            2v2
          </span>
        )}
        {m.winner === 'draw' && (
          <span className="rounded-full bg-dark-gray/10 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-dark-gray">
            Draw
          </span>
        )}
        <span className="flex-1" />
        <span className="font-mono text-sm font-semibold text-hunter-green tabular-nums">
          {setScore(m)}
        </span>
      </div>
      <div className="flex flex-col gap-0.5 pl-1 text-sm">
        <span className={aWon ? 'font-semibold text-hunter-green' : 'text-dark-gray'}>
          {sideA} {aWon ? ' ✓' : ''}
        </span>
        <span className={bWon ? 'font-semibold text-hunter-green' : 'text-dark-gray'}>
          {sideB} {bWon ? ' ✓' : ''}
        </span>
      </div>
    </li>
  );
}

function formatRupiah(amount: number): string {
  return `Rp${amount.toLocaleString('id-ID')}`;
}

function formatDateTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const PROOF_MAX_BYTES = 2 * 1024 * 1024;
const PROOF_MIME = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];

export function ActivityDetailClient({ activity, members, matches, capacity }: Props) {
  const { user, isAuthenticated } = useAuth();
  const [status, setStatus] = useState<SignupStatus | null>(null);
  const [mySignup, setMySignup] = useState<MySignup | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [coupons, setCoupons] = useState<JoinCouponOption[] | undefined>(undefined);
  const [uploading, setUploading] = useState(false);
  const [uploadDone, setUploadDone] = useState(false);
  // Proof-upload modal (PRD §9): note + file + preview, submitted in one go.
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadNote, setUploadNote] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Preload the current user's signup state for this activity.
  useEffect(() => {
    if (!activity) return;
    if (!isAuthenticated || !user?.email) {
      setStatus(null);
      setMySignup(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/activity-signups/mine', {
          headers: { 'x-auth-email': user.email },
          cache: 'no-store',
        });
        if (!res.ok) return;
        const body = (await res.json()) as {
          signups: MySignup[];
        };
        if (cancelled) return;
        const found =
          body.signups.filter((s) => s.activityId === activity.id).at(-1) ?? null;
        setMySignup(found);
        setStatus(found ? found.status : null);
      } catch {
        // Silent — Join button still works; status just won't preload.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activity, isAuthenticated, user?.email]);

  const refreshSignup = useCallback(async () => {
    if (!activity || !user?.email) return;
    try {
      const res = await fetch('/api/activity-signups/mine', {
        headers: { 'x-auth-email': user.email },
        cache: 'no-store',
      });
      if (!res.ok) return;
      const body = (await res.json()) as { signups: MySignup[] };
      const found =
        body.signups.filter((s) => s.activityId === activity.id).at(-1) ?? null;
      setMySignup(found);
      setStatus(found ? found.status : null);
    } catch {
      // keep previous state
    }
  }, [activity, user?.email]);

  const join = useCallback(
    async (couponCode?: string) => {
      if (!activity || !user?.email) return;
      setPending(true);
      setError(null);
      try {
        const res = await fetch('/api/activity-signups', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-auth-email': user.email,
          },
          body: JSON.stringify({ activityId: activity.id, couponCode }),
        });
        const body = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          signup?: { status: SignupStatus };
          error?: string;
        };
        if (!res.ok || !body.ok || !body.signup) {
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        setStatus(body.signup.status);
        await refreshSignup();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Gagal mendaftar');
      } finally {
        setPending(false);
      }
    },
    [activity, user?.email, refreshSignup],
  );

  // Coupon choices load when the confirm dialog opens for a priced activity.
  useEffect(() => {
    if (!confirming || !activity || !user?.email) return;
    if (parsePriceToAmount(activity.price) <= 0) return;
    let cancelled = false;
    setCoupons(undefined);
    (async () => {
      try {
        const res = await fetch(
          `/api/coupons/eligible?activityId=${encodeURIComponent(activity.id)}`,
          { headers: { 'x-auth-email': user.email }, cache: 'no-store' },
        );
        if (!res.ok) return;
        const body = (await res.json()) as { coupons?: JoinCouponOption[] };
        if (!cancelled) setCoupons(body.coupons ?? []);
      } catch {
        if (!cancelled) setCoupons([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [confirming, activity, user?.email]);

  const resetUploadModal = useCallback(() => {
    setUploadOpen(false);
    setUploadFile(null);
    setUploadPreview(null);
    setUploadNote('');
  }, []);

  // File chosen in the modal — validate immediately so the member sees the
  // problem before submitting, then build a preview (images only; PDFs have
  // no inline preview).
  const pickUploadFile = useCallback((file: File | null) => {
    setError(null);
    if (!file) {
      setUploadFile(null);
      setUploadPreview(null);
      return;
    }
    if (!PROOF_MIME.includes(file.type)) {
      setError('Format harus JPG, PNG, atau PDF');
      return;
    }
    if (file.size > PROOF_MAX_BYTES) {
      setError('Ukuran maksimal 2MB');
      return;
    }
    setUploadFile(file);
    if (file.type === 'application/pdf') {
      setUploadPreview(null);
    } else {
      const reader = new FileReader();
      reader.onload = () => setUploadPreview(String(reader.result));
      reader.readAsDataURL(file);
    }
  }, []);

  const uploadProof = useCallback(async () => {
    if (!mySignup || !user?.email || !uploadFile) return;
    setError(null);
    setUploading(true);
    setUploadDone(false);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Gagal membaca file'));
        reader.readAsDataURL(uploadFile);
      });
      const res = await fetch(
        `/api/activity-signups/${mySignup.id}/payment`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-auth-email': user.email,
          },
          body: JSON.stringify({ proofUrl: dataUrl, note: uploadNote || undefined }),
        },
      );
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok || !body.ok) {
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setUploadDone(true);
      resetUploadModal();
      await refreshSignup();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal mengunggah bukti');
    } finally {
      setUploading(false);
    }
  }, [mySignup, user?.email, uploadFile, uploadNote, refreshSignup, resetUploadModal]);

  const occupied = useMemo(
    () => members.length + (status === 'waiting_payment' || status === 'payment_submitted' ? 1 : 0),
    [members.length, status],
  );
  const slotsRemaining =
    capacity > 0 ? Math.max(0, capacity - occupied) : null;

  if (!activity) {
    return (
      <div className="section-padding bg-white">
        <div className="container-base py-16 text-center">
          <h1 className="font-serif text-3xl font-semibold text-hunter-green mb-4">
            Activity tidak ditemukan
          </h1>
          <p className="text-dark-gray mb-8">
            Activity mungkin sudah dihapus atau diarsipkan.
          </p>
          <Link
            href="/#activities"
            className="inline-flex rounded-full bg-paprika px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-paprika-hover"
          >
            Lihat semua activity
          </Link>
        </div>
      </div>
    );
  }

  // Match sides store emails (or __manual_<name>@guest.local slugs).
  const memberNames = new Map(members.map((m) => [m.email.toLowerCase(), m.name]));
  const nameOf = (email: string) => {
    const key = email.trim().toLowerCase();
    const member = memberNames.get(key);
    if (member) return member;
    if (key.startsWith('__manual_')) return key.slice('__manual_'.length).split('@')[0];
    return key;
  };

  const priceAmount = parsePriceToAmount(activity.price);
  const canUpload = status === 'waiting_payment' && !!mySignup;

  return (
    <div className="bg-white">
      {/* Hero — activity image full-width with title overlay */}
      <div className="relative h-[40vh] min-h-72 w-full overflow-hidden sm:h-[50vh]">
        {activity.image ? (
          <Image
            src={activity.image}
            alt={activity.title}
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-hunter-green text-sm text-white">
            {activity.title}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-graphite/80 via-graphite/30 to-transparent" />
        <span
          className={[
            'absolute top-6 left-6 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider',
            TAG_STYLES[activity.category] ?? TAG_STYLES.training,
          ].join(' ')}
        >
          {activity.category}
        </span>
        <div className="absolute inset-x-0 bottom-0">
          <div className="container-base pb-6">
            <Link
              href="/#activities"
              className="mb-3 inline-flex text-xs font-semibold uppercase tracking-wider text-white/80 transition-colors hover:text-white"
            >
              ← Kembali ke activities
            </Link>
            <h1 className="font-serif text-3xl font-semibold text-white drop-shadow sm:text-5xl">
              {activity.title}
            </h1>
          </div>
        </div>
      </div>

      <div className="container-base py-8 sm:py-12">
        <div className="grid gap-10 lg:grid-cols-[2fr_1fr]">
          <article className="min-w-0">
            <h2 className="font-serif text-xl font-semibold text-hunter-green mb-3">
              Deskripsi
            </h2>
            <p className="text-dark-gray leading-relaxed whitespace-pre-line text-pretty">
              {activity.description || 'Belum ada deskripsi.'}
            </p>

            {activity.category === 'competitive' && matches.length > 0 && (
              <section className="mt-10">
                <h2 className="font-serif text-xl font-semibold text-hunter-green mb-4">
                  Hasil Match
                </h2>
                <ul className="flex flex-col gap-2">
                  {matches.map((m) => (
                    <MatchRow key={m.id} m={m} nameOf={nameOf} />
                  ))}
                </ul>
              </section>
            )}

            <section className="mt-10">
              <h2 className="font-serif text-xl font-semibold text-hunter-green mb-4">
                Member Terdaftar ({members.length})
              </h2>
              {members.length === 0 ? (
                <p className="text-sm text-dark-gray">
                  Belum ada member yang terdaftar.
                </p>
              ) : (
                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {members.map((m) => (
                    <li
                      key={`${m.email}-${m.name}`}
                      className="flex items-center gap-3 rounded-lg border border-light-gray bg-white px-3 py-2"
                    >
                      {m.photo ? (
                        <Image
                          src={m.photo}
                          alt={m.name}
                          width={40}
                          height={40}
                          className="h-10 w-10 flex-shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <span
                          className={[
                            'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                            avatarBgFor(m.name),
                          ].join(' ')}
                          aria-hidden="true"
                        >
                          {initialsOf(m.name)}
                        </span>
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-hunter-green">
                          {m.name}
                        </p>
                        {m.rank && (
                          <p className="text-xs text-dark-gray">{m.rank}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </article>

          <aside className="h-fit rounded-2xl border border-light-gray p-6 lg:sticky lg:top-24">
            <h2 className="font-serif text-lg font-semibold text-hunter-green mb-4">
              Info &amp; Pendaftaran
            </h2>
            <div className="flex flex-col gap-3 text-sm text-dark-gray">
              {activity.time && (
                <span className="inline-flex items-center gap-2">
                  <ClockSmallIcon />
                  {formatActivityTime(activity.time)}
                </span>
              )}
              {activity.duration && (
                <span className="inline-flex items-center gap-2">
                  <ClockSmallIcon />
                  {activity.duration}
                </span>
              )}
              {activity.location && (
                <span className="inline-flex items-center gap-2">
                  <MapPinIcon />
                  {activity.location}
                </span>
              )}
              {activity.groupSize && (
                <span className="inline-flex items-center gap-2">
                  <UsersSmallIcon />
                  {slotsRemaining !== null
                    ? `${slotsRemaining} slot tersisa dari ${activity.groupSize}`
                    : activity.groupSize}
                </span>
              )}
            </div>

            {activity.price && (
              <div className="mt-4 rounded-lg border border-light-gray bg-off-white px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-dark-gray">
                  Harga
                </p>
                <p className="mt-1 font-serif text-xl font-bold text-hunter-green">
                  {activity.price}
                </p>
              </div>
            )}

            <div className="mt-6 border-t border-light-gray pt-5">
              {activity.isFull ? (
                <button
                  type="button"
                  disabled
                  className="w-full rounded-full bg-light-gray px-4 py-2.5 text-sm font-semibold text-dark-gray"
                >
                  Full Book
                </button>
              ) : !isAuthenticated ? (
                <Link
                  href="/login"
                  className="inline-flex w-full items-center justify-center rounded-full bg-paprika px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-paprika-hover"
                >
                  Login untuk Join
                </Link>
              ) : status === 'joined' ? (
                <button
                  type="button"
                  disabled
                  className="w-full rounded-full bg-hunter-green/10 px-4 py-2.5 text-sm font-semibold text-hunter-green"
                >
                  ✓ Kamu sudah terdaftar
                </button>
              ) : status === 'pending_approval' ? (
                <button
                  type="button"
                  disabled
                  className="w-full rounded-full bg-amber-100 px-4 py-2.5 text-sm font-semibold text-amber-800"
                >
                  Menunggu persetujuan admin
                </button>
              ) : status === 'waiting_payment' || status === 'payment_submitted' ? (
                <PaymentPanel
                  signup={mySignup}
                  status={status}
                  priceAmount={priceAmount}
                  priceLabel={activity.price}
                  uploadDone={uploadDone}
                  canUpload={canUpload}
                  onOpenUpload={() => {
                    setError(null);
                    setUploadOpen(true);
                  }}
                />
              ) : status === 'rejected' || status === 'cancelled' || status === 'expired' ? (
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    disabled
                    className="w-full rounded-full bg-paprika/10 px-4 py-2.5 text-sm font-semibold text-paprika"
                  >
                    {status === 'expired'
                      ? '⏰ Batas pembayaran habis'
                      : '✗ Pendaftaran ditolak'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirming(true)}
                    disabled={pending}
                    className="w-full rounded-full border border-paprika px-4 py-2.5 text-sm font-semibold text-paprika transition-colors hover:bg-paprika hover:text-white disabled:opacity-60"
                  >
                    {pending ? 'Mengirim...' : 'Daftar lagi'}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirming(true)}
                  disabled={pending}
                  className="w-full rounded-full bg-paprika px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-paprika-hover hover:shadow-md disabled:opacity-60"
                >
                  {pending ? 'Mengirim...' : 'Join Activity'}
                </button>
              )}

              {error && (
                <p role="alert" className="mt-3 text-center text-xs font-semibold text-paprika">
                  {error}
                </p>
              )}
            </div>
          </aside>
        </div>
      </div>

      {/* Hidden input reused by the upload modal's pick button. */}
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          pickUploadFile(file ?? null);
        }}
      />

      {/* Proof-upload modal (PRD §9): note + file + preview in one popup. */}
      {uploadOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-graphite/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Upload bukti pembayaran"
          onClick={() => {
            if (!uploading) resetUploadModal();
          }}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-2xl bg-white p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3 className="font-serif text-xl font-semibold text-hunter-green">
                Upload Bukti Pembayaran
              </h3>
              <p className="mt-1 text-xs text-dark-gray">
                Bayar {formatRupiah(mySignup?.finalAmount || priceAmount)}
                {mySignup?.expiresAt && ` — batas ${formatDateTime(mySignup.expiresAt)}`}
              </p>
            </div>

            {mySignup?.rejectionReason && (
              <div className="rounded-lg border border-paprika/30 bg-paprika/10 px-3 py-2 text-xs text-paprika">
                Pembayaran ditolak: {mySignup.rejectionReason}. Silakan unggah
                bukti baru.
              </div>
            )}

            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-dark-gray">
                Catatan untuk admin (opsional)
              </span>
              <textarea
                value={uploadNote}
                onChange={(e) => setUploadNote(e.target.value)}
                maxLength={300}
                rows={2}
                placeholder="Mis. transfer dari BCA a/n ..., jam 14.30"
                className="w-full rounded-lg border border-light-gray px-3 py-2 text-sm focus:border-hunter-green focus:outline-none"
              />
            </label>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full rounded-full border border-hunter-green px-4 py-2 text-sm font-semibold text-hunter-green transition-colors hover:bg-hunter-green hover:text-white"
              >
                {uploadFile ? 'Ganti File' : 'Pilih File'}
              </button>
              <p className="text-center text-[0.7rem] text-dark-gray">
                JPG, PNG, atau PDF — maks 2MB
              </p>
              {uploadFile && (
                <p className="truncate text-center text-xs text-hunter-green">
                  {uploadFile.type === 'application/pdf' ? 'PDF' : 'Gambar'}: {uploadFile.name}
                </p>
              )}
            </div>

            {uploadPreview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={uploadPreview}
                alt="Pratinjau bukti pembayaran"
                className="mx-auto max-h-56 w-auto rounded-lg border border-light-gray"
              />
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  if (!uploading) resetUploadModal();
                }}
                disabled={uploading}
                className="flex-1 rounded-full border border-light-gray px-4 py-2 text-sm font-semibold text-dark-gray transition-colors hover:border-paprika hover:text-paprika disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => void uploadProof()}
                disabled={uploading || !uploadFile}
                className="flex-1 rounded-full bg-paprika px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-paprika-hover disabled:opacity-50"
              >
                {uploading ? 'Mengirim...' : 'Kirim Bukti'}
              </button>
            </div>
          </div>
        </div>
      )}

      <JoinConfirmDialog
        activity={
          confirming
            ? {
                title: activity.title,
                time: activity.time || undefined,
                location: activity.location || undefined,
                price: activity.price || undefined,
              }
            : null
        }
        coupons={confirming ? coupons : undefined}
        pending={pending}
        onConfirm={(couponCode) => {
          setConfirming(false);
          void join(couponCode);
        }}
        onClose={() => setConfirming(false)}
      />
    </div>
  );
}

/**
 * Registration-status panel for waiting_payment / payment_submitted
 * (PRD §8–§9, §12, §14): amount breakdown, deadline, and the button that
 * opens the proof-upload modal. Uploads are only allowed while
 * waiting_payment.
 */
function PaymentPanel({
  signup,
  status,
  priceAmount,
  priceLabel,
  uploadDone,
  canUpload,
  onOpenUpload,
}: {
  signup: MySignup | null;
  status: SignupStatus;
  priceAmount: number;
  priceLabel?: string;
  uploadDone: boolean;
  canUpload: boolean;
  onOpenUpload: () => void;
}) {
  const amount = signup?.finalAmount || priceAmount;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-semibold text-sky-800">
        {status === 'waiting_payment'
          ? 'Pendaftaran disetujui — selesaikan pembayaran'
          : 'Bukti pembayaran sedang diverifikasi admin'}
      </p>
      <div className="flex flex-col gap-1 rounded-lg border border-light-gray bg-off-white px-4 py-3 text-sm">
        {signup && priceAmount > 0 && (
          <>
            <span className="flex justify-between text-dark-gray">
              <span>Harga</span>
              <span>{formatRupiah(signup.originalAmount || priceAmount)}</span>
            </span>
            {signup.couponCode && (
              <span className="flex justify-between text-teal">
                <span>Kupon {signup.couponCode}</span>
                <span>−{signup.discountPct}%</span>
              </span>
            )}
            <span className="flex justify-between font-semibold text-hunter-green">
              <span>Bayar</span>
              <span>{formatRupiah(amount)}</span>
            </span>
          </>
        )}
        {signup?.expiresAt && status === 'waiting_payment' && (
          <span className="text-xs text-paprika">
            Batas bayar: {formatDateTime(signup.expiresAt)}
          </span>
        )}
        {priceLabel && priceAmount === 0 && (
          <span className="text-dark-gray">{priceLabel}</span>
        )}
      </div>
      {signup?.rejectionReason && status === 'waiting_payment' && (
        <div className="rounded-lg border border-paprika/30 bg-paprika/10 px-3 py-2 text-xs text-paprika">
          Pembayaran ditolak: {signup.rejectionReason}. Silakan unggah bukti
          baru.
        </div>
      )}
      {canUpload && (
        <>
          <button
            type="button"
            onClick={onOpenUpload}
            className="w-full rounded-full bg-paprika px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-paprika-hover hover:shadow-md"
          >
            Upload Bukti Pembayaran
          </button>
          <p className="text-center text-[0.7rem] text-dark-gray">
            JPG, PNG, atau PDF — maks 2MB
          </p>
        </>
      )}
      {uploadDone && (
        <p className="text-center text-xs font-semibold text-hunter-green">
          Bukti terkirim. Menunggu verifikasi admin.
        </p>
      )}
    </div>
  );
}
