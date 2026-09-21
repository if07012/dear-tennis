'use client';

// ============================================
// CLICK TRACKING DASHBOARD (admin)
// ============================================
// Stats cards + filter bar (quick date presets, Enter submits) + sortable
// table with Load-More. Polls every 30s while the tab is visible and still
// on page 1 (no Supabase Realtime — lean cut per plan).

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  CLICK_SORT_COLUMNS,
  type ClickEvent,
  type ClicksAdminPayload,
  type ClickStats,
} from '@/data/click-tracking-types';
import { AdminTableToolbar } from '@/components/admin/AdminTableToolbar';
import { ResponsiveTable } from '@/components/admin/ResponsiveTable';
import { ResponsivePagination } from '@/components/admin/ResponsivePagination';

const INPUT_CLS =
  'w-full rounded-lg border border-light-gray bg-white px-3 py-2 text-sm focus:border-hunter-green focus:outline-none';

const POLL_MS = 30_000;

const ELEMENT_LABELS: Record<ClickEvent['elementType'], string> = {
  a: 'Tautan',
  button: 'Tombol',
  other: 'Lainnya',
};

const DATE_PRESETS = [
  { label: 'Hari ini', days: 1 },
  { label: '7 hari', days: 7 },
  { label: '30 hari', days: 30 },
] as const;

type SortColumn = (typeof CLICK_SORT_COLUMNS)[number];
type AriaSortVal = 'ascending' | 'descending' | undefined;

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

function formatCount(n: number): string {
  return n.toLocaleString('id-ID');
}

