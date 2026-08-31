'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { CheckIcon, PlusIcon, XIcon } from '@/components/ui/Icons';
import {
  MATCH_FORMATS,
  MATCH_ROUNDS,
  MATCH_WINNERS,
  isMatchFormat,
  isMatchRound,
  isMatchWinner,
  type MatchFormat,
  type MatchRecord,
  type MatchRound,
  type MatchWinner,
} from '@/data/matches-types';
import {
  autoBalanceDoubles,
  pairBracket,
  pairRoundRobin,
} from './matches-autopair';

type Member = { email: string; name: string };

type FetchState =
  | { kind: 'loading' }
  | { kind: 'ok'; members: Member[]; matches: MatchRecord[] }
  | { kind: 'error'; message: string };

type SaveStatus =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved'; at: number }
  | { kind: 'error'; message: string };

type Props = {
  activityId: string;
  activityTitle: string;
  onClose: () => void;
  onSaved?: () => void;
};

type Tab = 'auto' | 'manual';

const FIELD_LABEL_CLS =
  'text-xs font-semibold uppercase tracking-wider text-dark-gray';
const INPUT_CLS =
  'w-full rounded-lg border border-light-gray bg-white px-3 py-2 text-sm focus:border-hunter-green focus:outline-none';
const CHIP_CLS =
  'inline-flex items-center gap-1 rounded-full border border-hunter-green bg-hunter-green/10 px-2.5 py-0.5 text-xs font-semibold text-hunter-green';

// Manual members: the admin types a free-text name (e.g. "Caca") and we
// synthesise a placeholder email so the existing side-string / sheet schema
// stays untouched. The placeholder is deterministic so re-opening the drawer
// recovers the same id; the original name is kept in component state and
// shown in dropdowns. The public profile never matches a real viewer against
// a manual placeholder, so manual-only matches are admin-side bookkeeping.
const MANUAL_EMAIL_DOMAIN = 'guest.local';
const MANUAL_EMAIL_PREFIX = '__manual_';

function manualEmailFor(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  const safe = slug || 'player';
  return `${MANUAL_EMAIL_PREFIX}${safe}@${MANUAL_EMAIL_DOMAIN}`;
}

function slugFromManualEmail(email: string): string | null {
  if (!email.startsWith(MANUAL_EMAIL_PREFIX)) return null;
  const local = email.slice(MANUAL_EMAIL_PREFIX.length).split('@')[0];
  return local || null;
}

function setsFor(format: MatchFormat): 1 | 2 | 3 {
  if (format === 'bo1') return 1;
  if (format === 'bo3') return 2;
  return 3;
}

function blankMatch(
  activityId: string,
  matchIndex: number,
  format: MatchFormat = 'bo3',
): MatchRecord {
  return {
    id: '',
    activityId,
    matchIndex,
    round: 'manual',
    format,
    isDoubles: false,
    sideA: '',
    sideB: '',
    set1A: 0,
    set1B: 0,
    set2A: 0,
    set2B: 0,
    set3A: 0,
    set3B: 0,
    winner: '',
    recordedBy: '',
    recordedAt: '',
    updatedAt: '',
  };
}

function normaliseSide(s: string): string {
  return s
    .split(',')
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean)
    .join(',');
}

function diffMatches(a: MatchRecord[], b: MatchRecord[]): boolean {
  if (a.length !== b.length) return true;
  const keyOf = (m: MatchRecord) =>
    `${m.id}|${m.matchIndex}|${m.round}|${m.format}|${m.isDoubles ? 1 : 0}|${normaliseSide(
      m.sideA,
    )}|${normaliseSide(m.sideB)}|${m.set1A}|${m.set1B}|${m.set2A}|${m.set2B}|${m.set3A}|${
      m.set3B
    }|${m.winner}`;
  const setA = new Set(a.map(keyOf));
  for (const k of b.map(keyOf)) if (!setA.has(k)) return true;
  return false;
}

