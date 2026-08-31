'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/hooks/useAuth';
import { XIcon, SearchIcon } from '@/components/ui/Icons';
import type { PagedUsers, UserRecord } from '@/lib/users-store';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (user: UserRecord) => void;
};

const PAGE_SIZE = 10;
const DEBOUNCE_MS = 250;

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

/**
 * Modal that lets an admin search the user list and pick one to "view as"
 * on the profile page. Uses /api/admin/users with paginated + debounced
 * search. The selected user's email is then encoded into the page URL.
 */
export function AdminUserPicker({ isOpen, onClose, onSelect }: Props) {
  const { user: authUser } = useAuth();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce search input.
  useEffect(() => {
    const id = window.setTimeout(() => {
      setDebouncedSearch(search.trim().toLowerCase());
      setPage(1);
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [search]);

  // Focus search on open.
  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen]);

  const fetchPage = useCallback(
    async (targetPage: number) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          page: String(targetPage),
          pageSize: String(PAGE_SIZE),
        });
        const res = await fetch(`/api/admin/users?${params.toString()}`, {
          headers: { 'x-auth-email': authUser?.email ?? '' },
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        const body = (await res.json()) as PagedUsers;
        setUsers(body.users);
        setTotalPages(body.totalPages);
        setTotal(body.total);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load users');
      } finally {
        setLoading(false);
      }
    },
    [authUser?.email],
  );

  useEffect(() => {
    if (!isOpen) return;
    void fetchPage(page);
  }, [isOpen, page, debouncedSearch, fetchPage]);

  if (!isOpen || typeof document === 'undefined') return null;

  const visibleUsers = debouncedSearch
    ? users.filter(
        (u) =>
          u.email.toLowerCase().includes(debouncedSearch) ||
          u.name.toLowerCase().includes(debouncedSearch),
      )
    : users;

  const pageStart = (page - 1) * PAGE_SIZE;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end justify-center bg-graphite/50 sm:items-center sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Pilih user"
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-light-gray px-5 py-4">
          <div>
            <h3 className="font-serif text-lg font-semibold text-hunter-green">
              Pilih User (Admin View)
            </h3>
            <p className="mt-0.5 text-xs text-dark-gray">
              Lihat profile sebagai user lain
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-dark-gray transition-colors hover:bg-light-gray"
            aria-label="Close"
          >
            <XIcon size={18} />
          </button>
        </div>

        <div className="border-b border-light-gray px-5 py-3">
          <label className="flex items-center gap-2 rounded-full border border-light-gray bg-white px-3 py-1.5 focus-within:border-hunter-green">
            <SearchIcon size={16} className="text-dark-gray" />
            <input
              ref={inputRef}
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama atau email..."
              className="w-full border-0 bg-transparent text-sm text-graphite placeholder:text-dark-gray focus:outline-none"
            />
          </label>
        </div>

        <div className="max-h-[50vh] overflow-y-auto">
          {error ? (
            <p className="px-5 py-6 text-center text-sm text-paprika">{error}</p>
          ) : loading && users.length === 0 ? (
            <p className="px-5 py-6 text-center text-sm text-dark-gray">Memuat...</p>
          ) : visibleUsers.length === 0 ? (
            <p className="px-5 py-6 text-center text-sm text-dark-gray">
              {total === 0
                ? 'Belum ada user terdaftar.'
                : 'Tidak ada hasil untuk pencarian ini.'}
            </p>
          ) : (
            <ul>
              {visibleUsers.map((u) => (
                <li key={u.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(u)}
                    className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-hunter-green/5"
                  >
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-hunter-green text-sm font-bold text-white">
                      {(u.name || u.email).charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-hunter-green">
                        {u.name || u.email}
                      </p>
                      <p className="truncate text-xs text-dark-gray">{u.email}</p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wider ${
                        u.role === 'admin'
                          ? 'bg-paprika/10 text-paprika'
                          : 'bg-hunter-green/10 text-hunter-green'
                      }`}
                    >
                      {u.role}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {total > 0 && !debouncedSearch && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-light-gray px-5 py-3">
            <p className="text-xs text-dark-gray">
              Halaman {page} dari {totalPages} · {total} user
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                className="rounded-full border border-light-gray px-3 py-1 text-xs font-semibold text-dark-gray transition-colors hover:border-hunter-green hover:text-hunter-green disabled:opacity-40"
              >
                Sebelumnya
              </button>
              {pageButtons(page, totalPages).map((p, idx) =>
                p === '…' ? (
                  <span key={`gap-${idx}`} className="px-1 text-xs text-dark-gray" aria-hidden="true">
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
                      'h-7 min-w-7 rounded-md px-2 text-xs font-semibold transition-colors disabled:opacity-50',
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
                className="rounded-full border border-light-gray px-3 py-1 text-xs font-semibold text-dark-gray transition-colors hover:border-hunter-green hover:text-hunter-green disabled:opacity-40"
              >
                Berikutnya
              </button>
            </div>
          </div>
        )}
        {/* pageStart referenced to keep tsc happy when narrowing; not displayed
            because pagination already shows the page number above. */}
        <span className="hidden">{pageStart}</span>
      </div>
    </div>,
    document.body,
  );
}
