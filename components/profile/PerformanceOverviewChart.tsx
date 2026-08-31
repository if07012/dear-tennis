'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useChartReady } from '@/hooks/useChartReady';
import { LineChartIcon, ChevronDown } from '@/components/ui/Icons';
import {
  PERFORMANCE_DISPLAY_ORDER,
  PERFORMANCE_SKILL_LABELS,
  type PerformanceSkillKey,
} from '@/data/user-performance-types';

type ChartHandle = { destroy(): void; update(): void };
type ChartCtor = new (ctx: HTMLCanvasElement, config: unknown) => ChartHandle;

type AggregatedMetrics = {
  labels: string[];
  target: number[];
  kesalahan: number[];
};

type ApiResponse =
  | {
      labels: string[];
      target: number[];
      kesalahan: number[];
      activities: number;
    }
  | null;

type FetchState =
  | { kind: 'loading' }
  | { kind: 'ok'; data: AggregatedMetrics; activities: number }
  | { kind: 'empty' }
  | { kind: 'error'; message: string };

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

type JoinedActivitiesResponse =
  | { events: JoinedActivity[] }
  | { error: string };

type Props = {
  /** Selected event slugs from the Filter & Breakdown chips. Currently a
   * no-op for this chart — the API aggregates across all of the user's
   * approved activities regardless of selection. Kept as a prop so the
   * surrounding UI's chip-filter layout stays untouched. */
  selectedEvents: string[];
  /** When set, fetch that user's performance instead of the signed-in user.
   * Admin-only on the server; non-admin values are ignored. */
  viewingEmail: string | null;
  /** Enables inline +/- edit inputs below the chart. Requires
   * `viewingEmail` to differ from the signed-in user (i.e. true admin
   * "view as" mode). */
  isAdmin: boolean;
};

type DeltaByField = { target: string; kesalahan: string };
type Deltas = Record<PerformanceSkillKey, DeltaByField>;
type SaveStatus =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved'; at: number }
  | { kind: 'error'; message: string };

const DELTA_MAX = 100;

function emptyDeltaByField(): DeltaByField {
  return { target: '', kesalahan: '' };
}

function clampDelta(raw: string): string {
  if (raw === '' || raw === '-') return raw;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return '';
  if (n > DELTA_MAX) return String(DELTA_MAX);
  if (n < -DELTA_MAX) return String(-DELTA_MAX);
  return String(n);
}

function emptyDeltas(): Deltas {
  const out = {} as Deltas;
  for (const s of PERFORMANCE_DISPLAY_ORDER) out[s] = emptyDeltaByField();
  return out;
}

function hasAnyDelta(deltas: Deltas): boolean {
  for (const s of PERFORMANCE_DISPLAY_ORDER) {
    const slot = deltas[s];
    if (!slot) continue;
    if (slot.target && slot.target !== '' && slot.target !== '-') return true;
    if (slot.kesalahan && slot.kesalahan !== '' && slot.kesalahan !== '-') return true;
  }
  return false;
}

