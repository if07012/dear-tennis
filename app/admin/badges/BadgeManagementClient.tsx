'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type { BadgeCatalogRecord, BadgeGrantRecord, GrantedBadge } from '@/data/tennis-level-types';
import { BadgesClient } from './BadgesClient';
import { AwardBadgeDialog, RevokeBadgeDialog, BadgeHistoryDialog } from '@/components/admin/BadgeDialogs';

const FIELD_LABEL_CLS =
  'text-xs font-semibold uppercase tracking-wider text-dark-gray';
const INPUT_CLS =
  'w-full rounded-lg border border-light-gray bg-white px-3 py-2 text-sm focus:border-hunter-green focus:outline-none';

type Toast =
  | { kind: 'idle' }
  | { kind: 'saved'; at: number }
  | { kind: 'error'; message: string };

export function BadgeManagementClient({ initialBadges }: { initialBadges: BadgeCatalogRecord[] }) {
  const { user } = useAuth();
  const [badges, setBadges] = useState<BadgeCatalogRecord[]>(initialBadges);
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<{ email: string; name: string } | null>(null);
  const [userGrants, setUserGrants] = useState<GrantedBadge[]>([]);
  const [userHistory, setUserHistory] = useState<(BadgeGrantRecord & { badge?: BadgeCatalogRecord })[]>([]);
  const [loadingGrants, setLoadingGrants] = useState(false);
  const [showAwardDialog, setShowAwardDialog] = useState(false);
  const [showRevokeDialog, setShowRevokeDialog] = useState<GrantedBadge | null>(null);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [status, setStatus] = useState<Toast>({ kind: 'idle' });

  // Refresh badge catalog
  const refreshBadges = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/badges', {
        headers: { 'x-auth-email': user?.email ?? '' },
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { badges: BadgeCatalogRecord[] };
      setBadges(body.badges ?? []);
    } catch (e) {
      setStatus({
        kind: 'error',
        message: e instanceof Error ? e.message : 'Gagal memuat badge',
      });
    }
  }, [user?.email]);

  const openAwardDialog = (user: { email: string; name: string }) => {
    setSelectedUser(user);
    setShowAwardDialog(true);
  };

  const closeAwardDialog = () => {
    setShowAwardDialog(false);
    setSelectedUser(null);
  };

  const handleAwardSuccess = async () => {
    closeAwardDialog();
    if (selectedUser) {
      await loadUserGrants(selectedUser.email);
    }
    setStatus({ kind: 'saved', at: Date.now() });
  };

  const openRevokeDialog = (grant: GrantedBadge) => {
    setShowRevokeDialog(grant);
  };

  const closeRevokeDialog = () => {
    setShowRevokeDialog(null);
  };

  const handleRevokeSuccess = async () => {
    closeRevokeDialog();
    if (selectedUser) {
      await loadUserGrants(selectedUser.email);
    }
    setStatus({ kind: 'saved', at: Date.now() });
  };

  const openHistoryDialog = async (userEmail: string, userName: string) => {
    setSelectedUser({ email: userEmail, name: userName });
    setLoadingGrants(true);
    try {
      const res = await fetch(`/api/admin/users/badges?user=${encodeURIComponent(userEmail)}`, {
        headers: { 'x-auth-email': user?.email ?? '' },
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { grants: GrantedBadge[] };
      // Get full history (including revoked) from all grants
      const allRes = await fetch('/api/admin/badges', {
        headers: { 'x-auth-email': user?.email ?? '' },
        cache: 'no-store',
      });
      const allBody = (await allRes.json()) as { badges: BadgeCatalogRecord[] };
      const byKey = new Map(allBody.badges?.map((b) => [b.key, b]) ?? []);
      const history = (body.grants ?? []).map((g) => ({
        ...g,
        userEmail: g.userEmail ?? selectedUser?.email ?? '',
        badgeKey: g.key,
        badge: byKey.get(g.key),
      }));
      setUserHistory(history);
      setShowHistoryDialog(true);
    } catch (e) {
      setStatus({
        kind: 'error',
        message: e instanceof Error ? e.message : 'Gagal memuat riwayat',
      });
    } finally {
      setLoadingGrants(false);
    }
  };

  const closeHistoryDialog = () => {
    setShowHistoryDialog(false);
    setUserHistory([]);
    setSelectedUser(null);
  };

  const loadUserGrants = async (email: string) => {
    try {
      const res = await fetch(`/api/admin/users/badges?user=${encodeURIComponent(email)}`, {
        headers: { 'x-auth-email': user?.email ?? '' },
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { grants: GrantedBadge[] };
      setUserGrants(body.grants ?? []);
    } catch (e) {
      setUserGrants([]);
    }
  };

  const filteredBadges = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return badges;
    return badges.filter(
      (b) =>
        b.key.toLowerCase().includes(q) ||
        b.label.toLowerCase().includes(q) ||
        b.description.toLowerCase().includes(q) ||
        b.category.toLowerCase().includes(q),
    );
  }, [badges, search]);

  return (
    <div className="container-base section-padding">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-hunter-green">
            Badge Management
          </h1>
          <p className="text-sm text-dark-gray">
            Kelola badge catalog dan berikan/cabut badge ke player.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <section className="rounded-2xl border border-light-gray bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <label className={FIELD_LABEL_CLS}>
              Cari
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="key / label / deskripsi / kategori"
                className={`mt-1 ${INPUT_CLS}`}
              />
            </label>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-light-gray text-left text-xs font-semibold uppercase tracking-wider text-dark-gray">
                  <th className="py-3 pr-4">Badge</th>
                  <th className="py-3 pr-4">Key</th>
                  <th className="py-3 pr-4">Type</th>
                  <th className="py-3 pr-4">Kategori</th>
                  <th className="py-3 pr-4">Status</th>
                  <th className="py-3 pr-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredBadges.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-dark-gray">
                      {badges.length === 0
                        ? 'Belum ada badge. Tambahkan badge pertama.'
                        : 'Tidak ada hasil untuk pencarian ini.'}
                    </td>
                  </tr>
                ) : (
                  filteredBadges.map((b) => (
                    <tr key={b.key} className="border-b border-light-gray/60 last:border-b-0">
                      <td className="py-3 pr-4 align-middle">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl" aria-hidden="true">
                            {b.icon || '🏅'}
                          </span>
                          <div className="min-w-0">
                            <p className="font-medium text-hunter-green truncate">{b.label}</p>
                            {b.description && (
                              <p className="text-xs text-dark-gray truncate">{b.description}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-4 align-middle font-mono text-xs text-dark-gray">{b.key}</td>
                      <td className="py-3 pr-4 align-middle">
                        <span className={`rounded-full px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider ${
                          b.type === 'skill'
                            ? 'bg-hunter-green/10 text-hunter-green'
                            : 'bg-paprika/10 text-paprika'
                        }`}>
                          {b.type === 'skill' ? 'Skill' : 'Achievement'}
                        </span>
                      </td>
                      <td className="py-3 pr-4 align-middle text-xs text-dark-gray">
                        {b.category || '—'}
                      </td>
                      <td className="py-3 pr-4 align-middle">
                        {b.archived ? (
                          <span className="rounded-full bg-dark-gray/10 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-dark-gray">
                            Archived
                          </span>
                        ) : (
                          <span className="rounded-full bg-hunter-green/10 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-hunter-green">
                            Active
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-4 align-middle text-right">
                        <button
                          type="button"
                          onClick={() => openAwardDialog({ email: 'placeholder', name: 'placeholder' })}
                          disabled
                          className="rounded-full border border-light-gray px-3 py-1 text-xs font-semibold text-hunter-green transition-colors hover:border-hunter-green hover:bg-hunter-green/10 mr-2 opacity-50"
                        >
                          Berikan
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="rounded-2xl border border-light-gray bg-white p-6 shadow-sm">
          <h2 className="mb-3 font-serif text-lg font-semibold text-hunter-green">
            Kelola Badge Player
          </h2>
          <div className="space-y-3">
            <label className="flex flex-col gap-1">
              <span className={FIELD_LABEL_CLS}>Cari Player (email)</span>
              <input
                type="email"
                placeholder="player@example.com"
                onChange={(e) => {
                  const email = e.target.value.trim().toLowerCase();
                  if (email.includes('@')) {
                    setSelectedUser({ email, name: email.split('@')[0] });
                  }
                }}
                className={INPUT_CLS}
              />
            </label>
            {selectedUser && (
              <div className="space-y-3 border-t border-light-gray pt-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-hunter-green">{selectedUser.name || selectedUser.email}</p>
                    <p className="text-xs text-dark-gray">{selectedUser.email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openAwardDialog(selectedUser)}
                    className="rounded-full bg-paprika px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-paprika-hover"
                  >
                    + Beri Badge
                  </button>
                </div>

                <div className="border-t border-light-gray pt-3">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-dark-gray">
                    Badge Aktif ({userGrants.length})
                  </h3>
                  {userGrants.length === 0 ? (
                    <p className="text-sm text-dark-gray text-center py-4">Belum ada badge.</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {userGrants.map((g) => (
                        <div
                          key={g.key}
                          className="flex items-center gap-2 rounded-lg border border-light-gray bg-white p-2"
                        >
                          <span className="text-xl" aria-hidden="true">{g.icon || '🏅'}</span>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-hunter-green truncate">{g.label}</p>
                            <p className="text-[0.65rem] text-dark-gray truncate">
                              {g.type === 'skill' ? 'Skill' : 'Achievement'} · {g.category || '—'}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => openRevokeDialog(g)}
                            className="shrink-0 rounded-full border border-paprika/30 bg-paprika/5 px-2 py-1 text-[0.65rem] font-semibold text-paprika transition-colors hover:bg-paprika/10"
                          >
                            Cabut
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => openHistoryDialog(selectedUser.email, selectedUser.name)}
                    disabled={loadingGrants}
                    className="rounded-full border border-light-gray px-3 py-1 text-xs font-semibold text-dark-gray transition-colors hover:border-hunter-green hover:text-hunter-green disabled:opacity-50"
                  >
                    {loadingGrants ? 'Memuat…' : 'Lihat Riwayat'}
                  </button>
                </div>
              </div>
            )}
          </div>
          <ToastBadge status={status} />
        </aside>
      </div>

      <AwardBadgeDialog
        user={selectedUser ?? { email: '', name: '' }}
        catalog={badges}
        open={showAwardDialog}
        onClose={closeAwardDialog}
        onSuccess={handleAwardSuccess}
      />
      <RevokeBadgeDialog
        grant={showRevokeDialog!}
        catalog={badges}
        open={!!showRevokeDialog}
        onClose={closeRevokeDialog}
        onSuccess={handleRevokeSuccess}
      />
      <BadgeHistoryDialog
        grants={userHistory}
        open={showHistoryDialog}
        onClose={closeHistoryDialog}
      />
    </div>
  );
}

function ToastBadge({ status }: { status: Toast }) {
  if (status.kind === 'idle') return null;
  if (status.kind === 'saved') {
    return (
      <p className="mt-3 rounded-full bg-hunter-green/10 px-3 py-1 text-center text-xs font-semibold text-hunter-green">
        Tersimpan
      </p>
    );
  }
  return (
    <p className="mt-3 rounded-full bg-paprika/10 px-3 py-1 text-center text-xs font-semibold text-paprika">
      {status.message}
    </p>
  );
}