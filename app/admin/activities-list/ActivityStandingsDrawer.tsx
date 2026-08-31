'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { XIcon } from '@/components/ui/Icons';
import { computeStandings, type Standing } from './matches-standings';
import type { MatchRecord } from '@/data/matches-types';

type Member = { email: string; name: string };

type FetchState =
  | { kind: 'loading' }
  | { kind: 'ok'; members: Member[]; matches: MatchRecord[] }
  | { kind: 'error'; message: string };

type Props = {
  activityId: string;
  activityTitle: string;
  onClose: () => void;
};

const FIELD_LABEL_CLS =
  'text-xs font-semibold uppercase tracking-wider text-dark-gray';

export function ActivityStandingsDrawer({
  activityId,
  activityTitle,
  onClose,
}: Props) {
  const { user } = useAuth();
  const [state, setState] = useState<FetchState>({ kind: 'loading' });

  const load = useCallback(async () => {
    if (!user?.email) return;
    try {
      const res = await fetch(
        `/api/admin/activity-matches?activity=${encodeURIComponent(activityId)}`,
        {
          headers: { 'x-auth-email': user.email },
          cache: 'no-store',
        },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as {
        members: Member[];
        matches: MatchRecord[];
      };
      setState({ kind: 'ok', members: body.members, matches: body.matches });
    } catch (err: unknown) {
      setState({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Gagal memuat data',
      });
    }
  }, [activityId, user?.email]);

  useEffect(() => {
    void load();
  }, [load]);

  // Manual placeholder emails (e.g. `__manual_caca@guest.local`) need a
  // friendly label. The admin-typed name was kept client-side in the matches
  // drawer but isn't returned by the API, so we fall back to the slug.
  const standings: Standing[] =
    state.kind === 'ok'
      ? computeStandings(state.matches, (email) => {
          const member = state.members.find(
            (m) => m.email.toLowerCase() === email.toLowerCase(),
          );
          if (member?.name) return member.name;
          const slug = email.startsWith('__manual_')
            ? email.slice('__manual_'.length).split('@')[0]
            : '';
          return slug || email;
        })
      : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-graphite/40 sm:items-center sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Standings for ${activityTitle}`}
    >
      <div
        className="w-full max-w-4xl rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 border-b border-light-gray p-6">
          <div className="min-w-0 flex-1">
            <p className={FIELD_LABEL_CLS}>Activity Standings</p>
            <h2 className="mt-1 font-serif text-xl font-semibold text-hunter-green truncate">
              {activityTitle}
            </h2>
            <p className="mt-1 text-xs text-dark-gray">
              Peringkat dihitung dari semua match yang sudah disimpan. W =
              win, L = loss, D = draw, GW/GL = total game menang/kalah
              (semua set dijumlah).
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-md p-1.5 text-dark-gray transition-colors hover:bg-light-gray"
          >
            <XIcon size={20} />
          </button>
        </header>

        {state.kind === 'loading' && (
          <div className="flex-1 overflow-y-auto p-12 text-center text-sm text-dark-gray">
            Memuat standings…
          </div>
        )}

        {state.kind === 'error' && (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="rounded-xl border border-dashed border-paprika/40 bg-paprika/5 p-6 text-center text-sm text-paprika">
              Gagal memuat: {state.message}
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => void load()}
                  className="rounded-full border border-paprika px-4 py-1.5 text-xs font-semibold text-paprika hover:bg-paprika hover:text-white"
                >
                  Coba lagi
                </button>
              </div>
            </div>
          </div>
        )}

        {state.kind === 'ok' && standings.length === 0 && (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="rounded-xl border border-dashed border-light-gray bg-off-white p-8 text-center text-sm text-dark-gray">
              Belum ada match yang disimpan untuk activity ini. Generate atau
              tambahkan match lewat tab Matches, standings akan muncul di sini.
            </div>
          </div>
        )}

        {state.kind === 'ok' && standings.length > 0 && (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="overflow-x-auto rounded-xl border border-light-gray">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-off-white text-left text-[0.65rem] font-semibold uppercase tracking-wider text-dark-gray">
                    <th className="px-3 py-2 text-right">#</th>
                    <th className="px-3 py-2">Player</th>
                    <th className="px-3 py-2 text-right">W</th>
                    <th className="px-3 py-2 text-right">L</th>
                    <th className="px-3 py-2 text-right">D</th>
                    <th className="px-3 py-2 text-right">W−L</th>
                    <th className="px-3 py-2 text-right">GW</th>
                    <th className="px-3 py-2 text-right">GL</th>
                    <th className="px-3 py-2 text-right">GW−GL</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((s, idx) => (
                    <tr
                      key={s.email}
                      className="border-t border-light-gray odd:bg-white even:bg-off-white/40"
                    >
                      <td className="px-3 py-1.5 text-right font-mono text-xs font-semibold text-dark-gray tabular-nums">
                        {idx + 1}
                      </td>
                      <td className="px-3 py-1.5 font-medium text-graphite">
                        {s.name}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-sm font-semibold text-hunter-green tabular-nums">
                        {s.wins}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-sm font-semibold text-paprika tabular-nums">
                        {s.losses}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-sm text-dark-gray tabular-nums">
                        {s.draws}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-sm font-semibold text-graphite tabular-nums">
                        {s.winDiff > 0 ? `+${s.winDiff}` : s.winDiff}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-sm text-graphite tabular-nums">
                        {s.gamesWon}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-sm text-graphite tabular-nums">
                        {s.gamesLost}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-sm font-semibold text-graphite tabular-nums">
                        {s.gameDiff > 0 ? `+${s.gameDiff}` : s.gameDiff}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-dark-gray">
              Sort: W desc → W−L desc → GW−GL desc → GW desc → nama asc.
            </p>
          </div>
        )}

        <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-light-gray bg-off-white px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-light-gray px-4 py-2 text-sm font-semibold text-dark-gray transition-colors hover:border-dark-gray"
          >
            Tutup
          </button>
        </footer>
      </div>
    </div>
  );
}
