'use client';

import { useEffect, useState } from 'react';
import { ClockSmallIcon, MapPinIcon, XIcon } from '@/components/ui/Icons';
import { formatActivityTime } from '@/lib/activity-utils';
import { parsePriceToAmount } from '@/data/activity-signups-types';

export type JoinConfirmInfo = {
  title: string;
  time?: string;
  location?: string;
  price?: string;
};

export type JoinCouponOption = {
  code: string;
  discountPct: number;
};

function formatRupiah(amount: number): string {
  return `Rp${amount.toLocaleString('id-ID')}`;
}

// Final "did you mean this one?" gate before a signup POST — shows the
// activity name, date, and location so a mis-click can't join the wrong
// session. When the activity has a price, an optional coupon text box lets
// the member type a code; it's checked against the server-fetched eligible
// list (active, unexpired, right user, not yet claimed) and the final
// amount updates live (PRD §5).
export function JoinConfirmDialog({
  activity,
  coupons,
  pending,
  onConfirm,
  onClose,
}: {
  activity: JoinConfirmInfo | null;
  /** Eligible coupons, fetched by the parent when opening the dialog. */
  coupons?: JoinCouponOption[];
  onConfirm: (couponCode?: string) => void;
  pending: boolean;
  onClose: () => void;
}) {
  const [couponCode, setCouponCode] = useState('');

  useEffect(() => {
    if (!activity) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activity, onClose]);

  // Reset the coupon pick whenever a new dialog opens.
  useEffect(() => {
    if (activity) setCouponCode('');
  }, [activity]);

  if (!activity) return null;

  const originalAmount = parsePriceToAmount(activity.price);
  const showCouponBox = originalAmount > 0;
  const trimmed = couponCode.trim().toUpperCase();
  const selected = coupons?.find((c) => c.code === trimmed);
  // Typed code not in the eligible list (unknown, expired, not for this
  // user/activity, or already claimed) — block confirm and say so. While the
  // list is still loading (undefined) we stay neutral: the server re-checks
  // the code on the signup POST either way.
  const invalidCode =
    trimmed.length > 0 && Array.isArray(coupons) && !selected;
  const finalAmount = selected
    ? Math.round(originalAmount * (1 - selected.discountPct / 100))
    : originalAmount;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-graphite/50 sm:items-center sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Konfirmasi pendaftaran"
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-light-gray px-5 py-4">
          <h3 className="font-serif text-lg font-semibold text-hunter-green">
            Konfirmasi Pendaftaran
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1.5 text-dark-gray transition-colors hover:bg-light-gray"
          >
            <XIcon size={20} />
          </button>
        </div>

        <div className="px-5 py-4">
          <p className="mb-3 text-sm text-dark-gray">
            Pastikan ini activity yang benar sebelum mendaftar:
          </p>
          <div className="flex flex-col gap-2 rounded-lg bg-off-white px-4 py-3 text-sm text-graphite">
            <p className="font-semibold text-hunter-green">{activity.title}</p>
            {activity.time && (
              <span className="inline-flex items-center gap-2 text-dark-gray">
                <ClockSmallIcon />
                {formatActivityTime(activity.time)}
              </span>
            )}
            {activity.location && (
              <span className="inline-flex items-center gap-2 text-dark-gray">
                <MapPinIcon />
                {activity.location}
              </span>
            )}
            {activity.price && (
              <span className="text-dark-gray">
                Harga:{' '}
                <span className="font-semibold text-hunter-green">
                  {activity.price}
                </span>
              </span>
            )}
            {!activity.time && !activity.location && !activity.price && (
              <p className="text-xs text-dark-gray">—</p>
            )}
          </div>

          {showCouponBox && (
            <div className="mt-4">
              <label
                htmlFor="join-coupon-code"
                className="mb-2 block text-xs font-semibold uppercase tracking-wider text-dark-gray"
              >
                Punya kode kupon? (opsional)
              </label>
              <input
                id="join-coupon-code"
                type="text"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                placeholder="KETIK KODE KUPON"
                autoComplete="off"
                className={[
                  'w-full rounded-lg border px-3 py-2 font-mono text-sm uppercase focus:outline-none',
                  invalidCode
                    ? 'border-paprika'
                    : selected
                      ? 'border-hunter-green'
                      : 'border-light-gray focus:border-hunter-green',
                ].join(' ')}
              />
              {selected && (
                <p className="mt-1 text-xs font-semibold text-teal">
                  Kupon {selected.code} berlaku — diskon {selected.discountPct}%
                </p>
              )}
              {invalidCode && (
                <p className="mt-1 text-xs font-semibold text-paprika">
                  Kupon tidak valid, kedaluwarsa, atau bukan untuk kamu.
                </p>
              )}
              <div className="mt-3 flex items-center justify-between rounded-lg bg-off-white px-3 py-2 text-sm">
                <span className="text-dark-gray">Total bayar</span>
                <span className="font-semibold text-hunter-green">
                  {finalAmount > 0 ? formatRupiah(finalAmount) : 'Gratis'}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 border-t border-light-gray px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="flex-1 rounded-full border border-light-gray px-4 py-2.5 text-sm font-semibold text-dark-gray transition-colors hover:bg-light-gray disabled:opacity-60"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={() => onConfirm(selected?.code)}
            disabled={pending || invalidCode}
            className="flex-1 rounded-full bg-paprika px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-paprika-hover hover:shadow-md disabled:opacity-60"
          >
            {pending ? 'Mengirim...' : 'Ya, Daftar'}
          </button>
        </div>
      </div>
    </div>
  );
}
