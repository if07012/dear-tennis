'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { skillBreakdownDefaults } from '@/data/profile';
import { SkillProgressBar, levelFromValue } from './SkillProgressBar';
import { ChevronDown } from '@/components/ui/Icons';
import {
  SKILL_DISPLAY_ORDER,
  SKILL_LABELS,
  SKILL_SUB_STATS,
  SUB_STAT_LABELS,
  type SkillKey,
  type SubStatKey,
} from '@/data/user-skill-points-types';
import type { SkillBreakdownItem, SkillDetailStat } from '@/data/profile-types';

type FetchState =
  | { kind: 'loading' }
  | { kind: 'ok'; perSkill: PerSkill | null; activities: number }
  | { kind: 'error'; message: string };

type PerSkill = Record<
  SkillKey,
  { value: number; accuracy?: number; power?: number; consistency?: number; speed?: number; agility?: number; balance?: number }
>;

const SUB_STAT_ORDER: readonly ('accuracy' | 'power' | 'consistency' | 'speed' | 'agility' | 'balance')[] = [
  'accuracy',
  'power',
  'consistency',
  'speed',
  'agility',
  'balance',
];

type JoinedActivity = {
  id: string;
  title: string;
  date: string;
  type: string;
  icon: string;
  location: string;
  photos: string[];
  description?: string;
};

type ExistingRow = {
  value: number;
  subStats: Record<string, number>;
} | null;

type ExistingSkillPointsResponse = {
  members: Array<{ email: string; rows: Record<string, ExistingRow> }>;
};

type JoinedActivitiesResponse =
  | { events: JoinedActivity[] }
  | { error: string };

type DeltaByField = { main: string } & Partial<Record<SubStatKey, string>>;
type Deltas = Partial<Record<SkillKey, DeltaByField>>;
type SaveStatus =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved'; at: number }
  | { kind: 'error'; message: string };

const DELTA_MAX = 100;

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function clampDelta(raw: string): string {
  if (raw === '' || raw === '-') return raw;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return '';
  if (n > DELTA_MAX) return String(DELTA_MAX);
  if (n < -DELTA_MAX) return String(-DELTA_MAX);
  return String(n);
}

function clampValue(raw: string): string {
  // Existing-value input: 0..100 only, no negatives.
  if (raw === '') return raw;
  const cleaned = raw.replace(/[^\d]/g, '').slice(0, 3);
  if (cleaned === '') return '';
  const n = Number.parseInt(cleaned, 10);
  if (!Number.isFinite(n)) return '';
  return String(Math.max(0, Math.min(100, n)));
}

function hasChanges(baseline: Deltas, deltas: Deltas): boolean {
  for (const skill of Object.keys(deltas) as SkillKey[]) {
    const a = baseline[skill];
    const b = deltas[skill];
    if (!a || !b) return true;
    for (const k of Object.keys(b) as Array<'main' | SubStatKey>) {
      if ((a[k] ?? '0') !== (b[k] ?? '0')) return true;
    }
  }
  return false;
}

function emptyDeltas(): Deltas {
  return {};
}

function buildDetailsForSkill(
  item: SkillBreakdownItem,
  perSkill: PerSkill | null,
): { value: number; details: SkillDetailStat[] } {
  if (!perSkill) {
    return { value: item.details[0]?.value ?? 0, details: item.details };
  }
  // Map profile-types SkillKey → store SkillKey (case difference).
  const keyMap: Record<string, SkillKey> = {
    Forehand: 'forehand',
    Backhand: 'backhand',
    Serve: 'serve',
    Volley: 'volley',
    Footwork: 'footwork',
    Strategy: 'strategy',
  };
  const skillKey = keyMap[item.skill] ?? (item.skill.toLowerCase() as SkillKey);
  const entry = perSkill[skillKey];
  if (!entry) {
    return { value: item.details[0]?.value ?? 0, details: item.details };
  }
  const subs = SKILL_SUB_STATS[skillKey];
  const details: SkillDetailStat[] = subs.map((sub) => ({
    label: SUB_STAT_ORDER.find((s) => s === sub) ?? sub,
    value: clamp(entry[sub] ?? 0),
  }));
  return { value: clamp(entry.value), details };
}

