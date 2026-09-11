'use client';

import { useEffect } from 'react';
import { ClockSmallIcon, MapPinIcon, XIcon } from '@/components/ui/Icons';
import { formatActivityTime } from '@/lib/activity-utils';

export type JoinConfirmInfo = {
  title: string;
  time?: string;
  location?: string;
  price?: string;
};

// Final "did you mean this one?" gate before a signup POST — shows the
// activity name, date, and location so a mis-click can't join the wrong
// session.
export function JoinConfirmDialog({
  activity,
  pending,
  onConfirm,
  onClose,
}: {
  activity: JoinConfirmInfo | null;
  pending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!activity) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activity, onClose]);

  if (!activity) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-graphite/50 sm:items-center sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Konfirmasi pendaftaran"
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
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
            onClick={onConfirm}
            disabled={pending}
            className="flex-1 rounded-full bg-paprika px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-paprika-hover hover:shadow-md disabled:opacity-60"
          >
            {pending ? 'Mengirim...' : 'Ya, Daftar'}
          </button>
        </div>
      </div>
    </div>
  );
}