export function ActivityMatchesDrawer({
  activityId,
  activityTitle,
  onClose,
  onSaved,
}: Props) {
  const { user } = useAuth();
  const [state, setState] = useState<FetchState>({ kind: 'loading' });
  const [tab, setTab] = useState<Tab>('auto');
  const [autoFormat, setAutoFormat] = useState<'RR' | 'bracket'>('RR');
  const [autoDoubles, setAutoDoubles] = useState(false);
  const [matchFormat, setMatchFormat] = useState<MatchFormat>('bo3');
  const [autoManualDraft, setAutoManualDraft] = useState('');
  const [matches, setMatches] = useState<MatchRecord[]>([]);
  const [baseline, setBaseline] = useState<MatchRecord[]>([]);
  const [status, setStatus] = useState<SaveStatus>({ kind: 'idle' });
  const [manualMembers, setManualMembers] = useState<string[]>([]);
  // Display name for each manual placeholder email. Map is rebuilt on load
  // (slug falls back to the local-part of the placeholder when the name was
  // not stored) and updated whenever the admin types a new manual member.
  const [manualNames, setManualNames] = useState<Record<string, string>>({});
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  // id of a saved match whose delete is awaiting admin confirmation. Draft
  // rows delete immediately because nothing was written to the sheet.
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.email) return;
    const controller = new AbortController();
    try {
      const res = await fetch(
        `/api/admin/activity-matches?activity=${encodeURIComponent(activityId)}`,
        {
          headers: { 'x-auth-email': user.email },
          cache: 'no-store',
          signal: controller.signal,
        },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as {
        members: Member[];
        matches: MatchRecord[];
      };
      const sorted = [...body.matches].sort(
        (a, b) => a.matchIndex - b.matchIndex,
      );
      // Recover any manual (non-signup) emails already saved into matches so
      // they reappear in the dropdowns and the POST body round-trips. The
      // original admin-typed name is gone after the first save, so the
      // slug portion of the placeholder becomes the fallback display label.
      const memberEmails = new Set(
        body.members.map((m) => m.email.toLowerCase()),
      );
      const manual: string[] = [];
      const names: Record<string, string> = {};
      const seenManual = new Set<string>();
      for (const m of sorted) {
        for (const raw of `${m.sideA},${m.sideB}`.split(',')) {
          const e = raw.trim().toLowerCase();
          if (!e || memberEmails.has(e) || seenManual.has(e)) continue;
          seenManual.add(e);
          manual.push(e);
          const slug = slugFromManualEmail(e);
          if (slug && !names[e]) names[e] = slug;
        }
      }
      if (controller.signal.aborted) return;
      setManualMembers(manual);
      setManualNames(names);
      setState({ kind: 'ok', members: body.members, matches: sorted });
      setMatches(sorted);
      setBaseline(sorted);
      setExpandedIds(new Set());
    } catch (err: unknown) {
      if (controller.signal.aborted) return;
      setState({
        kind: 'error',
        message:
          err instanceof Error ? err.message : 'Gagal memuat data match',
      });
    }
  }, [activityId, user?.email]);

  useEffect(() => {
    const controller = new AbortController();
    void load();
    return () => controller.abort();
  }, [load]);

  const dirty = useMemo(
    () => diffMatches(baseline, matches),
    [baseline, matches],
  );
  const dirtyCount = dirty ? matches.length : 0;

  const updateMatch = (id: string, patch: Partial<MatchRecord>) => {
    setMatches((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    );
  };

  const requestRemove = (id: string, isPersisted: boolean) => {
    // Drafts (never saved) drop immediately; saved rows need confirmation.
    if (!isPersisted) {
      removeMatch(id);
      return;
    }
    setPendingDeleteId(id);
  };

  const cancelRemove = () => setPendingDeleteId(null);

  const confirmRemove = (id: string) => {
    removeMatch(id);
    if (pendingDeleteId === id) setPendingDeleteId(null);
  };

  const removeMatch = (id: string) => {
    setMatches((prev) =>
      prev
        .filter((m) => m.id !== id)
        .map((m, i) => ({ ...m, matchIndex: i })),
    );
    setExpandedIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  // Strip the draft ids we minted client-side so the server sees clean
  // blank `id` fields and mints UUIDs on its own.
  const matchesForSubmit = matches.map((m) =>
    m.id.startsWith('__new_') ? { ...m, id: '' } : m,
  );

  const addManualMember = (name: string): string | null => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const email = manualEmailFor(trimmed);
    setManualMembers((prev) => (prev.includes(email) ? prev : [...prev, email]));
    setManualNames((prev) => ({ ...prev, [email]: trimmed }));
    setStatus({ kind: 'idle' });
    return email;
  };

  // Members the pickers can choose from = approved signups ∪ manual entries.
  const pickerMembers: Member[] = useMemo(() => {
    if (state.kind !== 'ok') return [];
    const byEmail = new Map<string, Member>();
    for (const m of state.members) byEmail.set(m.email.toLowerCase(), m);
    for (const e of manualMembers) {
      const key = e.toLowerCase();
      if (!byEmail.has(key)) {
        byEmail.set(key, { email: key, name: manualNames[key] ?? e });
      }
    }
    return Array.from(byEmail.values());
  }, [state, manualMembers, manualNames]);

  // Stable name map for collapsed summary lines. Recomputed when the picker
  // roster changes; cheap because pickerMembers is small (≤ a few dozen).
  const membersForName = useMemo(() => {
    const m = new Map<string, string>();
    for (const x of pickerMembers) m.set(x.email.toLowerCase(), x.name);
    return m;
  }, [pickerMembers]);
  const pickerNameOf = (
    map: Map<string, string>,
    email: string,
  ): string => map.get(email.toLowerCase()) ?? email;

  const addManual = () => {
    const draftId = `__new_${crypto.randomUUID()}`;
    setMatches((prev) => [
      ...prev,
      { ...blankMatch(activityId, prev.length, matchFormat), id: draftId },
    ]);
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.add(draftId);
      return next;
    });
    setTab('manual');
  };

  const generateAuto = () => {
    if (state.kind !== 'ok') return;
    // Auto-pair pool = approved signups ∪ any manual members the admin
    // added via the auto-pair tab or any per-row picker. Same source the
    // dropdowns use, so the generated match list never drops a player.
    const emails = pickerMembers.map((m) => m.email);
    if (emails.length < 2) {
      setStatus({
        kind: 'error',
        message: 'Minimal 2 member (approved atau manual) untuk generate match',
      });
      return;
    }
    const fn = autoFormat === 'RR' ? pairRoundRobin : pairBracket;
    const generated = fn(activityId, emails, matchFormat, autoDoubles);
    const withIds = generated.map((m, i) => ({
      ...m,
      id: m.id || `__new_${crypto.randomUUID()}_${i}`,
    }));
    setMatches(withIds.map((m, i) => ({ ...m, matchIndex: i })));
    // Expand only the first generated row so the admin sees what was created
    // and the rest stay collapsed — no surprise wall of forms on Generate.
    setExpandedIds(
      withIds[0]?.id ? new Set([withIds[0].id]) : new Set(),
    );
    setTab('manual'); // switch to manual so admin can edit scores/winners
  };

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleFormatChange = (id: string, format: MatchFormat) => {
    updateMatch(id, { format });
  };

  const handleDoublesToggle = (id: string, isDoubles: boolean) => {
    const m = matches.find((x) => x.id === id);
    if (!m) return;
    if (isDoubles && state.kind === 'ok') {
      const balanced = autoBalanceDoubles(m.sideA, m.sideB, state.members.map((mm) => mm.email));
      updateMatch(id, { isDoubles: true, sideA: balanced.sideA, sideB: balanced.sideB });
    } else {
      updateMatch(id, { isDoubles: false });
    }
  };

  const setWinner = (id: string, winner: MatchWinner) => {
    updateMatch(id, { winner });
  };

  const handleSave = async () => {
    if (!user?.email) return;
    setStatus({ kind: 'saving' });
    try {
      const res = await fetch('/api/admin/activity-matches', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-auth-email': user.email,
        },
        body: JSON.stringify({
          activityId,
          matches: matchesForSubmit,
          manualMembers,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setBaseline(matches);
      setStatus({ kind: 'saved', at: Date.now() });
      onSaved?.();
      onClose();
    } catch (err) {
      setStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Gagal menyimpan',
      });
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-graphite/40 sm:items-center sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Set matches for ${activityTitle}`}
    >
      <div
        className="w-full max-w-6xl rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 border-b border-light-gray p-6">
          <div className="min-w-0 flex-1">
            <p className={FIELD_LABEL_CLS}>Activity Matches</p>
            <h2 className="mt-1 font-serif text-xl font-semibold text-hunter-green truncate">
              {activityTitle}
            </h2>
            <p className="mt-1 text-xs text-dark-gray">
              Generate otomatis (round-robin atau bracket) atau tambah manual.
              Side harus dari member yang sudah di-approve admin.
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
            Memuat member & match…
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

        {state.kind === 'ok' && state.members.length === 0 && (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="rounded-xl border border-dashed border-light-gray bg-off-white p-8 text-center text-sm text-dark-gray">
              Activity ini belum punya member dengan status approved. Setujui
              signup dulu di halaman Activity Signups.
            </div>
          </div>
        )}

        {state.kind === 'ok' && state.members.length > 0 && (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {(['auto', 'manual'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={
                    tab === t
                      ? 'rounded-full bg-hunter-green px-3 py-1.5 text-xs font-semibold text-white'
                      : 'rounded-full border border-light-gray bg-white px-3 py-1.5 text-xs font-semibold text-graphite hover:border-hunter-green hover:text-hunter-green'
                  }
                >
                  {t === 'auto' ? 'Auto-pair' : 'Manual'}
                </button>
              ))}
              <button
                type="button"
                onClick={addManual}
                className="ml-auto inline-flex items-center gap-1 rounded-full bg-hunter-green px-3 py-1.5 text-xs font-semibold text-white hover:bg-hunter-green/90"
              >
                <PlusIcon size={12} /> Tambah match
              </button>
            </div>

            {tab === 'auto' && (
              <div className="rounded-xl border border-hunter-green/30 bg-hunter-green/[0.04] p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1">
                    <span className={FIELD_LABEL_CLS}>
                      Tambah manual ke pool
                    </span>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={autoManualDraft}
                        onChange={(e) => setAutoManualDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (
                            e.key === 'Enter' &&
                            autoManualDraft.trim()
                          ) {
                            e.preventDefault();
                            if (addManualMember(autoManualDraft)) {
                              setAutoManualDraft('');
                            }
                          }
                        }}
                        placeholder="Nama manual (guest/walk-in)…"
                        className={`${INPUT_CLS} text-xs`}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (addManualMember(autoManualDraft)) {
                            setAutoManualDraft('');
                          }
                        }}
                        disabled={!autoManualDraft.trim()}
                        className="shrink-0 rounded-md border border-light-gray bg-white px-2 py-1 text-xs font-semibold text-dark-gray hover:border-hunter-green hover:text-hunter-green disabled:opacity-40"
                      >
                        + Tambah
                      </button>
                    </div>
                    {manualMembers.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {manualMembers.map((email) => (
                          <span
                            key={email}
                            className={CHIP_CLS}
                            title={email}
                          >
                            {manualNames[email] ?? email}
                            <button
                              type="button"
                              onClick={() => {
                                setManualMembers((prev) =>
                                  prev.filter((e) => e !== email),
                                );
                                setManualNames((prev) => {
                                  const { [email]: _drop, ...rest } = prev;
                                  return rest;
                                });
                              }}
                              className="ml-1 rounded-full p-0.5 hover:bg-hunter-green/20"
                              aria-label={`Hapus ${manualNames[email] ?? email} dari pool`}
                            >
                              <XIcon size={10} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-4">
                  <label className="flex flex-col gap-1">
                    <span className={FIELD_LABEL_CLS}>Format</span>
                    <select
                      value={autoFormat}
                      onChange={(e) =>
                        setAutoFormat(e.target.value as 'RR' | 'bracket')
                      }
                      className={INPUT_CLS}
                    >
                      <option value="RR">Round-robin</option>
                      <option value="bracket">Single-elimination</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className={FIELD_LABEL_CLS}>Set format</span>
                    <select
                      value={matchFormat}
                      onChange={(e) => {
                        if (isMatchFormat(e.target.value)) {
                          setMatchFormat(e.target.value);
                        }
                      }}
                      className={INPUT_CLS}
                    >
                      {MATCH_FORMATS.map((f) => (
                        <option key={f} value={f}>
                          {f === 'bo1' ? 'Best of 1' : f === 'bo3' ? 'Best of 3' : 'Best of 5'}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-2 self-end pb-2 text-sm text-graphite">
                    <input
                      type="checkbox"
                      checked={autoDoubles}
                      onChange={(e) => setAutoDoubles(e.target.checked)}
                      className="h-4 w-4 rounded border-light-gray text-hunter-green focus:ring-hunter-green"
                    />
                    Doubles
                  </label>
                  <button
                    type="button"
                    onClick={generateAuto}
                    className="self-end rounded-full bg-paprika px-4 py-2 text-sm font-semibold text-white hover:bg-paprika/90"
                  >
                    Generate
                  </button>
                </div>
                <p className="mt-2 text-xs text-dark-gray">
                  Hasil generate akan menggantikan daftar match di bawah.
                </p>
              </div>
            )}

            <div className="mt-4 grid gap-3">
              {matches.length === 0 ? (
                <div className="rounded-xl border border-dashed border-light-gray bg-off-white p-8 text-center text-sm text-dark-gray">
                  Belum ada match. Pakai tab Auto-pair atau klik Tambah match.
                </div>
              ) : (
                matches.map((m) => {
                  const isPersisted = !m.id.startsWith('__new_');
                  return (
                    <MatchRow
                      key={m.id || `__new_${m.matchIndex}`}
                      match={m}
                      members={pickerMembers}
                      nameOf={(e) => pickerNameOf(membersForName, e)}
                      expanded={expandedIds.has(m.id)}
                      onToggle={() => toggleExpanded(m.id)}
                      onChange={(patch) => updateMatch(m.id, patch)}
                      onFormatChange={(fmt) => handleFormatChange(m.id, fmt)}
                      onDoublesToggle={(d) => handleDoublesToggle(m.id, d)}
                      onWinnerChange={(w) => setWinner(m.id, w)}
                      onRequestRemove={() => requestRemove(m.id, isPersisted)}
                      onConfirmRemove={() => confirmRemove(m.id)}
                      onCancelRemove={cancelRemove}
                      pendingDelete={pendingDeleteId === m.id}
                      onAddManualMember={addManualMember}
                      disabled={status.kind === 'saving'}
                    />
                  );
                })
              )}
            </div>
          </div>
        )}

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-light-gray bg-off-white px-6 py-4">
          <div className="flex items-center gap-3 text-xs text-dark-gray">
            {dirty ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-hunter-green/10 px-3 py-1 font-semibold text-hunter-green">
                <CheckIcon size={12} />
                {dirtyCount} match belum disimpan
              </span>
            ) : (
              <span>Belum ada perubahan.</span>
            )}
            {status.kind === 'error' && (
              <span className="rounded-full bg-paprika/10 px-3 py-1 font-semibold text-paprika">
                {status.message}
              </span>
            )}
            {status.kind === 'saved' && (
              <span className="rounded-full bg-hunter-green/10 px-3 py-1 font-semibold text-hunter-green">
                Tersimpan!
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-light-gray px-4 py-2 text-sm font-semibold text-dark-gray transition-colors hover:border-dark-gray"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!dirty || status.kind === 'saving'}
              className="rounded-full bg-hunter-green px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-hunter-green/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {status.kind === 'saving' ? 'Menyimpan…' : `Simpan${dirtyCount ? ` (${dirtyCount})` : ''}`}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

type MatchRowProps = {
  match: MatchRecord;
  members: Member[];
  nameOf: (email: string) => string;
  expanded: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<MatchRecord>) => void;
  onFormatChange: (format: MatchFormat) => void;
  onDoublesToggle: (isDoubles: boolean) => void;
  onWinnerChange: (winner: MatchWinner) => void;
  onRequestRemove: () => void;
  onConfirmRemove: () => void;
  onCancelRemove: () => void;
  pendingDelete: boolean;
  onAddManualMember: (name: string) => string | null;
  disabled: boolean;
};

function summariseMatch(
  match: MatchRecord,
  nameOf: (e: string) => string,
): { a: string; b: string; score: string; winner: string } {
  const a = match.sideA
    .split(',')
    .filter(Boolean)
    .map((e) => nameOf(e))
    .join(' & ') || 'Side A';
  const b = match.sideB
    .split(',')
    .filter(Boolean)
    .map((e) => nameOf(e))
    .join(' & ') || 'Side B';
  const pairs: Array<[number, number]> = [
    [match.set1A, match.set1B],
    [match.set2A, match.set2B],
    [match.set3A, match.set3B],
  ];
  const score =
    pairs
      .filter(([x, y]) => x > 0 || y > 0)
      .map(([x, y]) => `${x}-${y}`)
      .join(' ') || '—';
  const winner =
    match.winner === 'A'
      ? 'A menang'
      : match.winner === 'B'
        ? 'B menang'
        : match.winner === 'draw'
          ? 'Draw'
          : 'Belum';
  return { a, b, score, winner };
}

const WINNER_BADGE: Record<MatchWinner, string> = {
  A: 'bg-hunter-green/10 text-hunter-green',
  B: 'bg-paprika/10 text-paprika',
  draw: 'bg-dark-gray/10 text-dark-gray',
  '': 'bg-light-gray text-dark-gray',
};
const WINNER_LABEL: Record<MatchWinner, string> = {
  A: 'A menang',
  B: 'B menang',
  draw: 'Draw',
  '': 'Belum',
};

function MatchRow({
  match,
  members,
  nameOf,
  expanded,
  onToggle,
  onChange,
  onFormatChange,
  onDoublesToggle,
  onWinnerChange,
  onRequestRemove,
  onConfirmRemove,
  onCancelRemove,
  pendingDelete,
  onAddManualMember,
  disabled,
}: MatchRowProps) {
  const totalSets = setsFor(match.format);
  const byId = useMemo(
    () => new Map(members.map((m) => [m.email.toLowerCase(), m.name])),
    [members],
  );
  const sideAEmails = match.sideA.split(',').filter(Boolean);
  const sideBEmails = match.sideB.split(',').filter(Boolean);
  const summary = summariseMatch(match, nameOf);
  const roundLabel = match.round === 'RR' ? 'Round-robin' : match.round;

  const setSideEmail = (side: 'A' | 'B', slot: number, email: string) => {
    const list = (side === 'A' ? sideAEmails : sideBEmails).slice();
    list[slot] = email.toLowerCase();
    const next = list.filter(Boolean).join(',');
    onChange(side === 'A' ? { sideA: next } : { sideB: next });
  };

  const addPartner = (side: 'A' | 'B') => {
    if (match.isDoubles) return;
    onDoublesToggle(true);
  };

  const removePartner = (side: 'A' | 'B') => {
    if (match.isDoubles) return;
    const list = (side === 'A' ? sideAEmails : sideBEmails).slice();
    if (list.length <= 1) return;
    list.pop();
    const next = list.join(',');
    onChange(side === 'A' ? { sideA: next } : { sideB: next });
  };

  return (
    <div className="rounded-xl border border-light-gray bg-off-white">
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm disabled:opacity-60"
        aria-expanded={expanded}
      >
        <span
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[0.6rem] font-bold text-white transition-transform ${
            expanded ? 'rotate-90 bg-hunter-green' : 'bg-dark-gray/40'
          }`}
          aria-hidden
        >
          ›
        </span>
        <span className={FIELD_LABEL_CLS}>#{match.matchIndex + 1}</span>
        <span className="min-w-0 flex-1 truncate font-semibold text-graphite">
          {summary.a}
          <span className="px-1.5 text-dark-gray">vs</span>
          {summary.b}
        </span>
        <span className="hidden text-xs text-dark-gray sm:inline">
          {roundLabel} · {match.format.toUpperCase()} · {summary.score}
        </span>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ${
            WINNER_BADGE[match.winner]
          }`}
        >
          {WINNER_LABEL[match.winner]}
        </span>
      </button>

      {!expanded && (
        <p className="-mt-1 truncate px-4 pb-2 text-[0.7rem] text-dark-gray sm:hidden">
          {roundLabel} · {match.format.toUpperCase()} · {summary.score}
        </p>
      )}

      {expanded && (
        <div className="border-t border-light-gray p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <select
              value={match.format}
              onChange={(e) => {
                if (isMatchFormat(e.target.value)) {
                  onFormatChange(e.target.value);
                }
              }}
              disabled={disabled}
              className={`${INPUT_CLS} w-auto`}
            >
              {MATCH_FORMATS.map((f) => (
                <option key={f} value={f}>
                  {f === 'bo1' ? 'Best of 1' : f === 'bo3' ? 'Best of 3' : 'Best of 5'}
                </option>
              ))}
            </select>
            <select
              value={match.round}
              onChange={(e) => {
                if (isMatchRound(e.target.value)) {
                  onChange({ round: e.target.value });
                }
              }}
              disabled={disabled}
              className={`${INPUT_CLS} w-auto`}
            >
              {MATCH_ROUNDS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <label className="ml-auto inline-flex items-center gap-2 text-xs text-graphite">
              <input
                type="checkbox"
                checked={match.isDoubles}
                onChange={(e) => onDoublesToggle(e.target.checked)}
                disabled={disabled}
                className="h-4 w-4 rounded border-light-gray text-hunter-green focus:ring-hunter-green"
              />
              Doubles
            </label>
            {pendingDelete ? (
              <div className="inline-flex items-center gap-1.5 rounded-md border border-paprika/40 bg-paprika/5 px-2 py-1 text-xs">
                <span className="font-semibold text-paprika">Hapus permanen?</span>
                <button
                  type="button"
                  onClick={onConfirmRemove}
                  disabled={disabled}
                  className="rounded-full bg-paprika px-2.5 py-0.5 text-[0.65rem] font-semibold text-white hover:bg-paprika/90 disabled:opacity-40"
                >
                  Hapus
                </button>
                <button
                  type="button"
                  onClick={onCancelRemove}
                  disabled={disabled}
                  className="rounded-full border border-light-gray bg-white px-2.5 py-0.5 text-[0.65rem] font-semibold text-dark-gray hover:border-dark-gray disabled:opacity-40"
                >
                  Batal
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onRequestRemove}
                disabled={disabled}
                title={
                  match.id.startsWith('__new_')
                    ? 'Hapus match'
                    : 'Hapus match (tersimpan di sheet)'
                }
                className="rounded-md p-1 text-dark-gray transition-colors hover:bg-paprika/10 hover:text-paprika disabled:opacity-40"
                aria-label="Hapus match"
              >
                <XIcon size={16} />
              </button>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <SidePicker
              label="Side A"
              emails={sideAEmails}
              isDoubles={match.isDoubles}
              members={members}
              disabled={disabled}
              onPick={(slot, email) => setSideEmail('A', slot, email)}
              onAdd={() => addPartner('A')}
              onRemoveSlot={() => removePartner('A')}
              onAddManual={(name) => {
                const email = onAddManualMember(name);
                if (email) {
                  setSideEmail('A', sideAEmails.length, email);
                }
              }}
              nameOf={(e) => byId.get(e.toLowerCase()) ?? e}
            />
            <SidePicker
              label="Side B"
              emails={sideBEmails}
              isDoubles={match.isDoubles}
              members={members}
              disabled={disabled}
              onPick={(slot, email) => setSideEmail('B', slot, email)}
              onAdd={() => addPartner('B')}
              onRemoveSlot={() => removePartner('B')}
              onAddManual={(name) => {
                const email = onAddManualMember(name);
                if (email) {
                  setSideEmail('B', sideBEmails.length, email);
                }
              }}
              nameOf={(e) => byId.get(e.toLowerCase()) ?? e}
            />
          </div>

          <div className="mt-3 grid gap-2">
            {Array.from({ length: totalSets }, (_, i) => i + 1).map((n) => {
              const aKey = `set${n}A` as 'set1A' | 'set2A' | 'set3A';
              const bKey = `set${n}B` as 'set1B' | 'set2B' | 'set3B';
              return (
                <div
                  key={n}
                  className="flex items-center gap-2 rounded-lg border border-light-gray bg-white px-3 py-2"
                >
                  <span className={FIELD_LABEL_CLS}>Set {n}</span>
                  <input
                    type="number"
                    min={0}
                    max={99}
                    value={match[aKey]}
                    onChange={(e) =>
                      onChange({ [aKey]: clampSetScore(e.target.value) } as Partial<MatchRecord>)
                    }
                    disabled={disabled}
                    className={`${INPUT_CLS} w-20`}
                  />
                  <span className="text-sm font-semibold text-dark-gray">vs</span>
                  <input
                    type="number"
                    min={0}
                    max={99}
                    value={match[bKey]}
                    onChange={(e) =>
                      onChange({ [bKey]: clampSetScore(e.target.value) } as Partial<MatchRecord>)
                    }
                    disabled={disabled}
                    className={`${INPUT_CLS} w-20`}
                  />
                </div>
              );
            })}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className={FIELD_LABEL_CLS}>Winner</span>
            {(['A', 'B', 'draw', ''] as MatchWinner[]).map((w) => (
              <label
                key={w || 'unset'}
                className={
                  match.winner === w
                    ? CHIP_CLS
                    : 'inline-flex cursor-pointer items-center gap-1 rounded-full border border-light-gray bg-white px-2.5 py-0.5 text-xs font-semibold text-graphite hover:border-hunter-green hover:text-hunter-green'
                }
              >
                <input
                  type="radio"
                  name={`winner-${match.id || match.matchIndex}`}
                  value={w}
                  checked={match.winner === w}
                  onChange={() => onWinnerChange(w)}
                  disabled={disabled}
                  className="sr-only"
                />
                {w === '' ? 'Belum' : w === 'draw' ? 'Draw' : w}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function clampSetScore(raw: string): number {
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) return 0;
  if (n > 99) return 99;
  return n;
}

type SidePickerProps = {
  label: string;
  emails: string[];
  isDoubles: boolean;
  members: Member[];
  disabled: boolean;
  onPick: (slot: number, email: string) => void;
  onAdd: () => void;
  onRemoveSlot: () => void;
  onAddManual: (email: string) => void;
  nameOf: (email: string) => string;
};

type MemberDropdownProps = {
  value: string;
  members: Member[];
  disabled: boolean;
  onPick: (email: string) => void;
  nameOf: (email: string) => string;
};

function MemberDropdown({
  value,
  members,
  disabled,
  onPick,
  nameOf,
}: MemberDropdownProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Focus search input when opening.
  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
      // Wait for the input to mount.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => m.name.toLowerCase().includes(q));
  }, [members, query]);

  const choose = (email: string) => {
    onPick(email);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, Math.max(0, filtered.length - 1)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const pick = filtered[active];
      if (pick) choose(pick.email.toLowerCase());
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      {value ? (
        <div className="flex items-center gap-1.5 rounded-lg border border-hunter-green bg-hunter-green/5 px-2.5 py-1.5 text-sm">
          <span className="min-w-0 flex-1 truncate font-medium text-graphite">
            {nameOf(value)}
          </span>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            disabled={disabled}
            className="rounded p-0.5 text-dark-gray hover:bg-light-gray disabled:opacity-40"
            aria-label="Ganti member"
          >
            <CheckIcon size={12} />
          </button>
          <button
            type="button"
            onClick={() => onPick('')}
            disabled={disabled}
            className="rounded p-0.5 text-dark-gray hover:bg-paprika/10 hover:text-paprika disabled:opacity-40"
            aria-label="Hapus member"
          >
            <XIcon size={12} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          disabled={disabled}
          className={`${INPUT_CLS} text-left text-dark-gray`}
        >
          Pilih member…
        </button>
      )}

      {open && (
        <div className="absolute left-0 right-0 z-20 mt-1 overflow-hidden rounded-lg border border-light-gray bg-white shadow-lg">
          <div className="border-b border-light-gray p-2">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
              placeholder="Cari member…"
              className={`${INPUT_CLS} text-xs`}
            />
          </div>
          <ul
            className="max-h-56 overflow-y-auto py-1"
            role="listbox"
            aria-label="Pilih member"
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-xs text-dark-gray">
                Tidak ada member cocok.
              </li>
            ) : (
              filtered.map((m, i) => {
                const email = m.email.toLowerCase();
                const selected = email === value.toLowerCase();
                const isActive = i === active;
                return (
                  <li
                    key={email}
                    role="option"
                    aria-selected={selected}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(email)}
                    className={`flex cursor-pointer items-center justify-between gap-2 px-3 py-1.5 text-sm ${
                      isActive ? 'bg-hunter-green/10' : ''
                    } ${selected ? 'font-semibold text-hunter-green' : 'text-graphite'}`}
                  >
                    <span className="truncate">{m.name}</span>
                    {selected && <CheckIcon size={12} />}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

function SidePicker({
  label,
  emails,
  isDoubles,
  members,
  disabled,
  onPick,
  onAdd,
  onRemoveSlot,
  onAddManual,
  nameOf,
}: SidePickerProps) {
  const slots = isDoubles ? [0, 1] : [0];
  const [manualDraft, setManualDraft] = useState('');
  return (
    <div className="rounded-lg border border-light-gray bg-white p-3">
      <p className={FIELD_LABEL_CLS}>{label}</p>
      <div className="mt-2 grid gap-2">
        {slots.map((slot) => {
          const current = emails[slot] ?? '';
          return (
            <div key={slot} className="flex items-center gap-2">
              <div className="flex-1">
                <MemberDropdown
                  value={current}
                  members={members}
                  disabled={disabled}
                  onPick={(email) => onPick(slot, email)}
                  nameOf={nameOf}
                />
              </div>
              {isDoubles && slot === 1 && emails.length > 1 && (
                <button
                  type="button"
                  onClick={onRemoveSlot}
                  disabled={disabled}
                  className="rounded-md p-1 text-dark-gray hover:bg-paprika/10 hover:text-paprika disabled:opacity-40"
                  aria-label="Hapus partner"
                >
                  <XIcon size={14} />
                </button>
              )}
            </div>
          );
        })}
        {isDoubles && emails.length < 2 && (
          <button
            type="button"
            onClick={onAdd}
            disabled={disabled}
            className="self-start rounded-full border border-light-gray px-3 py-1 text-xs font-semibold text-dark-gray hover:border-hunter-green hover:text-hunter-green disabled:opacity-40"
          >
            + Tambah partner
          </button>
        )}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={manualDraft}
            onChange={(e) => setManualDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && manualDraft.trim()) {
                e.preventDefault();
                onAddManual(manualDraft.trim());
                setManualDraft('');
              }
            }}
            disabled={disabled}
            placeholder="Nama manual (guest/walk-in)…"
            className={`${INPUT_CLS} text-xs`}
          />
          <button
            type="button"
            onClick={() => {
              if (!manualDraft.trim()) return;
              onAddManual(manualDraft.trim());
              setManualDraft('');
            }}
            disabled={disabled || !manualDraft.trim()}
            className="shrink-0 rounded-md border border-light-gray px-2 py-1 text-xs font-semibold text-dark-gray hover:border-hunter-green hover:text-hunter-green disabled:opacity-40"
          >
            + Manual
          </button>
        </div>
        {emails[0] && (
          <p className="text-[0.65rem] text-dark-gray">
            {nameOf(emails[0])}
          </p>
        )}
      </div>
    </div>
  );
}