// Inline lucide-style icons — matches InviteManagerClient, no icon library.
function Icon({ d, className }: { d: string; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? 'h-4 w-4'}
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

const ICONS = {
  clock: 'M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  cursor: 'M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z',
  user: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Zm9 14v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  globe: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 0c2.5 2.5 4 6 4 10s-1.5 7.5-4 10c-2.5-2.5-4-6-4-10s1.5-7.5 4-10ZM2 12h20',
  monitor: 'M3 4h18v12H3zM8 21h8M12 16v5',
  smartphone: 'M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm4 18h.01',
  clockTz: 'M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  link: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71',
  arrowLeft: 'M19 12H5M12 19l-7-7 7-7',
};

type Props = { initial: ClicksAdminPayload; pageSize: number };

export function ClicksClient({ initial, pageSize }: Props) {
  const { user } = useAuth();
  const [clicks, setClicks] = useState<ClickEvent[]>(initial.clicks);
  const [total, setTotal] = useState(initial.total);
  const [totalPages, setTotalPages] = useState(initial.totalPages);
  const [page, setPage] = useState(initial.page);
  const [stats, setStats] = useState<ClickStats>(initial.stats);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  // Input state vs applied state: Terapkan commits the filters.
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [applied, setApplied] = useState<{ q: string; from: string; to: string }>({
    q: '',
    from: '',
    to: '',
  });
  const [sort, setSort] = useState<SortColumn>('clickedAt');
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');

  const fetchClicks = useCallback(
    async (targetPage: number, append: boolean) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(targetPage),
          pageSize: String(pageSize),
          sort,
          dir,
        });
        if (applied.q) params.set('q', applied.q);
        if (applied.from) params.set('from', new Date(applied.from).toISOString());
        if (applied.to) params.set('to', new Date(`${applied.to}T23:59:59`).toISOString());

        const res = await fetch(`/api/admin/clicks?${params.toString()}`, {
          headers: { 'x-auth-email': user?.email ?? '' },
          cache: 'no-store',
        });
        if (!res.ok) {
          setError('Gagal memuat data klik.');
          return;
        }
        const body = (await res.json()) as ClicksAdminPayload;
        setError(null);
        setUpdatedAt(new Date());
        setClicks((prev) => (append ? [...prev, ...body.clicks] : body.clicks));
        setTotal(body.total);
        setTotalPages(body.totalPages);
        setStats(body.stats);
        setPage(targetPage);
      } catch {
        // Keep current data — a refresh failure is non-fatal.
        setError('Gagal memuat data klik.');
      } finally {
        setLoading(false);
      }
    },
    [applied.q, applied.from, applied.to, sort, dir, pageSize, user?.email],
  );

  // 30s polling while visible — replaces Supabase Realtime (lean cut). Only
  // page 1: past Load-More, a poll would wipe the accumulated rows.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible' && !loading && page === 1) {
        void fetchClicks(1, false);
      }
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [fetchClicks, loading, page]);

  // Refetch page 1 whenever committed filters or sort change. The initial
  // render is server-provided, so skip the first run.
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    void fetchClicks(1, false);
  }, [fetchClicks]);

  const applyFilters = () => setApplied({ q: q.trim(), from, to });

  const resetFilters = () => {
    setQ('');
    setFrom('');
    setTo('');
    setApplied({ q: '', from: '', to: '' });
  };

  // Quick range presets — dates only, keeps the committed search term.
  const applyPreset = (days: number) => {
    const end = new Date();
    const start = new Date(end.getTime() - (days - 1) * 86_400_000);
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const nextFrom = fmt(start);
    const nextTo = fmt(end);
    setFrom(nextFrom);
    setTo(nextTo);
    setApplied((prev) => ({ ...prev, from: nextFrom, to: nextTo }));
  };

  const toggleSort = (column: SortColumn) => {
    if (sort === column) {
      setDir(dir === 'asc' ? 'desc' : 'asc');
    } else {
      setSort(column);
      setDir('desc');
    }
  };

  const sortIndicator = (column: SortColumn) =>
    sort === column ? (dir === 'asc' ? ' ↑' : ' ↓') : '';

  const ariaSort = (column: SortColumn): AriaSortVal =>
    sort === column ? (dir === 'asc' ? 'ascending' : 'descending') : undefined;

  const refresh = () => void fetchClicks(1, false);
  const loadMore = () => void fetchClicks(page + 1, true);

  const statEntries = (record: Record<string, number>) =>
    Object.entries(record)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

  return (
    <section className="container-base section-padding">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-graphite">Click Tracking</h1>
            <p className="mt-1 text-sm text-dark-gray">
              Aktivitas klik pengguna di seluruh situs.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {updatedAt && (
              <span className="text-xs text-dark-gray">
                Diperbarui {updatedAt.toLocaleTimeString('id-ID')}
              </span>
            )}
            <button
              type="button"
              onClick={refresh}
              disabled={loading}
              className="rounded-lg border border-light-gray bg-white px-4 py-2 text-sm text-dark-gray hover:bg-off-white disabled:opacity-50"
            >
              {loading ? 'Memuat…' : 'Muat Ulang'}
            </button>
          </div>
        </header>

        {/* Stats cards */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-light-gray bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-dark-gray">
              Klik Hari Ini
            </p>
            <p className="mt-2 text-2xl font-semibold text-hunter-green">
              {formatCount(stats.totalToday)}
            </p>
          </div>
          <div
            className={`rounded-2xl border p-4 ${
              stats.lastMinute > 800
                ? 'border-red-300 bg-red-50'
                : 'border-light-gray bg-white'
            }`}
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-dark-gray">
              Klik Menit Terakhir
            </p>
            <p
              className={`mt-2 text-2xl font-semibold ${
                stats.lastMinute > 800 ? 'text-red-600' : 'text-hunter-green'
              }`}
            >
              {formatCount(stats.lastMinute)}
            </p>
            {stats.lastMinute > 800 && (
              <p className="mt-1 text-xs font-medium text-red-600">
                Volume tinggi — di atas 800/menit
              </p>
            )}
          </div>
          <div className="rounded-2xl border border-light-gray bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-dark-gray">
              Total 7 Hari
            </p>
            <p className="mt-2 text-2xl font-semibold text-hunter-green">
              {formatCount(stats.total7d)}
            </p>
          </div>
          <div className="rounded-2xl border border-light-gray bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-dark-gray">
              Top 5 Tombol (7 hari)
            </p>
            <ul className="mt-2 space-y-1">
              {stats.topButtons7d.length === 0 ? (
                <li className="text-sm text-dark-gray">Belum ada data.</li>
              ) : (
                stats.topButtons7d.map((b) => (
                  <li key={b.buttonText} className="flex justify-between text-sm">
                    <span className="truncate whitespace-pre-wrap pr-2 text-graphite">{b.buttonText}</span>
                    <span className="font-semibold text-hunter-green">{formatCount(b.count)}</span>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>

        {/* Browser / device chips */}
        <div className="mt-4 flex flex-wrap gap-2">
          {statEntries(stats.byBrowser).map(([name, count]) => (
            <span
              key={`b-${name}`}
              className="rounded-full border border-light-gray bg-white px-3 py-1 text-xs text-dark-gray"
            >
              {name}: {count}
            </span>
          ))}
          {statEntries(stats.byDevice).map(([name, count]) => (
            <span
              key={`d-${name}`}
              className="rounded-full border border-light-gray bg-white px-3 py-1 text-xs text-dark-gray"
            >
              {name}: {count}
            </span>
          ))}
          {statEntries(stats.byTimezone).map(([name, count]) => (
            <span
              key={`t-${name}`}
              className="rounded-full border border-light-gray bg-white px-3 py-1 text-xs text-dark-gray"
            >
              {name}: {count}
            </span>
          ))}
        </div>

        {/* Filter bar — form so Enter in any input applies */}
        <AdminTableToolbar
          searchValue={q}
          onSearchChange={setQ}
          searchPlaceholder="Cari tombol, URL, user, IP…"
          onAdd={undefined}
          loading={loading}
        />

        {error && (
          <p className="mt-4 text-sm font-medium text-red-600" role="alert">
            {error}
          </p>
        )}

        {/* Clicks table — desktop only */}
        <div
          className="mt-6 hidden overflow-x-auto rounded-2xl border border-light-gray bg-white md:block"
          aria-busy={loading}
        >
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-light-gray text-left text-xs font-semibold uppercase tracking-wider text-dark-gray">
                <th
                  aria-sort={ariaSort('clickedAt')}
                  className="cursor-pointer py-3 pr-4"
                  onClick={() => toggleSort('clickedAt')}
                >
                  Waktu{sortIndicator('clickedAt')}
                </th>
                <th
                  aria-sort={ariaSort('buttonText')}
                  className="cursor-pointer py-3 pr-4"
                  onClick={() => toggleSort('buttonText')}
                >
                  Tombol{sortIndicator('buttonText')}
                </th>
                <th className="py-3 pr-4">Tipe</th>
                <th className="py-3 pr-4">Pengguna</th>
                <th className="hidden py-3 pr-4 md:table-cell">Browser</th>
                <th className="hidden py-3 pr-4 md:table-cell">Device</th>
                <th className="hidden py-3 pr-4 lg:table-cell">Timezone</th>
                <th className="py-3 pr-4">Activity</th>
                <th
                  aria-sort={ariaSort('targetUrl')}
                  className="cursor-pointer py-3 pr-4"
                  onClick={() => toggleSort('targetUrl')}
                >
                  Target URL{sortIndicator('targetUrl')}
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && clicks.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-dark-gray">
                    Memuat...
                  </td>
                </tr>
              ) : clicks.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-dark-gray">
                    Belum ada klik untuk filter ini.
                  </td>
                </tr>
              ) : (
                clicks.map((row) => (
                  <tr key={row.id} className="border-b border-light-gray/60 last:border-b-0">
                    <td className="whitespace-nowrap py-3 pr-4 text-dark-gray">
                      {formatDate(row.clickedAt)}
                    </td>
                    <td className="py-3 pr-4 font-medium text-hunter-green">
                      {row.buttonText}
                    </td>
                    <td className="py-3 pr-4 text-dark-gray">{ELEMENT_LABELS[row.elementType]}</td>
                    <td className="py-3 pr-4">
                      {row.userName ? (
                        <div>
                          <div className="font-medium text-graphite">{row.userName}</div>
                          <div className="text-xs text-dark-gray">{row.userEmail}</div>
                        </div>
                      ) : (
                        <span className="font-mono text-xs text-dark-gray">{row.ip}</span>
                      )}
                    </td>
                    <td className="hidden py-3 pr-4 text-dark-gray md:table-cell">{row.browser}</td>
                    <td className="hidden py-3 pr-4 text-dark-gray md:table-cell">
                      {row.deviceType}
                    </td>
                    <td className="hidden py-3 pr-4 text-dark-gray lg:table-cell">
                      {row.timezone}
                    </td>
                    <td
                      className="max-w-[12rem] truncate whitespace-pre-wrap py-3 pr-4 text-dark-gray"
                      title={row.activityTitle}
                    >
                      {row.activityTitle || '—'}
                    </td>
                    <td
                      className="max-w-[16rem] truncate whitespace-pre-wrap py-3 pr-4 text-dark-gray"
                      title={row.targetUrl}
                    >
                      {row.targetUrl || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Clicks cards — mobile only */}
        <div className="mt-6 grid gap-3 md:hidden" aria-busy={loading}>
          {loading && clicks.length === 0 ? (
            <p className="rounded-2xl border border-light-gray bg-white py-10 text-center text-sm text-dark-gray">
              Memuat...
            </p>
          ) : clicks.length === 0 ? (
            <p className="rounded-2xl border border-light-gray bg-white py-10 text-center text-sm text-dark-gray">
              Belum ada klik untuk filter ini.
            </p>
          ) : (
            clicks.map((row) => (
              <article key={row.id} className="rounded-2xl border border-light-gray bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-paprika/10 text-paprika">
                      <Icon d={ICONS.cursor} />
                    </span>
                    <span className="min-w-0 truncate whitespace-pre-wrap font-medium text-hunter-green">
                      {row.buttonText}
                    </span>
                  </div>
                  <span className="flex flex-shrink-0 items-center gap-1 text-xs text-dark-gray">
                    <Icon d={ICONS.clock} className="h-3.5 w-3.5" />
                    {formatDate(row.clickedAt)}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-2 text-sm">
                  <div className="flex items-center gap-2 text-dark-gray">
                    <Icon d={ICONS.user} className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="truncate whitespace-pre-wrap">
                      {row.userName ? `${row.userName} (${row.userEmail})` : row.ip}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-dark-gray">
                    <Icon d={ICONS.globe} className="h-3.5 w-3.5 flex-shrink-0" />
                    <span>{row.browser} · {ELEMENT_LABELS[row.elementType]}</span>
                  </div>
                  <div className="flex items-center gap-2 text-dark-gray">
                    <Icon
                      d={row.deviceType === 'mobile' ? ICONS.smartphone : ICONS.monitor}
                      className="h-3.5 w-3.5 flex-shrink-0"
                    />
                    <span className="truncate whitespace-pre-wrap">{row.deviceType} · {row.timezone}</span>
                  </div>
                  <div className="flex items-center gap-2 text-dark-gray">
                    <Icon d={ICONS.link} className="h-3.5 w-3.5 flex-shrink-0" />
                    <a
                      href={row.targetUrl || undefined}
                      className="truncate whitespace-pre-wrap text-hunter-green hover:underline"
                      title={row.targetUrl}
                    >
                      {row.targetUrl || '—'}
                    </a>
                  </div>
                  {row.activityTitle && (
                    <div className="flex items-center gap-2 text-xs text-dark-gray">
                      <Icon d={ICONS.arrowLeft} className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="truncate whitespace-pre-wrap" title={row.activityTitle}>
                        {row.activityTitle}
                      </span>
                    </div>
                  )}
                </div>
              </article>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-dark-gray">
            Menampilkan {clicks.length} dari {formatCount(total)} klik.
          </p>
          {page < totalPages && (
            <button
              type="button"
              className="rounded-lg border border-light-gray bg-white px-4 py-2 text-sm text-dark-gray hover:bg-off-white disabled:opacity-50"
              onClick={loadMore}
              disabled={loading}
            >
              {loading ? 'Memuat...' : 'Muat Lebih Banyak'}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