export function PerformanceOverviewChart({
  selectedEvents,
  viewingEmail,
  isAdmin,
}: Props) {
  const { user } = useAuth();
  const [state, setState] = useState<FetchState>({ kind: 'loading' });
  const [joinedActivities, setJoinedActivities] = useState<JoinedActivity[]>([]);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [isActivityDropdownOpen, setIsActivityDropdownOpen] = useState(false);
  const [activitySearch, setActivitySearch] = useState('');
  const [activityPage, setActivityPage] = useState(1);
  const [deltas, setDeltas] = useState<Deltas>(emptyDeltas);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({ kind: 'idle' });
  const [refreshTick, setRefreshTick] = useState(0);
  const ACTIVITY_PAGE_SIZE = 10;

  // Effective email for the API: viewingEmail (admin override) takes
  // priority, otherwise fall back to the signed-in user.
  const targetEmail = viewingEmail ?? user?.email ?? null;
  // Case-insensitive comparison: viewingEmail is always lowercased
  // (URL-derived), but `user.email` may be whatever the sheet returned
  // during login. Without `.toLowerCase()` here, an admin viewing a
  // member whose email casing differs from their own would never pass
  // the "viewing another user" gate.
  const canEdit =
    isAdmin &&
    !!viewingEmail &&
    !!user?.email &&
    viewingEmail.toLowerCase() !== user.email.toLowerCase();

  // Fetch joined activities for the dropdown with search
  useEffect(() => {
    if (!user?.email) return;
    const controller = new AbortController();
    const timeoutId = setTimeout(async () => {
      try {
        const params = new URLSearchParams();
        if (activitySearch.trim()) {
          params.set('search', activitySearch.trim());
        }
        if (viewingEmail && viewingEmail !== user.email) {
          params.set('user', viewingEmail);
        }
        const res = await fetch(`/api/profile/joined-activities?${params.toString()}`, {
          headers: { 'x-auth-email': user.email },
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!res.ok) return;
        const body = (await res.json()) as JoinedActivitiesResponse;
        if ('events' in body) {
          setJoinedActivities(body.events);
          setActivityPage(1);
        }
      } catch {
        // Ignore - dropdown will just show "All Activities" only
      }
    }, 300);
    return () => {
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, [user?.email, viewingEmail, activitySearch]);

  // Fetch performance data based on selected activity + viewingEmail
  useEffect(() => {
    if (!user?.email) {
      setState({ kind: 'loading' });
      return;
    }
    const controller = new AbortController();
    setState({ kind: 'loading' });
    (async () => {
      try {
        const params = new URLSearchParams();
        if (selectedActivityId) {
          params.set('activityId', selectedActivityId);
        }
        if (viewingEmail && viewingEmail !== user.email) {
          params.set('user', viewingEmail);
        }
        const res = await fetch(`/api/profile/performance?${params.toString()}`, {
          headers: { 'x-auth-email': user.email },
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        const body = (await res.json()) as ApiResponse;
        if (!body) {
          setState({ kind: 'empty' });
          return;
        }
        const labels = body.labels.map((label) =>
          label.charAt(0).toUpperCase() + label.slice(1),
        );
        setState({
          kind: 'ok',
          data: {
            labels,
            target: body.target,
            kesalahan: body.kesalahan,
          },
          activities: body.activities,
        });
        // Reset deltas whenever the data context changes.
        setDeltas(emptyDeltas());
        setSaveStatus({ kind: 'idle' });
      } catch (err) {
        if ((err as { name?: string }).name === 'AbortError') return;
        setState({
          kind: 'error',
          message: err instanceof Error ? err.message : 'Failed to load',
        });
      }
    })();
    return () => controller.abort();
  }, [user?.email, selectedActivityId, viewingEmail, refreshTick]);

  const handleActivitySelect = (activityId: string | null) => {
    setSelectedActivityId(activityId);
    setIsActivityDropdownOpen(false);
    setActivitySearch('');
    setActivityPage(1);
  };

  const isAllActivitiesSelected = selectedActivityId === null;

  const setDeltaField = (
    skill: PerformanceSkillKey,
    field: 'target' | 'kesalahan',
    value: string,
  ) => {
    setDeltas((prev) => {
      const slot = prev[skill] ?? emptyDeltaByField();
      return { ...prev, [skill]: { ...slot, [field]: clampDelta(value) } };
    });
  };

  const handleSave = async () => {
    if (!user?.email || !viewingEmail) return;
    if (!selectedActivityId) return;
    if (!hasAnyDelta(deltas)) return;
    setSaveStatus({ kind: 'saving' });
    const body: {
      activityId: string;
      deltas: Record<string, Record<string, { target?: number; kesalahan?: number }>>;
    } = { activityId: selectedActivityId, deltas: {} };
    const userSlot: Record<string, { target?: number; kesalahan?: number }> = {};
    for (const skill of PERFORMANCE_DISPLAY_ORDER) {
      const slot = deltas[skill];
      if (!slot) continue;
      const t = slot.target;
      const k = slot.kesalahan;
      if (t && t !== '' && t !== '-') {
        const n = Number.parseInt(t, 10);
        if (Number.isFinite(n) && n !== 0) userSlot[skill] = { ...userSlot[skill], target: n };
      }
      if (k && k !== '' && k !== '-') {
        const n = Number.parseInt(k, 10);
        if (Number.isFinite(n) && n !== 0) userSlot[skill] = { ...userSlot[skill], kesalahan: n };
      }
    }
    if (Object.keys(userSlot).length === 0) {
      setSaveStatus({ kind: 'error', message: 'Tidak ada nilai untuk disimpan' });
      return;
    }
    body.deltas[viewingEmail] = userSlot;
    try {
      const res = await fetch('/api/admin/activity-performance', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-auth-email': user.email,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errBody.error ?? `HTTP ${res.status}`);
      }
      setDeltas(emptyDeltas());
      setRefreshTick((t) => t + 1);
      setSaveStatus({ kind: 'saved', at: Date.now() });
    } catch (err) {
      setSaveStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Gagal menyimpan',
      });
    }
  };

  const paginatedActivities = useMemo(() => {
    return joinedActivities.slice(0, activityPage * ACTIVITY_PAGE_SIZE);
  }, [joinedActivities, activityPage]);

  const hasMoreActivities = joinedActivities.length > paginatedActivities.length;

  return (
    <section className="relative bg-white rounded-2xl shadow-md p-6 lg:p-8">
      <header className="mb-6">
        <div className="flex items-center gap-3">
          <span className="profile-section-icon" aria-hidden="true">
            <LineChartIcon />
          </span>
          <div className="flex-1">
            <h2 className="font-serif text-xl font-semibold text-hunter-green">
              Performance Overview
            </h2>
            <p className="text-sm text-dark-gray">
              {isAllActivitiesSelected
                ? 'Rata-rata target & kesalahan per skill dari semua activity'
                : 'Target & kesalahan per skill untuk activity yang dipilih'}
            </p>
          </div>
        </div>

        {/* Activity Selector Dropdown — second row on mobile, right of title on sm+ */}
        <div className="relative mt-3 sm:mt-0 sm:absolute sm:right-6 sm:top-6 sm:mt-0 sm:w-auto z-10">
          <button
            type="button"
            onClick={() => setIsActivityDropdownOpen(!isActivityDropdownOpen)}
            className="flex w-full sm:w-auto items-center justify-between gap-2 rounded-lg border border-light-gray bg-white px-3 py-2 text-sm text-graphite transition-colors hover:border-hunter-green hover:bg-hunter-green/5 focus:outline-none focus:ring-2 focus:ring-hunter-green/20"
            aria-haspopup="listbox"
            aria-expanded={isActivityDropdownOpen}
            aria-label="Pilih activity"
          >
            <span className="truncate max-w-[200px]">
              {isAllActivitiesSelected
                ? 'Semua Activity (Rata-rata)'
                : joinedActivities.find((a) => a.id === selectedActivityId)?.title ?? 'Activity'}
            </span>
            <ChevronDown
              size={16}
              className={`text-dark-gray transition-transform ${isActivityDropdownOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {isActivityDropdownOpen && (
            <div className="absolute right-0 sm:right-0 left-0 sm:left-auto top-full mt-1 z-50 w-[calc(100vw-2rem)] sm:w-[320px] sm:max-w-[360px] max-h-[60vh] overflow-y-auto rounded-lg border border-light-gray bg-white shadow-lg">
              {/* Search input */}
              <div className="p-2 border-b border-light-gray">
                <input
                  type="text"
                  value={activitySearch}
                  onChange={(e) => {
                    setActivitySearch(e.target.value);
                    setActivityPage(1);
                  }}
                  placeholder="Cari activity..."
                  className="w-full rounded-md border border-light-gray bg-off-white px-3 py-1.5 text-sm text-graphite placeholder:text-dark-gray focus:border-hunter-green focus:bg-white focus:outline-none"
                  autoFocus
                />
              </div>

              <button
                type="button"
                onClick={() => handleActivitySelect(null)}
                className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                  isAllActivitiesSelected
                    ? 'bg-hunter-green/10 text-hunter-green font-semibold'
                    : 'text-graphite hover:bg-hunter-green/5'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="text-lg">📊</span>
                    <span className="truncate">Semua Activity (Rata-rata)</span>
                  </span>
                  {isAllActivitiesSelected && (
                    <span className="flex-shrink-0 inline-flex h-4 w-4 items-center justify-center rounded-full bg-hunter-green text-[0.55rem] text-white">✓</span>
                  )}
                </div>
              </button>
              <hr className="my-1 border-light-gray" />
              {joinedActivities.length === 0 ? (
                <div className="px-3 py-4 text-sm text-dark-gray text-center">
                  {activitySearch ? `Tidak ada activity dengan "${activitySearch}"` : 'Belum bergabung activity manapun'}
                </div>
              ) : (
                <>
                  {paginatedActivities.map((activity) => (
                    <button
                      key={activity.id}
                      type="button"
                      onClick={() => handleActivitySelect(activity.id)}
                      className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                        selectedActivityId === activity.id
                          ? 'bg-hunter-green/10 text-hunter-green font-semibold'
                          : 'text-graphite hover:bg-hunter-green/5'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2 min-w-0">
                          <span className="text-lg">{activity.icon}</span>
                          <span className="truncate">{activity.title}</span>
                        </span>
                        {selectedActivityId === activity.id && (
                          <span className="flex-shrink-0 inline-flex h-4 w-4 items-center justify-center rounded-full bg-hunter-green text-[0.55rem] text-white">✓</span>
                        )}
                      </div>
                    </button>
                  ))}
                  {hasMoreActivities && (
                    <button
                      type="button"
                      onClick={() => setActivityPage((p) => p + 1)}
                      className="w-full py-2 text-xs font-semibold text-hunter-green hover:text-paprika transition-colors"
                    >
                      Show {joinedActivities.length - paginatedActivities.length} more
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </header>

      {state.kind === 'loading' && <LoadingBlock />}
      {state.kind === 'error' && <ErrorBlock message={state.message} />}
      {state.kind === 'empty' && <EmptyBlock />}
      {state.kind === 'ok' && (
        <ChartCanvas data={state.data} activityCount={state.activities} isAverage={isAllActivitiesSelected} />
      )}

      {canEdit && state.kind === 'ok' && (
        <AdminEditPanel
          currentTarget={state.data.target}
          currentKesalahan={state.data.kesalahan}
          deltas={deltas}
          onChangeField={setDeltaField}
          onSave={handleSave}
          onReset={() => {
            setDeltas(emptyDeltas());
            setSaveStatus({ kind: 'idle' });
          }}
          status={saveStatus}
          isAverage={isAllActivitiesSelected}
          hasAny={hasAnyDelta(deltas)}
        />
      )}

      {/* selectedEvents is currently unused by the chart but kept on the
          prop signature so surrounding chip-filter UI keeps working. */}
      <span className="hidden" data-selected-events={selectedEvents.join(',')} />
    </section>
  );
}

function LoadingBlock() {
  return (
    <div className="flex h-[300px] items-center justify-center rounded-xl border border-dashed border-light-gray bg-off-white text-sm text-dark-gray">
      Memuat chart…
    </div>
  );
}

function ErrorBlock({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-paprika/40 bg-paprika/5 p-6 text-center text-sm text-paprika">
      Gagal memuat performance: {message}
    </div>
  );
}

function EmptyBlock() {
  return (
    <div className="rounded-xl border border-dashed border-light-gray bg-off-white p-8 text-center text-sm text-dark-gray">
      Belum ada data performance yang tercatat. Admin belum menginput
      nilai target / kesalahan untuk activity manapun.
    </div>
  );
}

function ChartCanvas({
  data,
  activityCount,
  isAverage,
}: {
  data: AggregatedMetrics;
  activityCount: number;
  isAverage: boolean;
}) {
  const Chart = useChartReady() as ChartCtor | null;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<ChartHandle | null>(null);

  useEffect(() => {
    if (!Chart || !canvasRef.current) return;

    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    chartRef.current = new Chart(canvasRef.current, {
      type: 'bar',
      data: {
        labels: data.labels,
        datasets: [
          {
            type: 'line' as const,
            label: 'Target',
            data: data.target,
            borderColor: 'rgba(44, 95, 75, 1)',
            backgroundColor: 'rgba(44, 95, 75, 0.15)',
            borderWidth: 2,
            tension: 0.35,
            pointRadius: 5,
            pointBackgroundColor: 'rgba(44, 95, 75, 1)',
            pointBorderColor: '#fff',
            pointHoverRadius: 7,
            fill: false,
            order: 1,
            yAxisID: 'y',
          },
          {
            type: 'bar' as const,
            label: 'Kesalahan',
            data: data.kesalahan,
            backgroundColor: 'rgba(232, 93, 4, 0.25)',
            borderColor: 'rgba(232, 93, 4, 0.7)',
            borderWidth: 1,
            borderRadius: 6,
            order: 3,
            yAxisID: 'y',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'top',
            labels: {
              font: { family: 'Inter', size: 12 },
              color: '#3A3A3A',
              usePointStyle: true,
              padding: 16,
            },
          },
          tooltip: {
            backgroundColor: 'rgba(58, 58, 58, 0.95)',
            titleFont: { family: 'Inter', size: 13, weight: 'bold' },
            bodyFont: { family: 'Inter', size: 12 },
            padding: 10,
            cornerRadius: 6,
          },
          title: {
            display: true,
            text: isAverage
              ? `Rata-rata dari ${activityCount} activity`
              : `Data dari 1 activity`,
            font: { family: 'Inter', size: 11, weight: 'normal' },
            color: '#6c757d',
            padding: { bottom: 8 },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { family: 'Inter', size: 11 }, color: '#6c757d' },
          },
          y: {
            beginAtZero: true,
            max: 100,
            grid: { color: 'rgba(173, 181, 189, 0.3)' },
            ticks: { font: { family: 'Inter', size: 11 }, color: '#6c757d' },
          },
        },
      },
    });

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [Chart, data]);

  return (
    <div className="relative h-[300px] w-full">
      <canvas ref={canvasRef} aria-label="Performance overview chart" />
    </div>
  );
}

function AdminEditPanel({
  currentTarget,
  currentKesalahan,
  deltas,
  onChangeField,
  onSave,
  onReset,
  status,
  isAverage,
  hasAny,
}: {
  currentTarget: number[];
  currentKesalahan: number[];
  deltas: Deltas;
  onChangeField: (
    skill: PerformanceSkillKey,
    field: 'target' | 'kesalahan',
    value: string,
  ) => void;
  onSave: () => void;
  onReset: () => void;
  status: SaveStatus;
  isAverage: boolean;
  hasAny: boolean;
}) {
  return (
    <div className="mt-6 rounded-xl border border-paprika/30 bg-paprika/[0.04] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-paprika">
            Admin: Edit Performance
          </p>
          <p className="mt-0.5 text-xs text-dark-gray">
            {isAverage
              ? 'Pilih activity spesifik untuk edit nilai target / kesalahan.'
              : 'Masukkan delta (contoh: +5 atau -2) lalu simpan. Nilai kosong berarti tidak ada perubahan.'}
          </p>
        </div>
        <SaveBadge status={status} />
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {(() => {
          const visible = PERFORMANCE_DISPLAY_ORDER.map((skill, idx) => ({
            skill,
            idx,
            baseTarget: currentTarget[idx] ?? 0,
            baseKesalahan: currentKesalahan[idx] ?? 0,
          })).filter(
            (c) => !(c.baseTarget === 0 && c.baseKesalahan === 0),
          );
          if (visible.length === 0) {
            return (
              <div className="col-span-full rounded-lg border border-dashed border-light-gray bg-white p-4 text-center text-xs text-dark-gray">
                Semua skill masih nol untuk activity ini. Tidak ada yang perlu diedit.
              </div>
            );
          }
          return visible.map(({ skill, idx, baseTarget, baseKesalahan }) => {
            const slot = deltas[skill] ?? emptyDeltaByField();
            return (
              <div
                key={skill}
                className="rounded-lg border border-light-gray bg-white p-3"
              >
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-graphite">
                  {PERFORMANCE_SKILL_LABELS[skill] ?? skill}
                </p>
                <span className="text-[0.65rem] font-semibold text-dark-gray">
                  Saat ini: T <span className="text-hunter-green">{baseTarget}</span>
                  {' / '}K <span className="text-paprika">{baseKesalahan}</span>
                </span>
              </div>
              <DeltaInput
                label="Target"
                value={slot.target}
                disabled={isAverage}
                base={baseTarget}
                onChange={(v) => onChangeField(skill, 'target', v)}
              />
              <DeltaInput
                label="Kesalahan"
                value={slot.kesalahan}
                disabled={isAverage}
                base={baseKesalahan}
                onChange={(v) => onChangeField(skill, 'kesalahan', v)}
              />
            </div>
            );
          });
        })()}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={onReset}
          disabled={!hasAny || status.kind === 'saving'}
          className="rounded-full border border-light-gray px-4 py-1.5 text-xs font-semibold text-dark-gray transition-colors hover:border-dark-gray hover:text-graphite disabled:opacity-40 disabled:hover:border-light-gray disabled:hover:text-dark-gray"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={isAverage || !hasAny || status.kind === 'saving'}
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
  base,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  base: number;
}) {
  // Live preview of the post-delta value so the admin can see where the
  // number is heading before saving. Falls back to the base when the
  // input is empty or a partial `-` so we don't show a misleading `NaN`.
  const preview = computePreview(base, value);
  const showsChange = preview !== null && preview !== base;
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
      <span
        className={[
          'min-w-[2.5rem] text-right text-[0.65rem] tabular-nums',
          showsChange ? 'font-semibold text-paprika' : 'text-dark-gray',
        ].join(' ')}
        aria-label={
          showsChange ? `Akan menjadi ${preview}` : 'Belum ada perubahan'
        }
      >
        → {preview ?? base}
      </span>
    </label>
  );
}

function computePreview(base: number, raw: string): number | null {
  if (raw === '' || raw === '-') return null;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return null;
  const next = base + n;
  if (next < 0) return 0;
  if (next > 100) return 100;
  return next;
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