/**
 * Client-side wrapper around the static `SkillBreakdown` panel. Fetches
 * the signed-in user's per-skill sub-stat totals from
 * `/api/profile/skill-points-details` and passes `valueOverride` +
 * `detailsOverride` to each `SkillProgressBar` when the user has any
 * recorded skill rows. Falls back to the bundled `skillBreakdownDefaults`
 * exactly when there's no data so first-visit / no-data users still see
 * the original static layout (visuals unchanged).
 *
 * Admins viewing another user get an inline edit panel: pick an activity,
 * enter +/- deltas per skill, save to /api/admin/activity-skill-points.
 */
export function SkillBreakdownClient({
  viewingEmail,
  isAdmin = false,
}: {
  viewingEmail: string | null;
  isAdmin?: boolean;
}) {
  const { user, hydrated } = useAuth();
  const [state, setState] = useState<FetchState>({ kind: 'loading' });
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    if (!hydrated) return;
    if (!user?.email) {
      setState({ kind: 'ok', perSkill: null, activities: 0 });
      return;
    }
    const controller = new AbortController();
    setState({ kind: 'loading' });
    const target =
      viewingEmail && user.email && viewingEmail.toLowerCase() !== user.email.toLowerCase()
        ? viewingEmail
        : null;
    const url = target
      ? `/api/profile/skill-points-details?user=${encodeURIComponent(target)}`
      : '/api/profile/skill-points-details';
    fetch(url, {
      headers: { 'x-auth-email': user.email },
      signal: controller.signal,
      cache: 'no-store',
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as {
          perSkill: PerSkill | null;
          activities: number;
        };
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        setState({
          kind: 'ok',
          perSkill: data.perSkill ?? null,
          activities: data.activities ?? 0,
        });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        // Treat fetch failure as "no data" so the static fallback renders.
        setState({
          kind: 'ok',
          perSkill: null,
          activities: 0,
        });
        if (err instanceof Error && err.message !== 'HTTP 401') {
          console.warn('SkillBreakdown fetch failed, using defaults:', err);
        }
      });
    return () => controller.abort();
  }, [hydrated, user?.email, viewingEmail, refreshTick]);

  const perSkill = state.kind === 'ok' ? state.perSkill : null;
  const hasAnyData = perSkill !== null && state.kind === 'ok' && state.activities > 0;
  const canEdit = isAdmin && !!viewingEmail && !!user?.email && viewingEmail.toLowerCase() !== user.email.toLowerCase();

  // For self view, hide the panel when there's no data (intentional
  // empty-state UX). For admin view-as, always show the panel so the
  // admin has somewhere to land the edit controls.
  const hideForEmpty = !hasAnyData && state.kind !== 'loading' && state.kind !== 'error' && !canEdit;
  if (hideForEmpty) return null;

  const isLoading = state.kind === 'loading';

  return (
    <section className="bg-white rounded-2xl shadow-md p-6 lg:p-8">
      <header className="mb-6">
        <h2 className="font-serif text-2xl font-semibold text-hunter-green">
          Skill Breakdown
        </h2>
        <p className="text-sm text-dark-gray">
          {isLoading
            ? 'Memuat data skill…'
            : hasAnyData
              ? `Rata-rata kemampuan dari ${state.kind === 'ok' ? state.activities : 0} kontribusi activity`
              : canEdit
                ? 'User ini belum punya skill points. Pilih activity lalu masukkan delta untuk mulai mencatat.'
                : 'Rincian kemampuan kamu berdasarkan event yang difilter'}
        </p>
      </header>

      <div className="grid gap-4" aria-busy={isLoading} aria-live="polite">
        {isLoading
          ? skillBreakdownDefaults.map((item) => (
              <SkillBreakdownSkeleton key={item.skill} label={item.skill} />
            ))
          : skillBreakdownDefaults.map((item) => {
          // Strategy isn't in the static defaults — render it as a sixth
          // card when present, mirroring the same look.
          if (!item.skill) return null;
          const { value, details } = buildDetailsForSkill(item, perSkill);
          const hasData = perSkill !== null;
          // Hide skills whose averaged value is 0 — they have no useful
          // signal for the user. Don't apply the filter when there's no
          // data at all (admin view-as empty state) so all 5 cards show.
          if (hasData && value <= 0) return null;
          return (
            <SkillProgressBar
              key={item.skill}
              item={item}
              valueOverride={hasData ? value : undefined}
              detailsOverride={hasData ? details : undefined}
              levelOverride={hasData ? levelFromValue(value) : undefined}
            />
          );
        })}
        {!hasAnyData && canEdit && (
          <p className="rounded-lg border border-dashed border-light-gray bg-off-white p-4 text-center text-xs text-dark-gray">
            Belum ada data. Gunakan panel edit di bawah untuk menambahkan nilai pertama.
          </p>
        )}
      </div>

      {canEdit && (
        <SkillBreakdownAdminEdit
          viewingEmail={viewingEmail!}
          selfEmail={user!.email}
          onSaved={() => setRefreshTick((t) => t + 1)}
        />
      )}
    </section>
  );
}

