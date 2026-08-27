'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  XIcon,
} from '@/components/ui/Icons';
import { useAuth } from '@/hooks/useAuth';
import {
  INVITE_STATUSES,
  type Invite,
  type InviteStatus,
} from '@/data/invite-types';
import type { PagedInviteContent } from '@/lib/invite-store';

type SaveStatus =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved'; at: number }
  | { kind: 'error'; message: string };

const FIELD_LABEL_CLS =
  'text-xs font-semibold uppercase tracking-wider text-dark-gray';
const INPUT_CLS =
  'w-full rounded-lg border border-light-gray bg-white px-3 py-2 text-sm focus:border-hunter-green focus:outline-none';

const NAV_LINK_CLS =
  'text-xs font-semibold uppercase tracking-wider text-dark-gray transition-colors hover:text-paprika';

const STATUS_BADGE_CLS: Record<InviteStatus, string> = {
  pending: 'bg-amber-100 text-amber-800',
  sent: 'bg-blue-100 text-blue-800',
  accepted: 'bg-hunter-green/10 text-hunter-green',
  cancelled: 'bg-paprika/10 text-paprika',
};

function formatDate(iso: string) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('id-ID', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function InviteManagerClient({
  initial,
}: {
  initial: PagedInviteContent;
}) {
  const { user } = useAuth();
  const [items, setItems] = useState<Invite[]>(initial.items);
  const [page, setPage] = useState(initial.page);
  const [pageSize] = useState(initial.pageSize);
  const [totalPages, setTotalPages] = useState(initial.totalPages);
  const [total, setTotal] = useState(initial.total);
  const [loadingPage, setLoadingPage] = useState(false);

  // Form state
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [submitStatus, setSubmitStatus] = useState<SaveStatus>({ kind: 'idle' });

  const fetchPage = useCallback(
    async (target: number) => {
      setLoadingPage(true);
      try {
        const res = await fetch(
          `/api/invite?page=${target}&pageSize=${pageSize}`,
          { headers: { 'x-auth-email': user?.email ?? '' } },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as PagedInviteContent;
        setItems(body.items);
        setTotal(body.total);
        setTotalPages(body.totalPages);
        setPage(body.page);
      } catch (e) {
        setSubmitStatus({
          kind: 'error',
          message: e instanceof Error ? e.message : 'Failed to load page',
        });
      } finally {
        setLoadingPage(false);
      }
    },
    [pageSize, user?.email],
  );

  const onCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (email.trim().length === 0) {
      setSubmitStatus({ kind: 'error', message: 'Email wajib diisi' });
      return;
    }
    setSubmitStatus({ kind: 'saving' });
    try {
      const res = await fetch('/api/invite', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-auth-email': user?.email ?? '',
        },
        body: JSON.stringify({
          email: email.trim(),
          name: name.trim() || undefined,
          message: message.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const body = (await res.json().catch(() => ({}))) as {
        warning?: string;
        sent?: boolean;
      };
      // Reset form and refresh page 1 to show the new invite at the top
      // (rows are sorted newest-first).
      setEmail('');
      setName('');
      setMessage('');
      await fetchPage(1);
      if (body.warning) {
        setSubmitStatus({ kind: 'error', message: body.warning });
      } else {
        setSubmitStatus({ kind: 'saved', at: Date.now() });
      }
    } catch (err) {
      setSubmitStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Failed to create invite',
      });
    }
  };

  const onUpdateStatus = async (id: string, status: InviteStatus) => {
    try {
      const res = await fetch('/api/invite', {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          'x-auth-email': user?.email ?? '',
        },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, status } : i)),
      );
    } catch (e) {
      setSubmitStatus({
        kind: 'error',
        message: e instanceof Error ? e.message : 'Failed to update',
      });
    }
  };

  const onDelete = async (id: string) => {
    if (typeof window !== 'undefined' && !window.confirm('Hapus undangan ini?')) {
      return;
    }
    try {
      const res = await fetch('/api/invite', {
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
      // Re-fetch current page (last row removal may shift the slice).
      await fetchPage(page);
    } catch (e) {
      setSubmitStatus({
        kind: 'error',
        message: e instanceof Error ? e.message : 'Failed to delete',
      });
    }
  };

  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * pageSize;

  return (
    <div className="container-base section-padding">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-paprika">
            Admin
          </p>
          <h1 className="font-serif text-3xl font-bold text-hunter-green">
            Invite Members
          </h1>
          <p className="mt-1 text-sm text-dark-gray">
            Catat undangan membership di Google Sheet. Status undangan
            dipakai untuk melacak siklus hidup: pending → sent → accepted /
            cancelled.
          </p>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          <Link href="/admin/hero" className={NAV_LINK_CLS}>
            Hero
          </Link>
          <Link href="/admin/our-story" className={NAV_LINK_CLS}>
            Our Story
          </Link>
          <Link href="/admin/why-join" className={NAV_LINK_CLS}>
            Why Join
          </Link>
          <Link href="/admin/activities" className={NAV_LINK_CLS}>
            Activities
          </Link>
          <Link href="/admin/activities-list" className={NAV_LINK_CLS}>
            Activities List
          </Link>
          <Link href="/admin/calendar" className={NAV_LINK_CLS}>
            Calendar
          </Link>
          <Link href="/admin/gallery" className={NAV_LINK_CLS}>
            Gallery
          </Link>
          <Link href="/admin/testimonials" className={NAV_LINK_CLS}>
            Testimonials
          </Link>
          <Link href="/admin/statistics" className={NAV_LINK_CLS}>
            Statistics
          </Link>
          <Link href="/admin/faq" className={NAV_LINK_CLS}>
            FAQ
          </Link>
        </div>
      </header>

      <section className="mb-8 rounded-2xl border border-light-gray bg-white p-6">
        <h2 className="font-serif text-xl font-semibold text-hunter-green">
          Undang member baru
        </h2>
        <p className="mt-1 text-sm text-dark-gray">
          Isi email (wajib), nama dan pesan opsional. Undangan akan disimpan
          dengan status <strong>pending</strong>.
        </p>

        <form onSubmit={onCreate} className="mt-6 grid gap-4 sm:grid-cols-6">
          <label className="flex flex-col gap-1 sm:col-span-3">
            <span className={FIELD_LABEL_CLS}>Email *</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@contoh.com"
              className={INPUT_CLS}
            />
          </label>
          <label className="flex flex-col gap-1 sm:col-span-3">
            <span className={FIELD_LABEL_CLS}>Nama</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nama lengkap (opsional)"
              className={INPUT_CLS}
            />
          </label>
          <label className="flex flex-col gap-1 sm:col-span-6">
            <span className={FIELD_LABEL_CLS}>Pesan</span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder="Catatan untuk undangan ini (opsional)"
              className={`${INPUT_CLS} resize-y`}
            />
          </label>
          <div className="flex items-center justify-end gap-3 sm:col-span-6">
            <FormStatus status={submitStatus} />
            <button
              type="submit"
              disabled={submitStatus.kind === 'saving'}
              className="rounded-full bg-paprika px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-paprika-hover disabled:opacity-50"
            >
              {submitStatus.kind === 'saving' ? 'Mengirim...' : 'Undang'}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-light-gray bg-white p-6">
        <header className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-serif text-xl font-semibold text-hunter-green">
              Daftar undangan
            </h2>
            <p className="mt-1 text-sm text-dark-gray">
              Urut dari yang terbaru. Klik status untuk mengubah, klik ikon
              × untuk menghapus.
            </p>
          </div>
        </header>

        <ul className="mt-6 grid gap-3">
          {items.length === 0 && !loadingPage && (
            <li className="rounded-xl border border-dashed border-light-gray bg-off-white p-6 text-center text-sm text-dark-gray">
              Belum ada undangan. Gunakan form di atas untuk menambah.
            </li>
          )}
          {loadingPage && items.length === 0 && (
            <li className="rounded-xl border border-dashed border-light-gray bg-off-white p-6 text-center text-sm text-dark-gray">
              Memuat...
            </li>
          )}
          {items.map((inv) => (
            <li
              key={inv.id}
              className="rounded-xl border border-light-gray bg-off-white p-4"
            >
              <div className="flex items-start gap-4">
                <div className="flex w-12 flex-shrink-0 flex-col items-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-paprika/10 text-paprika">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="h-5 w-5"
                    >
                      <path d="M3 8l7.89 5.26a2 2 0 0 0 2.22 0L21 8M5 19h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2z" />
                    </svg>
                  </div>
                </div>

                <div className="flex flex-1 flex-col gap-1.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-serif text-base font-semibold text-hunter-green">
                      {inv.name || inv.email}
                    </span>
                    {inv.name && (
                      <span className="text-sm text-dark-gray">({inv.email})</span>
                    )}
                  </div>
                  {inv.message && (
                    <p className="text-sm text-dark-gray text-pretty whitespace-pre-wrap">
                      {inv.message}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-dark-gray">
                    <span>{formatDate(inv.invitedAt)}</span>
                    {inv.createdBy && (
                      <span>oleh {inv.createdBy}</span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <label className="flex flex-col items-end gap-1">
                    <span className={FIELD_LABEL_CLS}>Status</span>
                    <select
                      value={inv.status}
                      onChange={(e) =>
                        onUpdateStatus(
                          inv.id,
                          e.target.value as InviteStatus,
                        )
                      }
                      className={[
                        'rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider focus:outline-none',
                        STATUS_BADGE_CLS[inv.status],
                      ].join(' ')}
                    >
                      {INVITE_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={() => onDelete(inv.id)}
                    aria-label="Delete invite"
                    className="rounded-md p-1.5 text-paprika transition-colors hover:bg-paprika/10"
                  >
                    <XIcon size={18} />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-light-gray pt-4">
          <p className="text-xs text-dark-gray">
            Menampilkan {total === 0 ? 0 : pageStart + 1}–
            {Math.min(pageStart + pageSize, total)} dari {total} undangan ·
            Halaman {safePage} dari {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fetchPage(safePage - 1)}
              disabled={safePage <= 1}
              className="inline-flex items-center gap-1 rounded-full border border-light-gray px-3 py-1.5 text-xs font-semibold text-dark-gray transition-colors hover:border-hunter-green hover:text-hunter-green disabled:opacity-40 disabled:hover:border-light-gray disabled:hover:text-dark-gray"
            >
              <ChevronLeftIcon size={14} />
              Sebelumnya
            </button>
            <button
              type="button"
              onClick={() => fetchPage(safePage + 1)}
              disabled={safePage >= totalPages}
              className="inline-flex items-center gap-1 rounded-full border border-light-gray px-3 py-1.5 text-xs font-semibold text-dark-gray transition-colors hover:border-hunter-green hover:text-hunter-green disabled:opacity-40 disabled:hover:border-light-gray disabled:hover:text-dark-gray"
            >
              Berikutnya
              <ChevronRightIcon size={14} />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function FormStatus({ status }: { status: SaveStatus }) {
  if (status.kind === 'idle') return null;
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