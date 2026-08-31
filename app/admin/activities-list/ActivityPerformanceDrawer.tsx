'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  PERFORMANCE_DISPLAY_ORDER,
  PERFORMANCE_SKILL_KEYS,
  PERFORMANCE_SKILL_LABELS,
  type PerformanceSkillKey,
} from '@/data/user-performance-types';
import { XIcon, CheckIcon } from '@/components/ui/Icons';

type SkillCurrent = {
  target: number;
  kesalahan: number;
  updatedAt?: string | null;
  updatedBy?: string | null;
};

type Member = {
  email: string;
  name: string;
  rows: Partial<Record<PerformanceSkillKey, SkillCurrent>>;
};

type FetchState =
  | { kind: 'loading' }
  | { kind: 'ok'; members: Member[] }
  | { kind: 'error'; message: string };

type Deltas = Record<string, Record<PerformanceSkillKey, DeltaByField>>;

type DeltaByField = { target: string; kesalahan: string };

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

const FIELD_LABEL_CLS = 'text-xs font-semibold uppercase tracking-wider text-dark-gray';
const DELTA_MAX = 100;

function clampDelta(raw: string): string {
  if (raw === '' || raw === '-') return raw;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return '';
  if (n > DELTA_MAX) return String(DELTA_MAX);
  if (n < -DELTA_MAX) return String(-DELTA_MAX);
  return String(n);
}

function emptyDeltaByField(): DeltaByField {
  return { target: '', kesalahan: '' };
}

function buildEmptyDeltas(members: Member[]): Deltas {
  const out: Deltas = {};
  for (const m of members) {
    const perSkill = {} as Record<PerformanceSkillKey, DeltaByField>;
    for (const skill of PERFORMANCE_SKILL_KEYS) {
      perSkill[skill] = emptyDeltaByField();
    }
    out[m.email] = perSkill;
  }
  return out;
}

