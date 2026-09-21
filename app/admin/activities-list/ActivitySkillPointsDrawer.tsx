'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  SKILL_KEYS,
  SKILL_DISPLAY_ORDER,
  SKILL_LABELS,
  SKILL_SUB_STATS,
  SUB_STAT_LABELS,
  EMPTY_SUB_STATS,
  type SkillKey,
  type SubStatKey,
} from '@/data/user-skill-points-types';
import { XIcon, CheckIcon } from '@/components/ui/Icons';

type SkillCurrent = {
  value: number;
  subStats: Record<SubStatKey, number>;
  updatedAt?: string | null;
  updatedBy?: string | null;
};

type Member = {
  email: string;
  name: string;
  rows: Partial<Record<SkillKey, SkillCurrent>>;
};

type FetchState =
  | { kind: 'loading' }
  | { kind: 'ok'; members: Member[] }
  | { kind: 'error'; message: string };

type Deltas = Record<string, Record<SkillKey, DeltaByField>>;

type DeltaByField = { main: string } & Partial<Record<SubStatKey, string>>;

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
const DELTA_MIN = -100;
const MAX_INPUT = DELTA_MAX; // input max length matches

function clampDelta(raw: string): string {
  if (raw === '' || raw === '-') return raw;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return '';
  if (n > MAX_INPUT) return String(MAX_INPUT);
  if (n < -MAX_INPUT) return String(-MAX_INPUT);
  return String(n);
}

function emptyDeltaByField(): DeltaByField {
  return { main: '' };
}

