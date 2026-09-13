'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type { GroqKeyRecord, GroqLogRecord, PagedGroqLogs } from '@/lib/groq-store';

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
          <div className="flex items-center gap-3 border-b border-light-gray px-5 py-4">
            <input
              type="password"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              placeholder="gsk_…"
              className={INPUT_CLS}
              disabled={busy}
            />
            <button
              type="button"
              onClick={addKey}
              disabled={busy || !newKey.trim()}
              className="shrink-0 rounded-full bg-paprika px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-paprika-hover disabled:opacity-40"
            >
              Tambah
            </button>
          </div>
          {keys.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-dark-gray">
              Belum ada kunci API. Bot tidak bisa memanggil Groq sampai ada
              minimal satu kunci.
            </p>
          ) : (
            <ul className="divide-y divide-light-gray">
              {keys.map((k, i) => (
                <li key={k.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="w-6 text-xs font-semibold text-dark-gray">
                    {i + 1}.
                  </span>
                  <code className="flex-1 font-mono text-sm">{k.maskedKey}</code>
                  <button
                    type="button"
                    onClick={() => moveKey(k.id, -1)}
                    disabled={i === 0}
                    aria-label="Naikkan prioritas"
                    className="rounded-md p-1 text-dark-gray hover:bg-light-gray disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveKey(k.id, 1)}
                    disabled={i === keys.length - 1}
                    aria-label="Turunkan prioritas"
                    className="rounded-md p-1 text-dark-gray hover:bg-light-gray disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => removeKey(k.id)}
                    className="text-xs font-semibold text-paprika hover:underline"
                  >
                    Hapus
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === 'logs' && (
        <section className="rounded-2xl border border-light-gray bg-white">
          <div className="flex flex-wrap items-center gap-3 border-b border-light-gray px-5 py-3">
            <select
              value={logFilter}
              onChange={(e) => {
                const v = e.target.value as '' | GroqLogRecord['status'];
                setLogFilter(v);
                fetchLogs(1, v);
              }}
              className={`${INPUT_CLS} w-auto`}
            >
              <option value="">Semua status</option>
              <option value="success">Success</option>
              <option value="429">429 (rate limit)</option>
              <option value="error">Error</option>
            </select>
            <button
              type="button"
              onClick={downloadCsv}
              className="rounded-full border border-light-gray px-3 py-1.5 text-xs font-semibold text-dark-gray hover:bg-light-gray"
            >
              Unduh CSV (halaman ini)
            </button>
            {logsLoading && (
              <span className="text-xs text-dark-gray">Memuat…</span>
            )}
          </div>
          {logs.items.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-dark-gray">
              Belum ada log.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-light-gray text-xs uppercase tracking-wider text-dark-gray">
                  <tr>
                    <th className="px-5 py-2 font-semibold">Waktu</th>
                    <th className="px-5 py-2 font-semibold">Kunci</th>
                    <th className="px-5 py-2 font-semibold">Status</th>
                    <th className="px-5 py-2 font-semibold">Durasi</th>
                    <th className="px-5 py-2 font-semibold">Chat</th>
                    <th className="px-5 py-2 font-semibold">Error</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-light-gray">
                  {logs.items.map((l) => (
                    <tr key={l.id}>
                      <td className="px-5 py-2 whitespace-nowrap">{formatDate(l.createdAt)}</td>
                      <td className="px-5 py-2 font-mono text-xs">{l.maskedKey}</td>
                      <td className="px-5 py-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${LOG_BADGE[l.status]}`}>
                          {l.status}
                        </span>
                      </td>
                      <td className="px-5 py-2 whitespace-nowrap">{l.durationMs} ms</td>
                      <td className="px-5 py-2 font-mono text-xs">{l.chatId || '—'}</td>
                      <td className="max-w-[16rem] truncate px-5 py-2 text-xs text-dark-gray">
                        {l.errorMessage ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {logs.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-light-gray px-5 py-3 text-sm">
              <button
                type="button"
                onClick={() => fetchLogs(logs.page - 1, logFilter)}
                disabled={logs.page <= 1 || logsLoading}
                className="rounded-full border border-light-gray px-3 py-1 disabled:opacity-30"
              >
                ← Sebelumnya
              </button>
              <span className="text-xs text-dark-gray">
                Halaman {logs.page} / {logs.totalPages} ({logs.total} log)
              </span>
              <button
                type="button"
                onClick={() => fetchLogs(logs.page + 1, logFilter)}
                disabled={logs.page >= logs.totalPages || logsLoading}
                className="rounded-full border border-light-gray px-3 py-1 disabled:opacity-30"
              >
                Berikutnya →
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
