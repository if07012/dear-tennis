'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type { GroqKeyRecord, GroqLogRecord, PagedGroqLogs } from '@/lib/groq-store';
import { AdminTableToolbar } from '@/components/admin/AdminTableToolbar';
import { ResponsiveTable } from '@/components/admin/ResponsiveTable';
import { ResponsivePagination } from '@/components/admin/ResponsivePagination';
import { MobileActionMenu } from '@/components/admin/MobileActionMenu';

const FIELD_LABEL_CLS =
  'text-xs font-semibold uppercase tracking-wider text-dark-gray';
const INPUT_CLS =
  'w-full rounded-lg border border-light-gray bg-white px-3 py-2 text-sm focus:border-hunter-green focus:outline-none';

const LOG_BADGE: Record<GroqLogRecord['status'], string> = {
  success: 'bg-hunter-green/10 text-hunter-green',
  '429': 'bg-amber-100 text-amber-800',
  error: 'bg-paprika/10 text-paprika',
};

type Toast =
  | { kind: 'idle' }
  | { kind: 'saved'; at: number }
  | { kind: 'error'; message: string };

function formatDate(iso?: string): string {
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

type Props = {
  initialKeys: GroqKeyRecord[];
  initialLogs: PagedGroqLogs;
};

export function GroqClient({ initialKeys, initialLogs }: Props) {
  const { user } = useAuth();
  const [tab, setTab] = useState<'keys' | 'logs'>('keys');
  const [toast, setToast] = useState<Toast>({ kind: 'idle' });

  // Keys state
  const [keys, setKeys] = useState<GroqKeyRecord[]>(initialKeys);
  const [newKey, setNewKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [keySearch, setKeySearch] = useState('');
  const [keyPage, setKeyPage] = useState(1);
  const [keyPageSize, setKeyPageSize] = useState(10);
  const KEY_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

  // Logs state
  const [logs, setLogs] = useState<PagedGroqLogs>(initialLogs);
  const [logFilter, setLogFilter] = useState<'' | GroqLogRecord['status']>('');
  const [logsLoading, setLogsLoading] = useState(false);

  useEffect(() => {
    if (toast.kind === 'error' || toast.kind === 'saved') {
      const t = setTimeout(() => setToast({ kind: 'idle' }), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const api = useCallback(
    async (path: string, init: RequestInit) => {
      const res = await fetch(path, {
        ...init,
        headers: {
          'content-type': 'application/json',
          'x-auth-email': user?.email ?? '',
          ...(init.headers ?? {}),
        },
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      return res.json();
    },
    [user?.email],
  );

  const addKey = async () => {
    setBusy(true);
    try {
      const body = (await api('/api/admin/groq-keys', {
        method: 'POST',
        body: JSON.stringify({ fullKey: newKey }),
      })) as { key: GroqKeyRecord };
      setKeys((prev) => [...prev, body.key]);
      setNewKey('');
      setToast({ kind: 'saved', at: Date.now() });
    } catch (e) {
      setToast({ kind: 'error', message: e instanceof Error ? e.message : 'Gagal' });
    } finally {
      setBusy(false);
    }
  };

  const removeKey = async (id: string) => {
    if (!window.confirm('Hapus API key ini?')) return;
    try {
      await api('/api/admin/groq-keys', {
        method: 'DELETE',
        body: JSON.stringify({ id }),
      });
      setKeys((prev) => prev.filter((k) => k.id !== id));
      setToast({ kind: 'saved', at: Date.now() });
    } catch (e) {
      setToast({ kind: 'error', message: e instanceof Error ? e.message : 'Gagal' });
    }
  };

  const moveKey = async (id: string, dir: -1 | 1) => {
    const idx = keys.findIndex((k) => k.id === id);
    const next = idx + dir;
    if (idx < 0 || next < 0 || next >= keys.length) return;
    const reordered = [...keys];
    [reordered[idx], reordered[next]] = [reordered[next], reordered[idx]];
    setKeys(reordered); // optimistic
    try {
      await api('/api/admin/groq-keys', {
        method: 'PATCH',
        body: JSON.stringify({ ids: reordered.map((k) => k.id) }),
      });
    } catch (e) {
      setToast({ kind: 'error', message: e instanceof Error ? e.message : 'Gagal' });
    }
  };

  const fetchLogs = useCallback(
    async (page: number, status: '' | GroqLogRecord['status']) => {
      setLogsLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: '20',
          ...(status ? { status } : {}),
        });
        setLogs(
          (await api(`/api/admin/groq-logs?${params}`, { method: 'GET' })) as PagedGroqLogs,
        );
      } catch (e) {
        setToast({ kind: 'error', message: e instanceof Error ? e.message : 'Gagal' });
      } finally {
        setLogsLoading(false);
      }
    },
    [api],
  );

  const downloadCsv = () => {
    const head = 'waktu,kunci,status,durasiMs,chatId,error';
    const rows = logs.items.map((l) =>
      [
        l.createdAt,
        l.maskedKey,
        l.status,
        l.durationMs,
        l.chatId,
        (l.errorMessage ?? '').replace(/[",\n]/g, ' '),
      ]
        .map((v) => `"${String(v)}"`)
        .join(','),
    );
    const blob = new Blob([[head, ...rows].join('\n')], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `groq-logs-page${logs.page}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredKeys = useMemo(() => {
    const q = keySearch.trim().toLowerCase();
    if (!q) return keys;
    return keys.filter((k) => k.maskedKey.toLowerCase().includes(q));
  }, [keys, keySearch]);

  const keyPageStart = (keyPage - 1) * keyPageSize;
  const keyPageItems = useMemo(
    () => filteredKeys.slice(keyPageStart, keyPageStart + keyPageSize),
    [filteredKeys, keyPageStart, keyPageSize],
  );
  const keyTotalPages = Math.max(1, Math.ceil(filteredKeys.length / keyPageSize));

  const changeKeyPageSize = (newSize: number) => {
    setKeyPageSize(newSize);
    setKeyPage(1);
  };

  const keyColumns = useMemo(() => [
    {
      key: 'number',
      header: '#',
      priority: 1 as const,
      className: 'w-12',
      render: (item: GroqKeyRecord) => {
        const idx = filteredKeys.findIndex((k) => k.id === item.id);
        return (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-paprika/10 font-serif text-base font-bold text-paprika">
            {idx + 1}.
          </div>
        );
      },
    },
    {
      key: 'maskedKey',
      header: 'Kunci API',
      priority: 1 as const,
      render: (item: GroqKeyRecord) => (
        <code className="font-mono text-sm">{item.maskedKey}</code>
      ),
    },
    {
      key: 'createdAt',
      header: 'Dibuat',
      priority: 2 as const,
      className: 'w-40',
      render: (item: GroqKeyRecord) => (
        <span className="text-xs text-dark-gray whitespace-nowrap">{formatDate(item.createdAt)}</span>
      ),
    },
  ], [filteredKeys, formatDate]);

  const getKeyRowActions = (item: GroqKeyRecord) => [
    {
      label: 'Naikkan',
      primary: false,
      disabled: () => filteredKeys.findIndex((k) => k.id === item.id) === 0,
      onClick: () => moveKey(item.id, -1),
    },
    {
      label: 'Turunkan',
      primary: false,
      disabled: () => filteredKeys.findIndex((k) => k.id === item.id) === filteredKeys.length - 1,
      onClick: () => moveKey(item.id, 1),
    },
    {
      label: 'Hapus',
      primary: false,
      destructive: true,
      onClick: () => removeKey(item.id),
    },
  ];

  const logColumns = useMemo(() => [
    {
      key: 'waktu',
      header: 'Waktu',
      priority: 1 as const,
      className: 'w-40',
      render: (item: GroqLogRecord) => (
        <span className="text-xs whitespace-nowrap">{formatDate(item.createdAt)}</span>
      ),
    },
    {
      key: 'kunci',
      header: 'Kunci',
      priority: 1 as const,
      render: (item: GroqLogRecord) => (
        <code className="font-mono text-xs">{item.maskedKey}</code>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      priority: 1 as const,
      className: 'w-32',
      render: (item: GroqLogRecord) => (
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${LOG_BADGE[item.status]}`}>
          {item.status}
        </span>
      ),
    },
    {
      key: 'durasi',
      header: 'Durasi',
      priority: 2 as const,
      className: 'w-28',
      render: (item: GroqLogRecord) => (
        <span className="text-xs whitespace-nowrap">{item.durationMs} ms</span>
      ),
    },
    {
      key: 'chat',
      header: 'Chat',
      priority: 2 as const,
      className: 'w-32',
      render: (item: GroqLogRecord) => (
        <code className="font-mono text-xs">{item.chatId || '—'}</code>
      ),
    },
    {
      key: 'error',
      header: 'Error',
      priority: 3 as const,
      render: (item: GroqLogRecord) => (
        <span className="max-w-[16rem] truncate text-xs text-dark-gray">{item.errorMessage ?? '—'}</span>
      ),
    },
  ], [LOG_BADGE, formatDate]);

  return (
    <div className="container-base section-padding">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-paprika">
            Admin
          </p>
          <h1 className="font-serif text-3xl font-bold text-hunter-green">
            Groq Bot
          </h1>
          <p className="mt-1 text-sm text-dark-gray">
            Kunci API rotasi untuk chatbot WhatsApp + log pemanggilan Groq.
          </p>
        </div>
        {toast.kind === 'saved' && (
          <span className="rounded-full bg-hunter-green/10 px-3 py-1 text-xs font-semibold text-hunter-green">
            Tersimpan
          </span>
        )}
        {toast.kind === 'error' && (
          <span className="rounded-full bg-paprika/10 px-3 py-1 text-xs font-semibold text-paprika">
            {toast.message}
          </span>
        )}
      </header>

      <div className="mb-4 flex gap-2">
        {(['keys', 'logs'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              tab === t
                ? 'bg-hunter-green text-white'
                : 'bg-white text-dark-gray hover:bg-hunter-green/10'
            }`}
          >
            {t === 'keys' ? 'Kunci API' : 'Log Pemanggilan'}
          </button>
        ))}
      </div>

      {tab === 'keys' && (
        <section className="rounded-2xl border border-light-gray bg-white">
          <div className="border-b border-light-gray px-5 py-4">
            <p className="text-sm text-dark-gray">
              Urutan = prioritas rotasi. Saat kunci kena rate limit (429),
              bot otomatis pindah ke kunci berikutnya.
            </p>
          </div>
          <AdminTableToolbar
            searchValue={keySearch}
            onSearchChange={setKeySearch}
            searchPlaceholder="Cari kunci API"
            onAdd={addKey}
            addLabel="Tambah"
            loading={busy}
          />

          <ResponsiveTable<GroqKeyRecord>
            items={keyPageItems}
            rowKey={(i) => i.id}
            columns={keyColumns}
            actions={getKeyRowActions}
            emptyMessage={keys.length === 0 ? 'Belum ada kunci API. Bot tidak bisa memanggil Groq sampai ada minimal satu kunci.' : 'Tidak ada hasil untuk pencarian ini.'}
            loading={false}
            mobileCardRender={(item) => (
              <>
                <div className="admin-card-header">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-paprika/10 font-serif text-base font-bold text-paprika">
                      {filteredKeys.findIndex((k) => k.id === item.id) + 1}.
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-medium text-hunter-green truncate font-mono text-sm">{item.maskedKey}</h3>
                      <p className="text-xs text-dark-gray">Dibuat: {formatDate(item.createdAt)}</p>
                    </div>
                  </div>
                </div>
                <div className="admin-card-actions">
                  <button
                    type="button"
                    onClick={() => moveKey(item.id, -1)}
                    disabled={filteredKeys.findIndex((k) => k.id === item.id) === 0}
                    className="admin-card-action-primary admin-touch-target"
                  >
                    Naikkan
                  </button>
                  <button
                    type="button"
                    onClick={() => moveKey(item.id, 1)}
                    disabled={filteredKeys.findIndex((k) => k.id === item.id) === filteredKeys.length - 1}
                    className="admin-card-action-primary admin-touch-target"
                  >
                    Turunkan
                  </button>
                  <button
                    type="button"
                    onClick={() => removeKey(item.id)}
                    className="admin-card-action-primary admin-card-action-destructive admin-touch-target"
                  >
                    Hapus
                  </button>
                </div>
              </>
            )}
          />

          <ResponsivePagination
            page={keyPage}
            totalPages={keyTotalPages}
            onPageChange={setKeyPage}
          />
        </section>
      )}

      {tab === 'logs' && (
        <section className="rounded-2xl border border-light-gray bg-white">
          <AdminTableToolbar
            searchValue={logFilter}
            onSearchChange={(v: string) => setLogFilter(v as '' | GroqLogRecord['status'])}
            searchPlaceholder="Filter status"
            addLabel="Unduh CSV (halaman ini)"
            onAdd={downloadCsv}
            loading={logsLoading}
          />

          <ResponsiveTable<GroqLogRecord>
            items={logs.items}
            rowKey={(i) => i.id}
            columns={logColumns}
            actions={undefined}
            emptyMessage="Belum ada log."
            loading={logsLoading}
            mobileCardRender={(item) => (
              <>
                <div className="admin-card-header">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-hunter-green">{item.maskedKey}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${LOG_BADGE[item.status]}`}>
                      {item.status}
                    </span>
                  </div>
                </div>
                <div className="admin-card-body">
                  <div className="admin-card-row">
                    <span className="admin-card-label">Waktu:</span>
                    <span className="admin-card-value flex-1 truncate text-xs text-dark-gray">{formatDate(item.createdAt)}</span>
                  </div>
                  <div className="admin-card-row">
                    <span className="admin-card-label">Durasi:</span>
                    <span className="admin-card-value flex-1 truncate text-xs text-dark-gray">{item.durationMs} ms</span>
                  </div>
                  <div className="admin-card-row">
                    <span className="admin-card-label">Chat:</span>
                    <span className="admin-card-value flex-1 truncate text-xs font-mono text-dark-gray">{item.chatId || '—'}</span>
                  </div>
                  <div className="admin-card-row">
                    <span className="admin-card-label">Error:</span>
                    <span className="admin-card-value flex-1 truncate text-xs text-dark-gray">{item.errorMessage ?? '—'}</span>
                  </div>
                </div>
              </>
            )}
          />

          <ResponsivePagination
            page={logs.page}
            totalPages={logs.totalPages}
            onPageChange={(page) => fetchLogs(page, logFilter)}
          />
        </section>
      )}
    </div>
  );
}