function buildEmptyDeltas(members: Member[]): Deltas {
  const out: Deltas = {};
  for (const m of members) {
    const perSkill = {} as Record<SkillKey, DeltaByField>;
    for (const skill of SKILL_KEYS) {
      const slot = emptyDeltaByField();
      for (const sub of SKILL_SUB_STATS[skill]) {
        slot[sub] = '';
      }
      perSkill[skill] = slot;
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
  const delta = Math.max(DELTA_MIN, Math.min(DELTA_MAX, n));
  const next = Math.max(0, Math.min(100, current + delta));
  return { next, dirty: true, delta };
}

function nextClass(dirty: boolean): string {
  return dirty
    ? 'text-paprika font-semibold'
    : 'text-dark-gray';
}

export function ActivitySkillPointsDrawer({
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
        `/api/admin/activity-skill-points?activity=${encodeURIComponent(activityId)}`,
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
    skill: SkillKey,
    field: 'main' | SubStatKey,
    raw: string,
  ) => {
    const cleaned = clampDelta(raw);
    setDeltas((prev) => {
      const slot = prev[email]?.[skill] ?? emptyDeltaByField();
      const nextSlot: DeltaByField = { ...slot, [field]: cleaned };
      const nextForUser = { ...(prev[email] ?? {}), [skill]: nextSlot } as Record<
        SkillKey,
        DeltaByField
      >;
      for (const s of SKILL_KEYS) {
        if (!nextForUser[s]) {
          const base = emptyDeltaByField();
          for (const sub of SKILL_SUB_STATS[s]) base[sub] = '';
          nextForUser[s] = base;
        }
      }
      return { ...prev, [email]: nextForUser };
    });
  };

  const bumpDelta = (
    email: string,
    skill: SkillKey,
    field: 'main' | SubStatKey,
    step: number,
  ) => {
    setDeltas((prev) => {
      const slot = prev[email]?.[skill] ?? emptyDeltaByField();
      const currentRaw = slot[field] ?? '';
      const currentNum = currentRaw === '' || currentRaw === '-' ? 0 : Number.parseInt(currentRaw, 10);
      const safe = Number.isFinite(currentNum) ? currentNum : 0;
      const next = Math.max(DELTA_MIN, Math.min(DELTA_MAX, safe + step));
      const cleaned = next === 0 ? '' : String(next);
      const nextSlot: DeltaByField = { ...slot, [field]: cleaned };
      const nextForUser = { ...(prev[email] ?? {}), [skill]: nextSlot } as Record<
        SkillKey,
        DeltaByField
      >;
      for (const s of SKILL_KEYS) {
        if (!nextForUser[s]) {
          const base = emptyDeltaByField();
          for (const sub of SKILL_SUB_STATS[s]) base[sub] = '';
          nextForUser[s] = base;
        }
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
      for (const skill of SKILL_KEYS) {
        const slot = userDeltas[skill];
        if (!slot) continue;
        if (slot.main && slot.main !== '' && slot.main !== '-') count += 1;
        for (const sub of SKILL_SUB_STATS[skill]) {
          const v = slot[sub];
          if (v && v !== '' && v !== '-') count += 1;
        }
      }
    }
    return count;
  }, [deltas, members]);

  const onSubmit = async () => {
    type Payload = Record<
      string,
      Partial<
        Record<SkillKey, { main?: number } & Partial<Record<SubStatKey, number>>>
      >
    >;
    const payload: Payload = {};
    let totalChanges = 0;
    for (const m of members) {
      const perSkill: Payload[string] = {};
      for (const skill of SKILL_KEYS) {
        const slot = deltas[m.email]?.[skill];
        if (!slot) continue;
        const skillDelta: { main?: number } & Partial<Record<SubStatKey, number>> = {};
        const mainRaw = (slot.main ?? '').trim();
        if (mainRaw !== '' && mainRaw !== '-') {
          const n = Number.parseInt(mainRaw, 10);
          if (Number.isFinite(n) && n !== 0) {
            skillDelta.main = n;
            totalChanges += 1;
          }
        }
        for (const sub of SKILL_SUB_STATS[skill]) {
          const raw = (slot[sub] ?? '').trim();
          if (raw === '' || raw === '-') continue;
          const n = Number.parseInt(raw, 10);
          if (!Number.isFinite(n) || n === 0) continue;
          skillDelta[sub] = n;
          totalChanges += 1;
        }
        if (
          skillDelta.main !== undefined ||
          Object.keys(skillDelta).length > 0
        ) {
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
      const res = await fetch('/api/admin/activity-skill-points', {
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
      aria-label={`Set skill points for ${activityTitle}`}
    >
      <div
        className="w-full max-w-6xl rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl flex flex-col max-h-[90vh] sm:max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 border-b border-light-gray p-6 flex-shrink-0">
          <div className="min-w-0 flex-1">
            <p className={FIELD_LABEL_CLS}>Set Skill Points</p>
            <h2 className="mt-1 font-serif text-xl font-semibold text-hunter-green truncate whitespace-pre-wrap">
              {activityTitle}
            </h2>
            <p className="mt-1 text-xs text-dark-gray">
              Gunakan stepper atau ketik delta. Sub-stat hanya berlaku untuk skill-nya (Footwork → Speed/Agility/Balance, lainnya → Accuracy/Power/Consistency). Nilai akhir dikunci di 0–100.
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
            <Spinner /> Memuat member…
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
              <MemberSkillBlock
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
              {status.kind === 'saving' ? 'Menyimpan…' : `Simpan${dirtyCount > 0 ? ` (${dirtyCount})` : ''}`}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function hasDeltasFor(slot: Record<SkillKey, DeltaByField> | undefined): boolean {
  if (!slot) return false;
  for (const skill of SKILL_KEYS) {
    const s = slot[skill];
    if (!s) continue;
    if (s.main && s.main !== '' && s.main !== '-') return true;
    for (const sub of SKILL_SUB_STATS[skill]) {
      const v = s[sub];
      if (v && v !== '' && v !== '-') return true;
    }
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

function MemberSkillBlock({
  member,
  deltas,
  onDeltaChange,
  onBump,
  disabled,
}: {
  member: Member;
  deltas: Record<SkillKey, DeltaByField> | null;
  onDeltaChange: (
    email: string,
    skill: SkillKey,
    field: 'main' | SubStatKey,
    raw: string,
  ) => void;
  onBump: (
    email: string,
    skill: SkillKey,
    field: 'main' | SubStatKey,
    step: number,
  ) => void;
  disabled: boolean;
}) {
  const lastUpdated = (() => {
    const all = SKILL_DISPLAY_ORDER.map((s) => member.rows[s]?.updatedAt).filter(
      (x): x is string => Boolean(x),
    );
    if (all.length === 0) return null;
    return all.sort().slice(-1)[0] ?? null;
  })();

  const memberDirty = (() => {
    if (!deltas) return false;
    for (const skill of SKILL_KEYS) {
      const slot = deltas[skill];
      if (!slot) continue;
      if (slot.main && slot.main !== '' && slot.main !== '-') return true;
      for (const sub of SKILL_SUB_STATS[skill]) {
        const v = slot[sub];
        if (v && v !== '' && v !== '-') return true;
      }
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
        {SKILL_DISPLAY_ORDER.map((skill) => (
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
  skill: SkillKey;
  current: SkillCurrent | null;
  slot: DeltaByField;
  onDeltaChange: (
    email: string,
    skill: SkillKey,
    field: 'main' | SubStatKey,
    raw: string,
  ) => void;
  onBump: (
    email: string,
    skill: SkillKey,
    field: 'main' | SubStatKey,
    step: number,
  ) => void;
  disabled: boolean;
}) {
  const currentValue = current?.value ?? 0;
  const mainProj = projectAfter(currentValue, slot.main ?? '');
  const subs = SKILL_SUB_STATS[skill];
  const subStats = current?.subStats ?? { ...EMPTY_SUB_STATS };

  return (
    <div
      className={`rounded-lg border bg-white p-2 transition-colors ${
        mainProj.dirty ? 'border-paprika/40' : 'border-light-gray'
      }`}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-graphite">
          {SKILL_LABELS[skill]}
        </span>
        <span className="font-mono text-xs tabular-nums">
          <span className="text-dark-gray">{currentValue}</span>
          {mainProj.dirty && (
            <>
              <span className="mx-1 text-dark-gray">→</span>
              <span className={nextClass(true)}>{mainProj.next}</span>
            </>
          )}
          <span className="text-[0.65rem] text-dark-gray">/100</span>
        </span>
      </div>

      <StepperInput
        label="Main"
        value={slot.main ?? ''}
        dirty={mainProj.dirty}
        disabled={disabled}
        onChange={(raw) => onDeltaChange(memberEmail, skill, 'main', raw)}
        onBump={(step) => onBump(memberEmail, skill, 'main', step)}
      />

      <div className="mt-1 grid grid-cols-3 gap-1">
        {subs.map((sub) => {
          const currentSub = subStats[sub] ?? 0;
          const proj = projectAfter(currentSub, slot[sub] ?? '');
          return (
            <div
              key={sub}
              className={`flex flex-col items-center rounded-md px-1 py-1 transition-colors ${
                proj.dirty ? 'bg-paprika/10' : 'bg-off-white'
              }`}
            >
              <span className="text-[0.55rem] font-semibold uppercase tracking-wider text-dark-gray">
                {SUB_STAT_LABELS[sub].slice(0, 4)}
              </span>
              <span className="font-mono text-[0.7rem] tabular-nums">
                <span className="text-graphite">{currentSub}</span>
                {proj.dirty && (
                  <>
                    <span className="mx-0.5 text-dark-gray">→</span>
                    <span className={nextClass(true)}>{proj.next}</span>
                  </>
                )}
              </span>
              <div className="mt-0.5 flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => onBump(memberEmail, skill, sub, -1)}
                  disabled={disabled}
                  className="h-5 w-5 rounded border border-light-gray bg-white text-xs font-bold text-graphite transition-colors hover:border-dark-gray disabled:opacity-50"
                  aria-label={`Kurangi ${SUB_STAT_LABELS[sub]} ${SKILL_LABELS[skill]}`}
                >
                  −
                </button>
                <input
                  type="text"
                  inputMode="numeric"
                  value={slot[sub] ?? ''}
                  onChange={(e) => onDeltaChange(memberEmail, skill, sub, e.target.value)}
                  onFocus={(e) => e.currentTarget.select()}
                  placeholder="±"
                  disabled={disabled}
                  className="w-10 rounded border border-light-gray bg-white px-1 py-0.5 text-center text-[0.65rem] font-semibold text-graphite focus:border-hunter-green focus:outline-none disabled:opacity-50"
                  aria-label={`${SUB_STAT_LABELS[sub]} delta ${SKILL_LABELS[skill]} untuk ${memberEmail}`}
                />
                <button
                  type="button"
                  onClick={() => onBump(memberEmail, skill, sub, +1)}
                  disabled={disabled}
                  className="h-5 w-5 rounded border border-light-gray bg-white text-xs font-bold text-graphite transition-colors hover:border-dark-gray disabled:opacity-50"
                  aria-label={`Tambah ${SUB_STAT_LABELS[sub]} ${SKILL_LABELS[skill]}`}
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StepperInput({
  label,
  value,
  dirty,
  disabled,
  onChange,
  onBump,
}: {
  label: string;
  value: string;
  dirty: boolean;
  disabled: boolean;
  onChange: (raw: string) => void;
  onBump: (step: number) => void;
}) {
  return (
    <div
      className={`flex items-center gap-1 rounded-md px-1 py-0.5 transition-colors ${
        dirty ? 'bg-paprika/10' : ''
      }`}
    >
      <span className={FIELD_LABEL_CLS}>{label}</span>
      <button
        type="button"
        onClick={() => onBump(-1)}
        disabled={disabled}
        className="h-6 w-6 rounded border border-light-gray bg-white text-xs font-bold text-graphite transition-colors hover:border-dark-gray disabled:opacity-50"
        aria-label={`Kurangi ${label}`}
      >
        −
      </button>
      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        placeholder="±"
        disabled={disabled}
        className="w-12 rounded border border-light-gray bg-white px-1 py-0.5 text-center text-xs font-semibold text-graphite focus:border-hunter-green focus:outline-none disabled:opacity-50"
        aria-label={label}
      />
      <button
        type="button"
        onClick={() => onBump(+1)}
        disabled={disabled}
        className="h-6 w-6 rounded border border-light-gray bg-white text-xs font-bold text-graphite transition-colors hover:border-dark-gray disabled:opacity-50"
        aria-label={`Tambah ${label}`}
      >
        +
      </button>
      {dirty && (
        <button
          type="button"
          onClick={() => onChange('')}
          disabled={disabled}
          className="ml-auto text-[0.6rem] font-semibold uppercase tracking-wider text-paprika hover:underline"
          aria-label={`Reset ${label}`}
        >
          reset
        </button>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="mr-2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-light-gray border-t-hunter-green"
    />
  );
}
