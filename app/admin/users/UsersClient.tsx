'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { XIcon } from '@/components/ui/Icons';
import type { PagedUsers, UserRecord, UserRole } from '@/lib/users-store';
import { ResponsiveTable } from '@/components/admin/ResponsiveTable';
import { AdminTableToolbar } from '@/components/admin/AdminTableToolbar';
import { MobileActionMenu } from '@/components/admin/MobileActionMenu';
import { ResponsivePagination } from '@/components/admin/ResponsivePagination';
import { ResponsiveModal } from '@/components/admin/ResponsiveModal';
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
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [editRole, setEditRole] = useState<UserRole>('member');

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
      setEditingUser(null);
    } catch (e) {
      setToast({
        kind: 'error',
        message: e instanceof Error ? e.message : 'Failed to update role',
      });
    } finally {
      setBusyId(null);
    }
  };

  const openRoleEdit = (user: UserRecord) => {
    setEditingUser(user);
    setEditRole(user.role);
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

  // Column definitions for ResponsiveTable
  const columns = useMemo(() => [
    {
      key: 'name',
      header: 'Nama',
      priority: 1 as const,
      render: (u: UserRecord) => (
        <span className="font-medium text-hunter-green">{u.name || u.email}</span>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      priority: 1 as const,
      render: (u: UserRecord) => (
        <span className="text-dark-gray">{u.email}</span>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      priority: 1 as const,
      render: (u: UserRecord) => (
        <span className={[
          'rounded-full px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider',
          u.role === 'admin' ? 'bg-paprika/10 text-paprika' : 'bg-hunter-green/10 text-hunter-green',
        ].join(' ')}>
          {u.role}
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Dibuat',
      priority: 2 as const,
      render: (u: UserRecord) => (
        <span className="text-xs text-dark-gray">{formatDate(u.createdAt)}</span>
      ),
    },
  ], []);

  const getRowActions = (user: UserRecord) => {
    const actions = [
      {
        label: 'Profile',
        primary: true,
        onClick: () => {
          window.location.href = `/profile?user=${encodeURIComponent(user.email)}`;
        },
      },
      {
        label: 'Badge',
        primary: false,
        onClick: () => togglePopover(user),
      },
      {
        label: 'Edit Role',
        primary: false,
        onClick: () => openRoleEdit(user),
      },
      {
        label: 'Hapus',
        primary: false,
        destructive: true,
        onClick: () => onDelete(user),
      },
    ];
    return actions;
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
        <AdminTableToolbar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Cari berdasarkan nama, email, atau role"
          loading={loading}
          pageSize={pageSize}
          onPageSizeChange={changePageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
        />

        <ResponsiveTable
          items={visibleUsers}
          rowKey={(u) => u.id}
          columns={columns}
          actions={getRowActions}
          emptyMessage={total === 0 ? 'Belum ada user terdaftar.' : 'Tidak ada hasil untuk pencarian ini.'}
          loading={loading}
        />

        <ResponsivePagination
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          disabled={loading}
          showPageNumbers={true}
        />
      </section>

      {editingUser && (
        <ResponsiveModal
          isOpen={editingUser !== null}
          onClose={() => setEditingUser(null)}
          title="Edit Role"
          fullScreenOnMobile={true}
          maxWidth="sm"
          footer={
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="rounded-full border border-light-gray px-4 py-2 text-sm font-semibold text-dark-gray transition-colors hover:border-dark-gray admin-touch-target"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => onChangeRole(editingUser.id, editRole)}
                disabled={busyId === editingUser.id}
                className="rounded-full bg-paprika px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-paprika-hover disabled:opacity-50 admin-touch-target"
              >
                {busyId === editingUser.id ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-dark-gray mb-2">
                User
              </label>
              <p className="text-sm text-graphite">{editingUser.name || editingUser.email}</p>
              <p className="text-xs text-dark-gray">{editingUser.email}</p>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-dark-gray mb-2">
                Role
              </label>
              <select
                value={editRole}
                onChange={(e) => setEditRole(e.target.value as UserRole)}
                className="w-full rounded-lg border border-light-gray bg-white px-3 py-2 text-sm focus:border-hunter-green focus:outline-none"
              >
                <option value="member">member</option>
                <option value="admin">admin</option>
              </select>
            </div>
          </div>
        </ResponsiveModal>
      )}

      {openPopoverFor && (
        <BadgePopover
          user={users.find((u) => u.id === openPopoverFor) as UserRecord}
          catalog={badgeCatalog}
          grants={grantsByEmail[users.find((u) => u.id === openPopoverFor)?.email ?? ''] ?? []}
          loading={grantsLoading === openPopoverFor}
          busy={busyId === openPopoverFor}
          onToggle={(key) => {
            const user = users.find((u) => u.id === openPopoverFor);
            if (user) void toggleBadge(user, key);
          }}
          onClose={() => setOpenPopoverFor(null)}
        />
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-graphite/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-graphite">
            Badge {user.name || user.email}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-dark-gray transition-colors hover:bg-light-gray admin-touch-target"
            aria-label="Close"
          >
            <XIcon size={20} />
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
                      'flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors admin-touch-target',
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
    </div>
  );
}
