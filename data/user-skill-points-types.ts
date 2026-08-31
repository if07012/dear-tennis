// ============================================
// USER SKILL POINTS TYPES
// ============================================
// Per-(user, activity, skill) skill point values. One row per triple in
// the `user_skill_points` sheet. The profile radar sums a user's rows
// across all activities per skill and clamps to 0-100; the breakdown
// section sums the sub-stat columns the same way. The admin activity
// page writes +/- deltas against individual rows.

export const SKILL_KEYS = [
  'forehand',
  'backhand',
  'serve',
  'volley',
  'footwork',
  'strategy',
] as const;

export type SkillKey = (typeof SKILL_KEYS)[number];

export type SkillValues = Record<SkillKey, number>;

// Six sub-stat axes shared across all skills. Each skill uses a subset —
// see SKILL_SUB_STATS for the mapping. Footwork uses Speed/Agility/Balance;
// every other skill uses Accuracy/Power/Consistency.
export const SUB_STAT_KEYS = [
  'accuracy',
  'power',
  'consistency',
  'speed',
  'agility',
  'balance',
] as const;

export type SubStatKey = (typeof SUB_STAT_KEYS)[number];

export type SkillSubStats = Record<SubStatKey, number>;

export const SKILL_SUB_STATS: Record<SkillKey, readonly SubStatKey[]> = {
  forehand: ['accuracy', 'power', 'consistency'],
  backhand: ['accuracy', 'power', 'consistency'],
  serve: ['accuracy', 'power', 'consistency'],
  volley: ['accuracy', 'power', 'consistency'],
  footwork: ['speed', 'agility', 'balance'],
  strategy: ['accuracy', 'power', 'consistency'],
};

export const SUB_STAT_LABELS: Record<SubStatKey, string> = {
  accuracy: 'Accuracy',
  power: 'Power',
  consistency: 'Consistency',
  speed: 'Speed',
  agility: 'Agility',
  balance: 'Balance',
};

export const SKILL_LABELS: Record<SkillKey, string> = {
  forehand: 'Forehand',
  backhand: 'Backhand',
  serve: 'Serve',
  volley: 'Volley',
  footwork: 'Footwork',
  strategy: 'Strategy',
};

/**
 * Order in which the radar chart plots values. Same as
 * `data/profile.ts:35` (`skillRadar.labels`).
 */
export const SKILL_DISPLAY_ORDER: SkillKey[] = [
  'forehand',
  'backhand',
  'serve',
  'volley',
  'footwork',
  'strategy',
];

export const USER_SKILL_POINTS_HEADERS = [
  'id',
  'userEmail',
  'activityId',
  'skill',
  'forehand',
  'backhand',
  'serve',
  'volley',
  'footwork',
  'strategy',
  'accuracy',
  'power',
  'consistency',
  'speed',
  'agility',
  'balance',
  'updatedAt',
  'updatedBy',
] as const;

export function isSkillKey(value: string): value is SkillKey {
  return (SKILL_KEYS as readonly string[]).includes(value);
}

export function isSubStatKey(value: string): value is SubStatKey {
  return (SUB_STAT_KEYS as readonly string[]).includes(value);
}

export function clampSkillValue(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 100) return 100;
  return Math.round(n);
}

export const EMPTY_SKILL_VALUES: SkillValues = {
  forehand: 0,
  backhand: 0,
  serve: 0,
  volley: 0,
  footwork: 0,
  strategy: 0,
};

export const EMPTY_SUB_STATS: SkillSubStats = {
  accuracy: 0,
  power: 0,
  consistency: 0,
  speed: 0,
  agility: 0,
  balance: 0,
};

export function buildRowId(
  userEmail: string,
  activityId: string,
  skill: SkillKey,
): string {
  const u = userEmail.trim().toLowerCase();
  const a = activityId.trim();
  return `${u}__${a}__${skill}`;
}