function formatTimestamp(iso?: string | null): string {
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

function projectAfter(
  current: number,
  rawDelta: string,
): { next: number; dirty: boolean; delta: number } {
  if (rawDelta === '' || rawDelta === '-') {
    return { next: current, dirty: false, delta: 0 };
  }
  const n = Number.parseInt(rawDelta, 10);
  if (!Number.isFinite(n) || n === 0) {
    return { next: current, dirty: false, delta: 0 };
  }
  const delta = Math.max(-DELTA_MAX, Math.min(DELTA_MAX, n));
  const next = Math.max(0, Math.min(100, current + delta));
  return { next, dirty: true, delta };
}

function nextClass(dirty: boolean): string {
  return dirty ? 'text-paprika font-semibold' : 'text-dark-gray';
}

export function ActivityPerformanceDrawer({
  activityId,
  activityTitle,
  onClose,
  onSaved,
}: Props) {
  const { user } = useAuth();
  const [state, setState] = useState<FetchState>({ kind: 'loading' });
  const [deltas, setDeltas] = useState<Deltas>({});
  const [status, setStatus] = useState<SaveStatus>({ kind: 'idle' });
  const [activeIndex, setActiveIndex] = useState(0);

  const load = useCallback(async (signal?: AbortSignal) => {
    setState({ kind: 'loading' });
    try {
      const res = await fetch(
        `/api/admin/activity-performance?activity=${encodeURIComponent(activityId)}`,
        {
          headers: { 'x-auth-email': user?.email ?? '' },
          cache: 'no-store',
          signal,
        },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const body = (await res.json()) as { members: Member[] };
      const normalised: Member[] = (body.members ?? []).map((m) => ({
        email: m.email,
        name: m.name,
        rows: m.rows ?? {},
      }));
      setState({ kind: 'ok', members: normalised });
      setDeltas(buildEmptyDeltas(normalised));
      setActiveIndex(0);
    } catch (err) {
      if ((err as { name?: string }).name === 'AbortError') return;
      setState({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Failed to load members',
      });
    }
  }, [activityId, user?.email]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const members = useMemo(
    () => (state.kind === 'ok' ? state.members : []),
    [state],
  );

  const onDeltaChange = (
    email: string,
    skill: PerformanceSkillKey,
    field: 'target' | 'kesalahan',
    raw: string,
  ) => {
    const cleaned = clampDelta(raw);
    setDeltas((prev) => {
      const slot = prev[email]?.[skill] ?? emptyDeltaByField();
      const nextSlot: DeltaByField = { ...slot, [field]: cleaned };
      const nextForUser = { ...(prev[email] ?? {}), [skill]: nextSlot } as Record<
        PerformanceSkillKey,
        DeltaByField
      >;
      for (const s of PERFORMANCE_SKILL_KEYS) {
        if (!nextForUser[s]) nextForUser[s] = emptyDeltaByField();
      }
      return { ...prev, [email]: nextForUser };
    });
  };

  const bumpDelta = (
    email: string,
    skill: PerformanceSkillKey,
    field: 'target' | 'kesalahan',
    step: number,
  ) => {
    setDeltas((prev) => {
      const slot = prev[email]?.[skill] ?? emptyDeltaByField();
      const currentRaw = slot[field];
      const currentNum =
        currentRaw === '' || currentRaw === '-' ? 0 : Number.parseInt(currentRaw, 10);
      const safe = Number.isFinite(currentNum) ? currentNum : 0;
      const next = Math.max(-DELTA_MAX, Math.min(DELTA_MAX, safe + step));
      const cleaned = next === 0 ? '' : String(next);
      const nextSlot: DeltaByField = { ...slot, [field]: cleaned };
      const nextForUser = { ...(prev[email] ?? {}), [skill]: nextSlot } as Record<
        PerformanceSkillKey,
        DeltaByField
      >;
      for (const s of PERFORMANCE_SKILL_KEYS) {
        if (!nextForUser[s]) nextForUser[s] = emptyDeltaByField();
      }
      return { ...prev, [email]: nextForUser };
    });
  };

  const clearAllDeltas = () => {
    setDeltas(buildEmptyDeltas(members));
    setStatus({ kind: 'idle' });
  };

  const dirtyCount = useMemo(() => {
    let count = 0;
    for (const m of members) {
      const userDeltas = deltas[m.email];
      if (!userDeltas) continue;
      for (const skill of PERFORMANCE_SKILL_KEYS) {
        const slot = userDeltas[skill];
        if (!slot) continue;
        if (slot.target && slot.target !== '' && slot.target !== '-') count += 1;
        if (slot.kesalahan && slot.kesalahan !== '' && slot.kesalahan !== '-') count += 1;
      }
    }
    return count;
  }, [deltas, members]);

  const onSubmit = async () => {
    type Payload = Record<
      string,
      Partial<
        Record<
          PerformanceSkillKey,
          { target?: number; kesalahan?: number }
        >
      >
    >;
    const payload: Payload = {};
    let totalChanges = 0;
    for (const m of members) {
      const perSkill: Payload[string] = {};
      for (const skill of PERFORMANCE_SKILL_KEYS) {
        const slot = deltas[m.email]?.[skill];
        if (!slot) continue;
        const skillDelta: { target?: number; kesalahan?: number } = {};
        const tRaw = (slot.target ?? '').trim();
        if (tRaw !== '' && tRaw !== '-') {
          const n = Number.parseInt(tRaw, 10);
          if (Number.isFinite(n) && n !== 0) {
            skillDelta.target = n;
            totalChanges += 1;
          }
        }
        const kRaw = (slot.kesalahan ?? '').trim();
        if (kRaw !== '' && kRaw !== '-') {
          const n = Number.parseInt(kRaw, 10);
          if (Number.isFinite(n) && n !== 0) {
            skillDelta.kesalahan = n;
            totalChanges += 1;
          }
        }
        if (skillDelta.target !== undefined || skillDelta.kesalahan !== undefined) {
          perSkill[skill] = skillDelta;
        }
      }
      if (Object.keys(perSkill).length > 0) {
        payload[m.email] = perSkill;
      }
    }
    if (totalChanges === 0) {
      setStatus({ kind: 'error', message: 'Isi minimal satu delta' });
      return;
    }
    setStatus({ kind: 'saving' });
    try {
      const res = await fetch('/api/admin/activity-performance', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-auth-email': user?.email ?? '',
        },
        body: JSON.stringify({ activityId, deltas: payload }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setStatus({ kind: 'saved', at: Date.now() });
      onSaved?.();
      onClose();
    } catch (e) {
      setStatus({
        kind: 'error',
        message: e instanceof Error ? e.message : 'Failed to save',
      });
    }
  };

  const activeMember = members[activeIndex];
  const goPrev = () => setActiveIndex((i) => Math.max(0, i - 1));
  const goNext = () => setActiveIndex((i) => Math.min(members.length - 1, i + 1));

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-graphite/40 sm:items-center sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Set performance for ${activityTitle}`}
    >
      <div
        className="w-full max-w-5xl rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 border-b border-light-gray p-6">
          <div className="min-w-0 flex-1">
            <p className={FIELD_LABEL_CLS}>Set Performance</p>
            <h2 className="mt-1 font-serif text-xl font-semibold text-hunter-green truncate">
              {activityTitle}
            </h2>
            <p className="mt-1 text-xs text-dark-gray">
              Isi nilai target dan kesalahan per skill untuk setiap member.
              Nilai akhir dikunci di 0–100. Isi satu member pada satu waktu.
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
            <span className="mr-2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-light-gray border-t-hunter-green" aria-hidden="true" />
            Memuat member…
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

        {state.kind === 'ok' && members.length === 0 && (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="rounded-xl border border-dashed border-light-gray bg-off-white p-8 text-center text-sm text-dark-gray">
              Activity ini belum punya member dengan status approved. Setujui
              signup dulu di halaman Activity Signups.
            </div>
          </div>
        )}

        {state.kind === 'ok' && members.length > 0 && activeMember && (
          <>
            <MemberNavBar
              activeIndex={activeIndex}
              total={members.length}
              onPrev={goPrev}
              onNext={goNext}
              onJump={setActiveIndex}
              dirtyEmails={Object.keys(deltas).filter((email) => hasDeltasFor(deltas[email]))}
              members={members}
            />

            <div className="flex-1 overflow-y-auto p-6">
              <MemberPerformanceBlock
                key={activeMember.email}
                member={activeMember}
                deltas={deltas[activeMember.email] ?? null}
                onDeltaChange={onDeltaChange}
                onBump={bumpDelta}
                disabled={status.kind === 'saving'}
              />
            </div>
          </>
        )}

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-light-gray bg-off-white px-6 py-4">
          <div className="flex items-center gap-3 text-xs text-dark-gray">
            {dirtyCount > 0 ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-hunter-green/10 px-3 py-1 font-semibold text-hunter-green">
                <CheckIcon size={12} />
                {dirtyCount} delta belum disimpan
              </span>
            ) : (
              <span>Belum ada delta. Isi nilai lalu Simpan.</span>
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
            {dirtyCount > 0 && (
              <button
                type="button"
                onClick={clearAllDeltas}
                className="rounded-full border border-light-gray px-4 py-2 text-sm font-semibold text-dark-gray transition-colors hover:border-dark-gray"
              >
                Reset semua
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-light-gray px-4 py-2 text-sm font-semibold text-dark-gray transition-colors hover:border-dark-gray"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={onSubmit}
              disabled={
                status.kind === 'saving' ||
                state.kind !== 'ok' ||
                members.length === 0 ||
                dirtyCount === 0
              }
              className="rounded-full bg-hunter-green px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-hunter-green/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {status.kind === 'saving'
                ? 'Menyimpan…'
                : `Simpan${dirtyCount > 0 ? ` (${dirtyCount})` : ''}`}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function hasDeltasFor(slot: Record<PerformanceSkillKey, DeltaByField> | undefined): boolean {
  if (!slot) return false;
  for (const skill of PERFORMANCE_SKILL_KEYS) {
    const s = slot[skill];
    if (!s) continue;
    if (s.target && s.target !== '' && s.target !== '-') return true;
    if (s.kesalahan && s.kesalahan !== '' && s.kesalahan !== '-') return true;
  }
  return false;
}

function MemberNavBar({
  activeIndex,
  total,
  onPrev,
  onNext,
  onJump,
  dirtyEmails,
  members,
}: {
  activeIndex: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  onJump: (i: number) => void;
  dirtyEmails: string[];
  members: Member[];
}) {
  const dirtySet = new Set(dirtyEmails);
  return (
    <div className="border-b border-light-gray bg-off-white px-6 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPrev}
            disabled={activeIndex === 0}
            className="rounded-full border border-light-gray bg-white px-3 py-1.5 text-xs font-semibold text-graphite transition-colors hover:border-dark-gray disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Member sebelumnya"
          >
            ← Prev
          </button>
          <span className="text-xs font-semibold text-dark-gray tabular-nums">
            {activeIndex + 1} / {total}
          </span>
          <button
            type="button"
            onClick={onNext}
            disabled={activeIndex >= total - 1}
            className="rounded-full border border-light-gray bg-white px-3 py-1.5 text-xs font-semibold text-graphite transition-colors hover:border-dark-gray disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Member berikutnya"
          >
            Next →
          </button>
        </div>

        <div className="flex max-w-full flex-wrap items-center gap-1 overflow-x-auto">
          {members.map((m, idx) => {
            const isActive = idx === activeIndex;
            const isDirty = dirtySet.has(m.email);
            return (
              <button
                key={m.email}
                type="button"
                onClick={() => onJump(idx)}
                title={m.name || m.email}
                className={`shrink-0 rounded-full border px-2.5 py-1 text-[0.65rem] font-semibold transition-colors ${
                  isActive
                    ? 'border-hunter-green bg-hunter-green text-white'
                    : isDirty
                      ? 'border-paprika bg-paprika/10 text-paprika'
                      : 'border-light-gray bg-white text-dark-gray hover:border-dark-gray'
                }`}
              >
                {idx + 1}. {(m.name || m.email).split(' ')[0]}
                {isDirty && !isActive && ' •'}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MemberPerformanceBlock({
  member,
  deltas,
  onDeltaChange,
  onBump,
  disabled,
}: {
  member: Member;
  deltas: Record<PerformanceSkillKey, DeltaByField> | null;
  onDeltaChange: (
    email: string,
    skill: PerformanceSkillKey,
    field: 'target' | 'kesalahan',
    raw: string,
  ) => void;
  onBump: (
    email: string,
    skill: PerformanceSkillKey,
    field: 'target' | 'kesalahan',
    step: number,
  ) => void;
  disabled: boolean;
}) {
  const lastUpdated = (() => {
    const all = PERFORMANCE_DISPLAY_ORDER.map((s) => member.rows[s]?.updatedAt).filter(
      (x): x is string => Boolean(x),
    );
    if (all.length === 0) return null;
    return all.sort().slice(-1)[0] ?? null;
  })();

  const memberDirty = (() => {
    if (!deltas) return false;
    for (const skill of PERFORMANCE_SKILL_KEYS) {
      const slot = deltas[skill];
      if (!slot) continue;
      if (slot.target && slot.target !== '' && slot.target !== '-') return true;
      if (slot.kesalahan && slot.kesalahan !== '' && slot.kesalahan !== '-') return true;
    }
    return false;
  })();

  return (
    <div
      className={`rounded-xl border bg-white p-3 transition-colors ${
        memberDirty ? 'border-paprika/40 bg-paprika/5' : 'border-light-gray'
      }`}
    >
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-hunter-green">
            {member.name || member.email}
            {memberDirty && (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-paprika px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wider text-white">
                <CheckIcon size={10} />
                edited
              </span>
            )}
          </p>
          <p className="text-[0.7rem] text-dark-gray">{member.email}</p>
        </div>
        {lastUpdated && (
          <p className="text-[0.65rem] text-dark-gray">
            Last: {formatTimestamp(lastUpdated)}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {PERFORMANCE_DISPLAY_ORDER.map((skill) => (
          <SkillCard
            key={skill}
            memberEmail={member.email}
            skill={skill}
            current={member.rows[skill] ?? null}
            slot={deltas?.[skill] ?? emptyDeltaByField()}
            onDeltaChange={onDeltaChange}
            onBump={onBump}
            disabled={disabled}
          />
        ))}
      </div>
    </div>
  );
}

function SkillCard({
  memberEmail,
  skill,
  current,
  slot,
  onDeltaChange,
  onBump,
  disabled,
}: {
  memberEmail: string;
  skill: PerformanceSkillKey;
  current: SkillCurrent | null;
  slot: DeltaByField;
  onDeltaChange: (
    email: string,
    skill: PerformanceSkillKey,
    field: 'target' | 'kesalahan',
    raw: string,
  ) => void;
  onBump: (
    email: string,
    skill: PerformanceSkillKey,
    field: 'target' | 'kesalahan',
    step: number,
  ) => void;
  disabled: boolean;
}) {
  const currentTarget = current?.target ?? 0;
  const currentKesalahan = current?.kesalahan ?? 0;
  const targetProj = projectAfter(currentTarget, slot.target);
  const kesalahanProj = projectAfter(currentKesalahan, slot.kesalahan);

  return (
    <div
      className={`rounded-lg border bg-white p-2 transition-colors ${
        targetProj.dirty || kesalahanProj.dirty ? 'border-paprika/40' : 'border-light-gray'
      }`}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-graphite">
          {PERFORMANCE_SKILL_LABELS[skill]}
        </span>
      </div>

      <DeltaRow
        label="Target"
        currentValue={currentTarget}
        proj={targetProj}
        slot={slot.target}
        disabled={disabled}
        onChange={(raw) => onDeltaChange(memberEmail, skill, 'target', raw)}
        onBump={(step) => onBump(memberEmail, skill, 'target', step)}
        color="hunter-green"
      />
      <DeltaRow
        label="Kesalahan"
        currentValue={currentKesalahan}
        proj={kesalahanProj}
        slot={slot.kesalahan}
        disabled={disabled}
        onChange={(raw) => onDeltaChange(memberEmail, skill, 'kesalahan', raw)}
        onBump={(step) => onBump(memberEmail, skill, 'kesalahan', step)}
        color="paprika"
      />
    </div>
  );
}

function DeltaRow({
  label,
  currentValue,
  proj,
  slot,
  disabled,
  onChange,
  onBump,
  color,
}: {
  label: string;
  currentValue: number;
  proj: { next: number; dirty: boolean };
  slot: string;
  disabled: boolean;
  onChange: (raw: string) => void;
  onBump: (step: number) => void;
  color: 'hunter-green' | 'paprika';
}) {
  const labelColor =
    color === 'hunter-green' ? 'text-hunter-green' : 'text-paprika';
  return (
    <div
      className={`mt-1 flex items-center gap-1 rounded-md px-1 py-0.5 transition-colors ${
        proj.dirty ? 'bg-paprika/10' : ''
      }`}
    >
      <span className={`text-[0.55rem] font-semibold uppercase tracking-wider ${labelColor}`}>
        {label}
      </span>
      <span className="font-mono text-[0.7rem] tabular-nums">
        <span className="text-graphite">{currentValue}</span>
        {proj.dirty && (
          <>
            <span className="mx-0.5 text-dark-gray">→</span>
            <span className={nextClass(true)}>{proj.next}</span>
          </>
        )}
      </span>
      <button
        type="button"
        onClick={() => onBump(-1)}
        disabled={disabled}
        className="ml-auto h-5 w-5 rounded border border-light-gray bg-white text-xs font-bold text-graphite transition-colors hover:border-dark-gray disabled:opacity-50"
        aria-label={`Kurangi ${label}`}
      >
        −
      </button>
      <input
        type="text"
        inputMode="numeric"
        value={slot}
        onChange={(e) => onChange(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        placeholder="±"
        disabled={disabled}
        className="w-10 rounded border border-light-gray bg-white px-1 py-0.5 text-center text-[0.65rem] font-semibold text-graphite focus:border-hunter-green focus:outline-none disabled:opacity-50"
        aria-label={label}
      />
      <button
        type="button"
        onClick={() => onBump(+1)}
        disabled={disabled}
        className="h-5 w-5 rounded border border-light-gray bg-white text-xs font-bold text-graphite transition-colors hover:border-dark-gray disabled:opacity-50"
        aria-label={`Tambah ${label}`}
      >
        +
      </button>
      {proj.dirty && (
        <button
          type="button"
          onClick={() => onChange('')}
          disabled={disabled}
          className="text-[0.6rem] font-semibold uppercase tracking-wider text-paprika hover:underline"
          aria-label={`Reset ${label}`}
        >
          reset
        </button>
      )}
    </div>
  );
}