function SkillBreakdownAdminEdit({
  viewingEmail,
  selfEmail,
  onSaved,
}: {
  viewingEmail: string;
  selfEmail: string;
  onSaved: () => void;
}) {
  const [joinedActivities, setJoinedActivities] = useState<JoinedActivity[]>([]);
  const [activitySearch, setActivitySearch] = useState('');
  const [activityPage, setActivityPage] = useState(1);
  const [isActivityDropdownOpen, setIsActivityDropdownOpen] = useState(false);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [deltas, setDeltas] = useState<Deltas>(emptyDeltas);
  const [baseline, setBaseline] = useState<Deltas>(emptyDeltas);
  const [existingLoaded, setExistingLoaded] = useState(false);
  const [status, setStatus] = useState<SaveStatus>({ kind: 'idle' });
  const ACTIVITY_PAGE_SIZE = 10;

  // Fetch existing skill points for the selected (user, activity) and
  // pre-fill the inputs with the current values. Subsequent edits are
  // treated as deltas relative to this baseline; save converts back.
  useEffect(() => {
    if (!selectedActivityId) {
      setBaseline(emptyDeltas());
      setExistingLoaded(false);
      return;
    }
    const controller = new AbortController();
    setExistingLoaded(false);
    fetch(
      `/api/admin/activity-skill-points?activity=${encodeURIComponent(selectedActivityId)}`,
      {
        headers: { 'x-auth-email': selfEmail },
        cache: 'no-store',
        signal: controller.signal,
      },
    )
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as ExistingSkillPointsResponse;
      })
      .then((body) => {
        if (controller.signal.aborted) return;
        const target = viewingEmail.toLowerCase();
        const member = body.members.find((m) => m.email.toLowerCase() === target);
        const next: Deltas = {};
        if (member) {
          for (const [skill, row] of Object.entries(member.rows)) {
            const key = skill as SkillKey;
            const slot: DeltaByField = { main: row ? String(row.value) : '0' };
            for (const sub of SKILL_SUB_STATS[key]) {
              slot[sub] = row ? String(row.subStats[sub] ?? 0) : '0';
            }
            next[key] = slot;
          }
        }
        setBaseline(next);
        setDeltas(next);
        setExistingLoaded(true);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setBaseline(emptyDeltas());
        setDeltas(emptyDeltas());
        setExistingLoaded(true);
      });
    return () => controller.abort();
  }, [selectedActivityId, selfEmail, viewingEmail]);

  // Fetch joined activities for the dropdown (with server-side search).
  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams();
        if (activitySearch.trim()) params.set('search', activitySearch.trim());
        params.set('user', viewingEmail);
        const res = await fetch(
          `/api/profile/joined-activities?${params.toString()}`,
          {
            headers: { 'x-auth-email': selfEmail },
            cache: 'no-store',
            signal: controller.signal,
          },
        );
        if (!res.ok) return;
        const body = (await res.json()) as JoinedActivitiesResponse;
        if ('events' in body) {
          setJoinedActivities(body.events);
          setActivityPage(1);
        }
      } catch {
        // ignore — dropdown shows nothing
      }
    }, 300);
    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [viewingEmail, selfEmail, activitySearch]);

  const paginatedActivities = useMemo(
    () => joinedActivities.slice(0, activityPage * ACTIVITY_PAGE_SIZE),
    [joinedActivities, activityPage],
  );
  const hasMore = joinedActivities.length > paginatedActivities.length;
  const selectedActivity = joinedActivities.find((a) => a.id === selectedActivityId);

  const setField = (
    skill: SkillKey,
    field: 'main' | SubStatKey,
    value: string,
  ) => {
    setDeltas((prev) => {
      const slot = prev[skill] ?? { main: '' };
      return { ...prev, [skill]: { ...slot, [field]: clampValue(value) } };
    });
  };

  const handleSave = async () => {
    if (!selectedActivityId) return;
    setStatus({ kind: 'saving' });
    const body: {
      activityId: string;
      deltas: Record<string, Record<string, { main?: number } & Record<string, number>>>;
    } = { activityId: selectedActivityId, deltas: {} };
    const userSlot: Record<string, { main?: number } & Record<string, number>> = {};
    for (const skill of SKILL_DISPLAY_ORDER) {
      const slot = deltas[skill];
      if (!slot) continue;
      const base = baseline[skill] ?? { main: '0' };
      const entry: { main?: number } & Record<string, number> = {};
      const cur = Number.parseInt(slot.main ?? '', 10);
      const baseMain = Number.parseInt(base.main ?? '0', 10);
      if (Number.isFinite(cur) && Number.isFinite(baseMain) && cur !== baseMain) {
        const d = Number.parseInt(clampDelta(String(cur - baseMain)), 10);
        if (Number.isFinite(d) && d !== 0) entry.main = d;
      }
      for (const sub of SKILL_SUB_STATS[skill]) {
        const v = Number.parseInt(slot[sub] ?? '', 10);
        const b = Number.parseInt(base[sub] ?? '0', 10);
        if (Number.isFinite(v) && Number.isFinite(b) && v !== b) {
          const d = Number.parseInt(clampDelta(String(v - b)), 10);
          if (Number.isFinite(d) && d !== 0) entry[sub] = d;
        }
      }
      if (Object.keys(entry).length > 0) userSlot[skill] = entry;
    }
    if (Object.keys(userSlot).length === 0) {
      setStatus({ kind: 'error', message: 'Tidak ada perubahan untuk disimpan' });
      return;
    }
    body.deltas[viewingEmail] = userSlot;
    try {
      const res = await fetch('/api/admin/activity-skill-points', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-auth-email': selfEmail,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errBody.error ?? `HTTP ${res.status}`);
      }
      // After save, the inputs ARE the new baseline.
      setBaseline(deltas);
      setStatus({ kind: 'saved', at: Date.now() });
      onSaved();
    } catch (err) {
      setStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Gagal menyimpan',
      });
    }
  };

  return (
    <div className="mt-6 rounded-xl border border-paprika/30 bg-paprika/[0.04] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-paprika">
            Admin: Edit Skill Breakdown
          </p>
          <p className="mt-0.5 text-xs text-dark-gray">
            Pilih activity, lalu masukkan delta (contoh: +5 atau -2) per skill.
            Nilai kosong berarti tidak ada perubahan.
          </p>
        </div>
        <SaveBadge status={status} />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-dark-gray">
          Activity
        </span>
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsActivityDropdownOpen((v) => !v)}
            className="flex items-center gap-2 rounded-lg border border-light-gray bg-white px-3 py-1.5 text-xs text-graphite transition-colors hover:border-hunter-green hover:bg-hunter-green/5"
          >
            <span className="truncate max-w-[200px]">
              {selectedActivity?.title ?? 'Pilih activity'}
            </span>
            <ChevronDown
              size={14}
              className={`text-dark-gray transition-transform ${isActivityDropdownOpen ? 'rotate-180' : ''}`}
            />
          </button>
          {isActivityDropdownOpen && (
            <div className="absolute left-0 top-full mt-1 z-50 min-w-[280px] max-w-[360px] rounded-lg border border-light-gray bg-white shadow-lg overflow-hidden">
              <div className="p-2 border-b border-light-gray">
                <input
                  type="text"
                  value={activitySearch}
                  onChange={(e) => {
                    setActivitySearch(e.target.value);
                    setActivityPage(1);
                  }}
                  placeholder="Cari activity..."
                  className="w-full rounded-md border border-light-gray bg-off-white px-3 py-1.5 text-xs text-graphite placeholder:text-dark-gray focus:border-hunter-green focus:bg-white focus:outline-none"
                  autoFocus
                />
              </div>
              <div className="max-h-[260px] overflow-y-auto">
                {joinedActivities.length === 0 ? (
                  <div className="px-3 py-4 text-xs text-dark-gray text-center">
                    {activitySearch
                      ? `Tidak ada activity dengan "${activitySearch}"`
                      : 'User ini belum terdaftar di activity manapun.'}
                  </div>
                ) : (
                  paginatedActivities.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => {
                        setSelectedActivityId(a.id);
                        setIsActivityDropdownOpen(false);
                        setActivitySearch('');
                        setActivityPage(1);
                        setDeltas(emptyDeltas());
                        setBaseline(emptyDeltas());
                        setExistingLoaded(false);
                        setStatus({ kind: 'idle' });
                      }}
                      className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                        selectedActivityId === a.id
                          ? 'bg-hunter-green/10 text-hunter-green font-semibold'
                          : 'text-graphite hover:bg-hunter-green/5'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span aria-hidden="true">{a.icon}</span>
                        <span className="truncate">{a.title}</span>
                      </div>
                    </button>
                  ))
                )}
                {hasMore && (
                  <button
                    type="button"
                    onClick={() => setActivityPage((p) => p + 1)}
                    className="w-full py-2 text-xs font-semibold text-hunter-green hover:text-paprika"
                  >
                    Show {joinedActivities.length - paginatedActivities.length} more
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {SKILL_DISPLAY_ORDER.map((skill) => {
          const slot = deltas[skill] ?? { main: '' };
          const subs = SKILL_SUB_STATS[skill];
          const loading: boolean = !!selectedActivityId && !existingLoaded;
          return (
            <div
              key={skill}
              className="rounded-lg border border-light-gray bg-white p-3"
            >
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-graphite">
                {SKILL_LABELS[skill] ?? skill}
              </p>
              <DeltaInput
                label="Main"
                value={slot.main ?? ''}
                disabled={!selectedActivityId || loading}
                onChange={(v) => setField(skill, 'main', v)}
              />
              {subs.map((sub) => (
                <DeltaInput
                  key={sub}
                  label={SUB_STAT_LABELS[sub]}
                  value={slot[sub] ?? ''}
                  disabled={!selectedActivityId || loading}
                  onChange={(v) => setField(skill, sub, v)}
                />
              ))}
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            setDeltas(baseline);
            setStatus({ kind: 'idle' });
          }}
          disabled={!selectedActivityId || !existingLoaded || !hasChanges(baseline, deltas) || status.kind === 'saving'}
          className="rounded-full border border-light-gray px-4 py-1.5 text-xs font-semibold text-dark-gray transition-colors hover:border-dark-gray hover:text-graphite disabled:opacity-40"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!selectedActivityId || !existingLoaded || !hasChanges(baseline, deltas) || status.kind === 'saving'}
          className="inline-flex items-center gap-2 rounded-full bg-paprika px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-paprika/90 disabled:opacity-40"
        >
          {status.kind === 'saving' ? 'Menyimpan…' : 'Simpan'}
        </button>
      </div>
    </div>
  );
}

function DeltaInput({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <label className="mt-1 flex items-center gap-2">
      <span className="w-16 text-[0.65rem] font-semibold uppercase tracking-wider text-dark-gray">
        {label}
      </span>
      <input
        type="text"
        inputMode="numeric"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
        className="w-full rounded-md border border-light-gray bg-off-white px-2 py-1 text-sm tabular-nums text-graphite focus:border-hunter-green focus:bg-white focus:outline-none disabled:opacity-50"
      />
    </label>
  );
}

function SkillBreakdownSkeleton({ label }: { label: string }) {
  return (
    <div
      className="animate-pulse rounded-xl border border-light-gray bg-white p-4"
      aria-hidden="true"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-light-gray" />
          <div>
            <div className="h-3 w-24 rounded bg-light-gray" />
            <div className="mt-2 h-2 w-16 rounded bg-light-gray/70" />
          </div>
        </div>
        <div className="h-5 w-16 rounded-full bg-light-gray" />
      </div>
      <div className="mt-3 h-2 w-full rounded-full bg-light-gray/70" />
      <span className="sr-only">{`Memuat ${label}`}</span>
    </div>
  );
}

function SaveBadge({ status }: { status: SaveStatus }) {
  if (status.kind === 'idle') return null;
  if (status.kind === 'saving') {
    return (
      <span className="rounded-full bg-dark-gray/10 px-3 py-1 text-xs font-semibold text-dark-gray">
        Menyimpan…
      </span>
    );
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

// Strategy isn't in the static `skillBreakdownDefaults` list — Strategy
// rows are accepted by the store but not rendered by this panel. The
// radar chart above shows them.
