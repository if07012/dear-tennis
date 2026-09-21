'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type { PagedUsers, UserRecord, UserRole } from '@/lib/users-store';
import { ResponsiveTable } from '@/components/admin/ResponsiveTable';
import { AdminTableToolbar } from '@/components/admin/AdminTableToolbar';
import { MobileActionMenu } from '@/components/admin/MobileActionMenu';
import { ResponsivePagination } from '@/components/admin/ResponsivePagination';
import type { BadgeCatalogRecord, GrantedBadge } from '@/data/achievements-types';

const FIELD_LABEL_CLS =
  'text-xs font-semibold uppercase tracking-wider text-dark-gray';
const INPUT_CLS =
  'w-full rounded-lg border border-light-gray bg-white px-3 py-2 text-sm focus:border-hunter-green focus:outline-none';

const PAGE_SIZE_OPTIONS = [10, 25, 50];

type InitialPage = PagedUsers;

type Toast =
  | { kind: 'idle' }
  | { kind: 'saved'; at: number }
  | { kind: 'error'; message: string };

function formatDate(iso: string): string {
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

export function UsersClient({ initial }: { initial: InitialPage }) {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserRecord[]>(initial.users);
  const [page, setPage] = useState(initial.page);
  const [pageSize, setPageSize] = useState(initial.pageSize);
  const [total, setTotal] = useState(initial.total);
  const [totalPages, setTotalPages] = useState(initial.totalPages);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast>({ kind: 'idle' });
  const [badgeCatalog, setBadgeCatalog] = useState<BadgeCatalogRecord[]>([]);
  const [openPopoverFor, setOpenPopoverFor] = useState<string | null>(null);
  const [grantsByEmail, setGrantsByEmail] = useState<
    Record<string, GrantedBadge[]>
  >({});
  const [grantsLoading, setGrantsLoading] = useState<string | null>(null);

  // Debounce search input so we don't spam the API per keystroke.
  useEffect(() => {
    const id = window.setTimeout(() => {
      setDebouncedSearch(search.trim().toLowerCase());
      setPage(1);
    }, 250);
    return () => window.clearTimeout(id);
  }, [search]);

  const fetchPage = useCallback(
    async (targetPage: number, targetPageSize: number) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(targetPage),
          pageSize: String(targetPageSize),
        });
        const res = await fetch(`/api/admin/users?${params.toString()}`, {
          headers: { 'x-auth-email': user?.email ?? '' },
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        const body = (await res.json()) as PagedUsers;
        setUsers(body.users);
        setTotal(body.total);
        setPage(body.page);
        setPageSize(body.pageSize);
        setTotalPages(body.totalPages);
      } catch (e) {
        setToast({
          kind: 'error',
          message:
            e instanceof Error ? e.message : 'Failed to load users',
        });
      } finally {
        setLoading(false);
      }
    },
    [user?.email],
  );

  // Refetch when page or pageSize changes.
  useEffect(() => {
    void fetchPage(page, pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize]);

  // Load the badge catalog once. Catalog rarely changes; if it's empty
  // the row popover shows an "add badges first" hint.
  useEffect(() => {
    let cancelled = false;
    fetch('/api/admin/badges', {
      headers: { 'x-auth-email': user?.email ?? '' },
      cache: 'no-store',
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as { badges: BadgeCatalogRecord[] };
      })
      .then((body) => {
        if (cancelled) return;
        setBadgeCatalog((body.badges ?? []).filter((b) => !b.archived));
      })
      .catch(() => {
        if (cancelled) return;
        setBadgeCatalog([]);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.email]);

  const visibleUsers = useMemo(() => {
    if (!debouncedSearch) return users;
    return users.filter((u) => {
      return (
        u.email.toLowerCase().includes(debouncedSearch) ||
        u.name.toLowerCase().includes(debouncedSearch) ||
        u.role.toLowerCase().includes(debouncedSearch)
      );
    });
  }, [users, debouncedSearch]);

  const pageStart = (page - 1) * pageSize;

  const changePageSize = (next: number) => {
    setPage(1);
    setPageSize(next);
  };

  const onChangeRole = async (id: string, next: UserRole) => {
    const previous = users.find((u) => u.id === id)?.role;
    if (previous === next) return;
    setBusyId(id);
    setToast({ kind: 'idle' });
    // Optimistic update so the UI feels instant.
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, role: next } : u)));
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          'x-auth-email': user?.email ?? '',
        },
        body: JSON.stringify({ id, role: next }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const body = (await res.json()) as { user: UserRecord };
      setUsers((prev) =>
        prev.map((u) => (u.id === id ? body.user : u)),
      );
      setToast({ kind: 'saved', at: Date.now() });
    } catch (e) {
      // Revert optimistic change.
      setUsers((prev) =>
        prev.map((u) => (u.id === id && previous ? { ...u, role: previous } : u)),
      );
      setToast({
        kind: 'error',
        message: e instanceof Error ? e.message : 'Failed to update role',
      });
    } finally {
      setBusyId(null);
    }
  };

  const togglePopover = async (u: UserRecord) => {
    if (openPopoverFor === u.id) {
      setOpenPopoverFor(null);
      return;
    }
    setOpenPopoverFor(u.id);
    if (grantsByEmail[u.email]) return;
    setGrantsLoading(u.id);
    try {
      const res = await fetch(
        `/api/admin/users/badges?user=${encodeURIComponent(u.email)}`,
        { headers: { 'x-auth-email': user?.email ?? '' }, cache: 'no-store' },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { grants: GrantedBadge[] };
      setGrantsByEmail((prev) => ({ ...prev, [u.email]: body.grants ?? [] }));
    } catch {
      setGrantsByEmail((prev) => ({ ...prev, [u.email]: [] }));
    } finally {
      setGrantsLoading(null);
    }
  };

  const toggleBadge = async (u: UserRecord, badgeKey: string) => {
    const current = (grantsByEmail[u.email] ?? []).map((g) => g.key);
    const isGranted = current.includes(badgeKey);
    setBusyId(u.id);
    setToast({ kind: 'idle' });
    // Optimistic update so the chip flips instantly.
    setGrantsByEmail((prev) => {
      const existing = prev[u.email] ?? [];
      const next = isGranted
        ? existing.filter((g) => g.key !== badgeKey)
        : [
            ...existing,
            {
              ...(badgeCatalog.find((b) => b.key === badgeKey) ?? {
                id: '',
                key: badgeKey,
                label: badgeKey,
                icon: '🏅',
                description: '',
                archived: false,
                createdAt: '',
              }),
              grantedAt: new Date().toISOString(),
              grantedBy: user?.email ?? '',
              note: '',
            },
          ];
      return { ...prev, [u.email]: next };
    });
    try {
      const res = await fetch('/api/admin/users/badges', {
        method: isGranted ? 'DELETE' : 'POST',
        headers: {
          'content-type': 'application/json',
          'x-auth-email': user?.email ?? '',
        },
        body: JSON.stringify({ userEmail: u.email, badgeKey }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      // Re-fetch this user's grants so we get the canonical grantedAt /
      // grantedBy from the server.
      const fresh = await fetch(
        `/api/admin/users/badges?user=${encodeURIComponent(u.email)}`,
        { headers: { 'x-auth-email': user?.email ?? '' }, cache: 'no-store' },
      );
      if (fresh.ok) {
        const body = (await fresh.json()) as { grants: GrantedBadge[] };
        setGrantsByEmail((prev) => ({ ...prev, [u.email]: body.grants ?? [] }));
      }
      setToast({ kind: 'saved', at: Date.now() });
    } catch (e) {
      // Revert: re-fetch the server state.
      try {
        const fresh = await fetch(
          `/api/admin/users/badges?user=${encodeURIComponent(u.email)}`,
          { headers: { 'x-auth-email': user?.email ?? '' }, cache: 'no-store' },
        );
        if (fresh.ok) {
          const body = (await fresh.json()) as { grants: GrantedBadge[] };
          setGrantsByEmail((prev) => ({
            ...prev,
            [u.email]: body.grants ?? [],
          }));
        }
      } catch {
        /* swallow */
      }
      setToast({
        kind: 'error',
        message: e instanceof Error ? e.message : 'Gagal memperbarui badge',
      });
    } finally {
      setBusyId(null);
    }
  };

  const onDelete = async (target: UserRecord) => {
    if (
      !window.confirm(
        `Hapus user ${target.email}? Tindakan ini tidak bisa dibatalkan.`,
      )
    ) {
      return;
    }
    setBusyId(target.id);
    setToast({ kind: 'idle' });
    try {
      const res = await fetch('/api/admin/users', {
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
      // Reload current page so pagination stays correct.
      await fetchPage(page, pageSize);
      setToast({ kind: 'saved', at: Date.now() });
    } catch (e) {
      setToast({
        kind: 'error',
        message: e instanceof Error ? e.message : 'Failed to delete user',
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="container-base section-padding">
      <header className="admin-header">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-paprika">
            Admin
          </p>
          <h1 className="font-serif text-3xl font-bold text-hunter-green">
            Manage Users
          </h1>
          <p className="mt-1 text-sm text-dark-gray">
            Daftar member terdaftar. Ubah role atau hapus akun dari sini.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ToastBadge toast={toast} />
        </div>
      </header>

      <section className="rounded-2xl border border-light-gray bg-white p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-1 flex-col gap-1">
            <label htmlFor="user-search" className={FIELD_LABEL_CLS}>
              Cari
            </label>
            <input
              id="user-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari berdasarkan nama, email, atau role"
              className={INPUT_CLS}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="page-size" className={FIELD_LABEL_CLS}>
              Per halaman
            </label>
            <select
              id="page-size"
              value={pageSize}
              onChange={(e) => changePageSize(Number.parseInt(e.target.value, 10))}
              className={INPUT_CLS}
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-light-gray text-left text-xs font-semibold uppercase tracking-wider text-dark-gray">
                <th className="py-3 pr-4">Nama</th>
                <th className="py-3 pr-4">Email</th>
                <th className="py-3 pr-4">Role</th>
                <th className="py-3 pr-4">Dibuat</th>
                <th className="py-3 pr-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading && users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-dark-gray">
                    Memuat...
                  </td>
                </tr>
              ) : visibleUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-dark-gray">
                    {total === 0
                      ? 'Belum ada user terdaftar.'
                      : 'Tidak ada hasil untuk pencarian ini.'}
                  </td>
                </tr>
              ) : (
                visibleUsers.map((u) => (
                  <tr
                    key={u.id}
                    className="border-b border-light-gray/60 last:border-b-0"
                  >
                    <td className="py-3 pr-4 align-middle font-medium text-hunter-green">
                      {u.name || u.email}
                    </td>
                    <td className="py-3 pr-4 align-middle text-dark-gray">
                      {u.email}
                    </td>
                    <td className="py-3 pr-4 align-middle">
                      <select
                        value={u.role}
                        disabled={busyId === u.id}
                        onChange={(e) =>
                          onChangeRole(u.id, e.target.value as UserRole)
                        }
                        className={[
                          'rounded-md border border-light-gray bg-white px-2 py-1 text-xs font-semibold focus:border-hunter-green focus:outline-none disabled:opacity-50',
                          u.role === 'admin'
                            ? 'text-paprika'
                            : 'text-dark-gray',
                        ].join(' ')}
                        aria-label={`Role untuk ${u.email}`}
                      >
                        <option value="member">member</option>
                        <option value="admin">admin</option>
                      </select>
                    </td>
                    <td className="py-3 pr-4 align-middle text-xs text-dark-gray">
                      {formatDate(u.createdAt)}
                    </td>
                    <td className="py-3 pr-4 align-middle text-right">
                      <div className="relative inline-flex items-center gap-2">
                        <Link
                          href={`/profile?user=${encodeURIComponent(u.email)}`}
                          className="rounded-full border border-light-gray px-3 py-1 text-xs font-semibold text-hunter-green transition-colors hover:border-hunter-green hover:bg-hunter-green/10"
                        >
                          Profile
                        </Link>
                        <button
                          type="button"
                          onClick={() => togglePopover(u)}
                          disabled={busyId === u.id && grantsLoading !== u.id}
                          aria-expanded={openPopoverFor === u.id}
                          aria-haspopup="dialog"
                          className="rounded-full border border-light-gray px-3 py-1 text-xs font-semibold text-graphite transition-colors hover:border-hunter-green hover:bg-hunter-green/10"
                        >
                          Badge
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(u)}
                          disabled={busyId === u.id}
                          className="rounded-full border border-light-gray px-3 py-1 text-xs font-semibold text-paprika transition-colors hover:border-paprika hover:bg-paprika/10 disabled:opacity-50"
                        >
                          Hapus
                        </button>
                        {openPopoverFor === u.id && (
                          <BadgePopover
                            user={u}
                            catalog={badgeCatalog}
                            grants={grantsByEmail[u.email] ?? []}
                            loading={grantsLoading === u.id}
                            busy={busyId === u.id}
                            onToggle={(key) => void toggleBadge(u, key)}
                            onClose={() => setOpenPopoverFor(null)}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="md:hidden grid gap-3">
          {loading && users.length === 0 ? (
            <div className="rounded-xl border border-dashed border-light-gray bg-off-white p-6 text-center text-sm text-dark-gray">
              Memuat...
            </div>
          ) : visibleUsers.length === 0 ? (
            <div className="rounded-xl border border-dashed border-light-gray bg-off-white p-6 text-center text-sm text-dark-gray">
              {total === 0
                ? 'Belum ada user terdaftar.'
                : 'Tidak ada hasil untuk pencarian ini.'}
            </div>
          ) : (
            visibleUsers.map((u) => (
              <div
                key={u.id}
                className="rounded-xl border border-light-gray bg-white p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-hunter-green">{u.name || u.email}</h3>
                    <div className="mt-1 text-sm text-dark-gray">{u.email}</div>
                    <div className="mt-1 text-xs">
                      <label className="flex items-center gap-2">
                        <span className="font-semibold text-dark-gray">Role</span>
                        <select
                          value={u.role}
                          disabled={busyId === u.id}
                          onChange={(e) =>
                            onChangeRole(u.id, e.target.value as UserRole)
                          }
                          className={[
                            'rounded-md border border-light-gray bg-white px-2 py-1 text-xs font-semibold focus:border-hunter-green focus:outline-none disabled:opacity-50',
                            u.role === 'admin'
                              ? 'text-paprika'
                              : 'text-dark-gray',
                          ].join(' ')}
                        >
                          <option value="member">member</option>
                          <option value="admin">admin</option>
                        </select>
                      </label>
                    </div>
                    <div className="mt-1 text-xs text-dark-gray">
                      Dibuat: {formatDate(u.createdAt)}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => togglePopover(u)}
                      disabled={busyId === u.id && grantsLoading !== u.id}
                      aria-expanded={openPopoverFor === u.id}
                      aria-haspopup="dialog"
                      className="rounded-full border border-light-gray px-3 py-1 text-xs font-semibold text-graphite transition-colors hover:border-hunter-green hover:bg-hunter-green/10"
                    >
                      Badge
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(u)}
                      disabled={busyId === u.id}
                      className="rounded-full border border-light-gray px-3 py-1 text-xs font-semibold text-paprika transition-colors hover:border-paprika hover:bg-paprika/10 disabled:opacity-50"
                    >
                      Hapus
                    </button>
                    {openPopoverFor === u.id && (
                      <BadgePopover
                        user={u}
                        catalog={badgeCatalog}
                        grants={grantsByEmail[u.email] ?? []}
                        loading={grantsLoading === u.id}
                        busy={busyId === u.id}
                        onToggle={(key) => void toggleBadge(u, key)}
                        onClose={() => setOpenPopoverFor(null)}
                      />
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-light-gray pt-4">
          <p className="text-xs text-dark-gray">
            {total === 0
              ? '0 user'
              : `Menampilkan ${pageStart + 1}–${Math.min(
                  pageStart + pageSize,
                  total,
                )} dari ${total} user`}{' '}
            · Halaman {page} dari {totalPages}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="inline-flex items-center gap-1 rounded-full border border-light-gray px-3 py-1.5 text-xs font-semibold text-dark-gray transition-colors hover:border-hunter-green hover:text-hunter-green disabled:opacity-40 disabled:hover:border-light-gray disabled:hover:text-dark-gray"
            >
              Sebelumnya
            </button>
            {pageButtons(page, totalPages).map((p, idx) =>
              p === '…' ? (
                <span
                  key={`gap-${idx}`}
                  className="px-1 text-xs text-dark-gray"
                  aria-hidden="true"
                >
                  …
                </span>
              ) : (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p)}
                  disabled={loading}
                  aria-current={p === page ? 'page' : undefined}
                  className={[
                    'h-8 min-w-8 rounded-md px-2 text-xs font-semibold transition-colors disabled:opacity-50',
                    p === page
                      ? 'bg-hunter-green text-white'
                      : 'bg-off-white text-dark-gray hover:bg-light-gray',
                  ].join(' ')}
                >
                  {p}
                </button>
              ),
            )}
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="inline-flex items-center gap-1 rounded-full border border-light-gray px-3 py-1.5 text-xs font-semibold text-dark-gray transition-colors hover:border-hunter-green hover:text-hunter-green disabled:opacity-40 disabled:hover:border-light-gray disabled:hover:text-dark-gray"
            >
              Berikutnya
            </button>
          </div>
        </div>
      </section>
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

// Compact page-number list with ellipsis around the current page. Mirrors
// the gallery editor's pager — uses raw <button>s (not <Link>) because
// pagination state lives in React, not the URL.
function pageButtons(current: number, totalPages: number): (number | '…')[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const out: (number | '…')[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(totalPages - 1, current + 1);
  if (start > 2) out.push('…');
  for (let i = start; i <= end; i++) out.push(i);
  if (end < totalPages - 1) out.push('…');
  out.push(totalPages);
  return out;
}

function BadgePopover({
  user,
  catalog,
  grants,
  loading,
  busy,
  onToggle,
  onClose,
}: {
  user: UserRecord;
  catalog: BadgeCatalogRecord[];
  grants: GrantedBadge[];
  loading: boolean;
  busy: boolean;
  onToggle: (badgeKey: string) => void;
  onClose: () => void;
}) {
  const grantedKeys = new Set(grants.map((g) => g.key));
  // Close on click outside / Escape.
  const panelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label={`Badge untuk ${user.email}`}
      className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-light-gray bg-white p-3 shadow-xl"
    >
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-graphite">
          Badge {user.name || user.email}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-dark-gray transition-colors hover:bg-light-gray"
          aria-label="Close"
        >
          ✕
        </button>
      </div>
      {loading ? (
        <p className="py-3 text-center text-xs text-dark-gray">Memuat…</p>
      ) : catalog.length === 0 ? (
        <p className="rounded-md border border-dashed border-light-gray p-3 text-center text-xs text-dark-gray">
          Belum ada badge di katalog. Tambahkan lewat endpoint
          <code className="mx-1 rounded bg-off-white px-1 py-0.5">/api/admin/badges</code>.
        </p>
      ) : (
        <ul className="max-h-64 space-y-1 overflow-y-auto">
          {catalog.map((b) => {
            const granted = grantedKeys.has(b.key);
            return (
              <li key={b.key}>
                <button
                  type="button"
                  onClick={() => onToggle(b.key)}
                  disabled={busy}
                  className={[
                    'flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors',
                    granted
                      ? 'bg-hunter-green/10 text-hunter-green'
                      : 'hover:bg-off-white text-graphite',
                  ].join(' ')}
                  aria-pressed={granted}
                >
                  <span className="flex items-center gap-2 truncate whitespace-pre-wrap">
                    <span aria-hidden="true">{b.icon || '🏅'}</span>
                    <span className="truncate whitespace-pre-wrap">{b.label}</span>
                  </span>
                  <span className="shrink-0 text-[0.65rem] font-semibold uppercase tracking-wider">
                    {granted ? 'Granted' : 'Grant'}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
