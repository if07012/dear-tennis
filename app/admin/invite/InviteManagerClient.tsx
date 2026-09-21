'use client';

import { useCallback, useMemo, useState } from 'react';
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
import { AdminTableToolbar } from '@/components/admin/AdminTableToolbar';
import { ResponsiveTable } from '@/components/admin/ResponsiveTable';
import { ResponsivePagination } from '@/components/admin/ResponsivePagination';
import { ResponsiveModal } from '@/components/admin/ResponsiveModal';
import { MobileActionMenu } from '@/components/admin/MobileActionMenu';

type SaveStatus =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved'; at: number }
  | { kind: 'error'; message: string };

const FIELD_LABEL_CLS =
  'text-xs font-semibold uppercase tracking-wider text-dark-gray';
const INPUT_CLS =
  'w-full rounded-lg border border-light-gray bg-white px-3 py-2 text-sm focus:border-hunter-green focus:outline-none';

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
  const [pageSize, setPageSize] = useState(initial.pageSize);
  const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
  const [totalPages, setTotalPages] = useState(initial.totalPages);
  const [total, setTotal] = useState(initial.total);
  const [loadingPage, setLoadingPage] = useState(false);
  const [search, setSearch] = useState('');
  const [editingStatus, setEditingStatus] = useState<{ id: string; status: InviteStatus } | null>(null);

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

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.email.toLowerCase().includes(q) ||
        (i.name ?? '').toLowerCase().includes(q) ||
        (i.message ?? '').toLowerCase().includes(q) ||
        i.status.toLowerCase().includes(q),
    );
  }, [items, search]);

  const pageItems = useMemo(
    () => filteredItems.slice(pageStart, pageStart + pageSize),
    [filteredItems, pageStart, pageSize],
  );
  const totalPagesFiltered = Math.max(1, Math.ceil(filteredItems.length / pageSize));

  const changePageSize = (newSize: number) => {
    setPageSize(newSize);
    setPage(1);
  };

  const inviteColumns = useMemo(() => [
    {
      key: 'number',
      header: '#',
      priority: 1 as const,
      className: 'w-12',
      render: (item: Invite) => {
        const idx = filteredItems.findIndex((i) => i.id === item.id);
        return (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-paprika/10 font-serif text-base font-bold text-paprika">
            {idx + 1}.
          </div>
        );
      },
    },
    {
      key: 'email',
      header: 'Email',
      priority: 1 as const,
      render: (item: Invite) => (
        <div>
          <span className="font-semibold text-hunter-green">{item.name || item.email}</span>
          {item.name && <span className="text-xs text-dark-gray ml-2">({item.email})</span>}
        </div>
      ),
    },
    {
      key: 'message',
      header: 'Pesan',
      priority: 2 as const,
      className: 'max-w-[200px]',
      render: (item: Invite) => (
        <span className="text-sm text-dark-gray truncate whitespace-pre-wrap max-w-full">{item.message || '—'}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      priority: 1 as const,
      className: 'w-32',
      render: (item: Invite) => (
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE_CLS[item.status]}`}>
          {item.status}
        </span>
      ),
    },
    {
      key: 'invitedAt',
      header: 'Tanggal',
      priority: 2 as const,
      className: 'w-40',
      render: (item: Invite) => (
        <span className="text-xs text-dark-gray whitespace-nowrap">{formatDate(item.invitedAt)}</span>
      ),
    },
    {
      key: 'createdBy',
      header: 'Oleh',
      priority: 3 as const,
      className: 'w-32',
      render: (item: Invite) => (
        <span className="text-xs text-dark-gray">{item.createdBy || '—'}</span>
      ),
    },
  ], [filteredItems]);

  const getRowActions = (item: Invite) => {
    const actions = [
      {
        label: 'Edit Status',
        primary: true,
        onClick: () => setEditingStatus({ id: item.id, status: item.status }),
      },
      {
        label: 'Hapus',
        primary: false,
        destructive: true,
        onClick: () => onDelete(item.id),
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
            Invite Members
          </h1>
          <p className="mt-1 text-sm text-dark-gray">
            Catat undangan membership di Google Sheet. Status undangan
            dipakai untuk melacak siklus hidup: pending → sent → accepted /
            cancelled.
          </p>
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

        <form onSubmit={onCreate} className="mt-6 admin-form-grid">
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
              className="rounded-full bg-paprika px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-paprika-hover disabled:opacity-50 admin-touch-target"
            >
              {submitStatus.kind === 'saving' ? 'Mengirim...' : 'Undang'}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-light-gray bg-white p-6">
        <AdminTableToolbar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Cari email / nama / status"
          onAdd={() => onCreate({} as React.FormEvent<HTMLFormElement>)}
          addLabel="Undang"
          loading={false}
          pageSize={pageSize}
          onPageSizeChange={changePageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
        />

        <ResponsiveTable<Invite>
          items={pageItems}
          rowKey={(i) => i.id}
          columns={inviteColumns}
          actions={getRowActions}
          emptyMessage={items.length === 0 ? 'Belum ada undangan. Gunakan form di atas untuk menambah.' : 'Tidak ada hasil untuk pencarian ini.'}
          loading={loadingPage}
          mobileCardRender={(item) => {
            const { primaryActions, secondaryActions } = getRowActions(item);
            return (
              <>
                <div className="admin-card-header">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-paprika/10 text-paprika">
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
                    <div className="min-w-0">
                      <h3 className="font-medium text-hunter-green truncate">{item.name || item.email}</h3>
                      {item.name && <p className="text-xs text-dark-gray">{item.email}</p>}
                    </div>
                  </div>
                </div>
                <div className="admin-card-body">
                  {item.message && (
                    <div className="admin-card-row">
                      <span className="admin-card-label">Pesan:</span>
                      <span className="admin-card-value flex-1 truncate text-xs text-dark-gray">{item.message}</span>
                    </div>
                  )}
                  <div className="admin-card-row">
                    <span className="admin-card-label">Tanggal:</span>
                    <span className="admin-card-value flex-1 truncate text-xs text-dark-gray">{formatDate(item.invitedAt)}</span>
                  </div>
                  {item.createdBy && (
                    <div className="admin-card-row">
                      <span className="admin-card-label">Oleh:</span>
                      <span className="admin-card-value flex-1 truncate text-xs text-dark-gray">{item.createdBy}</span>
                    </div>
                  )}
                  <div className="admin-card-row">
                    <span className="admin-card-label">Status:</span>
                    <span className="admin-card-value flex-1 truncate">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE_CLS[item.status]}`}>
                        {item.status}
                      </span>
                    </span>
                  </div>
                </div>
                <div className="admin-card-actions">
                  {primaryActions.map((action) => (
                    <button
                      key={action.label}
                      type="button"
                      onClick={() => action.onClick(item)}
                      disabled={action.disabled?.(item)}
                      className={[
                        'admin-card-action-primary admin-touch-target',
                        action.destructive && 'admin-card-action-destructive',
                        action.disabled?.(item) && 'opacity-50 pointer-events-none',
                      ].join(' ')}
                    >
                      {action.label}
                    </button>
                  ))}
                  {secondaryActions.length > 0 && (
                    <MobileActionMenu
                      trigger={<span className="admin-action-menu-button admin-touch-target">•••</span>}
                      actions={secondaryActions.map((action) => ({
                        label: action.label,
                        onClick: () => action.onClick(item),
                        destructive: action.destructive,
                        disabled: action.disabled?.(item),
                      }))}
                    />
                  )}
                </div>
              </>
            );
          }}
        />

        <ResponsivePagination
          page={safePage}
          totalPages={totalPagesFiltered}
          onPageChange={setPage}
        />
      </section>

      {editingStatus && (
        <ResponsiveModal
          isOpen={editingStatus !== null}
          onClose={() => setEditingStatus(null)}
          title="Edit Status Undangan"
          fullScreenOnMobile={true}
          maxWidth="sm"
          footer={
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditingStatus(null)}
                className="rounded-full border border-light-gray px-4 py-2 text-sm font-semibold text-dark-gray transition-colors hover:border-dark-gray admin-touch-target"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  if (editingStatus) {
                    onUpdateStatus(editingStatus.id, editingStatus.status);
                    setEditingStatus(null);
                  }
                }}
                className="rounded-full bg-paprika px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-paprika-hover admin-touch-target"
              >
                Simpan
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            <label className="flex flex-col gap-1">
              <span className={FIELD_LABEL_CLS}>Status</span>
              <select
                value={editingStatus.status}
                onChange={(e) => setEditingStatus({ ...editingStatus, status: e.target.value as InviteStatus })}
                className={INPUT_CLS}
              >
                {INVITE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </ResponsiveModal>
      )}
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