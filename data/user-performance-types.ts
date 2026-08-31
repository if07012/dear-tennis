// ============================================
// USER PERFORMANCE POINTS TYPES
// ============================================
// Per-(user, activity, skill) target/kesalahan values. One row per triple
// in the `user_performance_points` sheet. The profile "Performance
// Overview" chart averages the user's rows across activities per skill
// (per-skill denominator; missing skills stay at 0). The admin activity
// page applies +/- deltas against a single activity's rows in one batch.
//
// Storage keeps separate `*Target` and `*Kesalahan` columns so a single
// row can carry both metrics for its skill without colliding with other
// skills' axes.

export const PERFORMANCE_SKILL_KEYS = [
  'forehand',
  'backhand',
  'serve',
  'volley',
  'footwork',
] as const;

export type PerformanceSkillKey = (typeof PERFORMANCE_SKILL_KEYS)[number];

export const PERF_TARGET_KEYS = [
  'forehandTarget',
  'backhandTarget',
  'serveTarget',
  'volleyTarget',
  'footworkTarget',
] as const;

export const PERF_KESALAHAN_KEYS = [
  'forehandKesalahan',
  'backhandKesalahan',
  'serveKesalahan',
  'volleyKesalahan',
  'footworkKesalahan',
] as const;

export type PerfTargetKey = (typeof PERF_TARGET_KEYS)[number];
export type PerfKesalahanKey = (typeof PERF_KESALAHAN_KEYS)[number];

export const PERFORMANCE_SKILL_LABELS: Record<PerformanceSkillKey, string> = {
  forehand: 'Forehand',
  backhand: 'Backhand',
  serve: 'Serve',
  volley: 'Volley',
  footwork: 'Footwork',
};

/**
 * Order in which the chart plots values. Same shape as the static
 * `performanceByEvent` rows in `data/profile.ts:43`.
 */
export const PERFORMANCE_DISPLAY_ORDER: PerformanceSkillKey[] = [
  'forehand',
  'backhand',
  'serve',
  'volley',
  'footwork',
];

export const USER_PERFORMANCE_HEADERS = [
  'id',
  'userEmail',
  'activityId',
  'skill',
  ...PERF_TARGET_KEYS,
  ...PERF_KESALAHAN_KEYS,
  'updatedAt',
  'updatedBy',
] as const;

export function isPerformanceSkillKey(
  value: string,
): value is PerformanceSkillKey {
  return (PERFORMANCE_SKILL_KEYS as readonly string[]).includes(value);
}

export function clampPerfValue(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 100) return 100;
  return Math.round(n);
}

export function buildPerfRowId(
  userEmail: string,
  activityId: string,
  skill: PerformanceSkillKey,
): string {
  const u = userEmail.trim().toLowerCase();
  const a = activityId.trim();
  return `${u}__${a}__${skill}`;
}
