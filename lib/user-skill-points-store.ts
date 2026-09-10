// ============================================
// USER SKILL POINTS STORE
// ============================================
// Per-(user, activity, skill) skill point values. One row per triple in
// the `user_skill_points` sheet. The profile radar sums a user's rows
// per skill and clamps to 0-100; the breakdown panel sums the per-skill
// sub-stat columns the same way. The admin activity page applies a batch
// of +/- deltas against a single activity across its approved members.
//
// Caching mirrors lib/activity-signups-store.ts: a 10s in-memory cache on
// globalThis so the profile page radar read doesn't hit the sheet on every
// render. Admin writes clear the cache so the next read reflects the change.

import {
  ensureSheetWithHeaders,
  getSpreadsheetId,
  listRowsBySheet,
  readRowById,
  createRowWithId,
  updateRowById,
} from '@/app/lib/supabase';
import {
  SKILL_KEYS,
  SKILL_SUB_STATS,
  SUB_STAT_KEYS,
  USER_SKILL_POINTS_HEADERS,
  buildRowId,
  clampSkillValue,
  isSkillKey,
  isSubStatKey,
  EMPTY_SKILL_VALUES,
  EMPTY_SUB_STATS,
  type SkillKey,
  type SkillValues,
  type SkillSubStats,
  type SubStatKey,
} from '@/data/user-skill-points-types';

const SHEET = 'user_skill_points';

const CACHE_TTL_MS = 10 * 1000;

type CacheEntry = { expiresAt: number; value: UserSkillPointRecord[] };

function getCacheStore() {
  const g = globalThis as unknown as {
    __user_skill_points_cache__?: Map<string, CacheEntry>;
  };
  if (!g.__user_skill_points_cache__) {
    g.__user_skill_points_cache__ = new Map();
  }
  return g.__user_skill_points_cache__;
}

function cacheClear() {
  getCacheStore().clear();
}

export type UserSkillPointRecord = {
  userEmail: string;
  activityId: string;
  skill: SkillKey;
  value: number;
  subStats: SkillSubStats;
  updatedAt?: string;
  updatedBy?: string;
};

function coerceInt(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return clampSkillValue(value);
  }
  const n = Number.parseInt(String(value ?? ''), 10);
  return clampSkillValue(Number.isFinite(n) ? n : 0);
}

function coerceRow(r: Record<string, unknown>): UserSkillPointRecord | null {
  const email = String(r.userEmail ?? '').trim().toLowerCase();
  const activityId = String(r.activityId ?? '').trim();
  const skillRaw = String(r.skill ?? '').trim();
  if (!email || !activityId || !isSkillKey(skillRaw)) return null;

  const value = coerceInt(r[skillRaw]);
  const subStats: SkillSubStats = { ...EMPTY_SUB_STATS };
  for (const key of SUB_STAT_KEYS) {
    subStats[key] = coerceInt(r[key]);
  }

  return {
    userEmail: email,
    activityId,
    skill: skillRaw,
    value,
    subStats,
    updatedAt: r.updatedAt ? String(r.updatedAt) : undefined,
    updatedBy: r.updatedBy ? String(r.updatedBy) : undefined,
  };
}

export async function ensureUserSkillPointsSheet(spreadsheetId: string) {
  return ensureSheetWithHeaders(
    spreadsheetId,
    SHEET,
    [...USER_SKILL_POINTS_HEADERS],
  );
}

export async function listAllUserSkillPoints(): Promise<UserSkillPointRecord[]> {
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) return [];
  try {
    await ensureUserSkillPointsSheet(spreadsheetId);
    const rows = await listRowsBySheet(spreadsheetId, SHEET);
    return rows
      .map(coerceRow)
      .filter((r): r is UserSkillPointRecord => r !== null);
  } catch (error) {
    console.error('Failed to list user skill points:', error);
    return [];
  }
}

export type SkillPointsTotal = {
  values: SkillValues;
  subStats: Record<SkillKey, SkillSubStats>;
  activityCount: number;
};

export async function getSkillPointsForUser(
  email: string,
): Promise<SkillPointsTotal | null> {
  const all = await listAllUserSkillPoints();
  const lower = email.trim().toLowerCase();
  const mine = all.filter((r) => r.userEmail === lower);
  if (mine.length === 0) return null;

  // Average across activities per skill. Each skill uses its own
  // denominator (skills that don't appear in any row stay at 0).
  const valueSums: SkillValues = { ...EMPTY_SKILL_VALUES };
  const valueCounts: SkillValues = { ...EMPTY_SKILL_VALUES };
  const subStatSums: Record<SkillKey, SkillSubStats> = {
    forehand: { ...EMPTY_SUB_STATS },
    backhand: { ...EMPTY_SUB_STATS },
    serve: { ...EMPTY_SUB_STATS },
    volley: { ...EMPTY_SUB_STATS },
    footwork: { ...EMPTY_SUB_STATS },
    strategy: { ...EMPTY_SUB_STATS },
  };
  const subStatCounts: Record<SkillKey, SkillSubStats> = {
    forehand: { ...EMPTY_SUB_STATS },
    backhand: { ...EMPTY_SUB_STATS },
    serve: { ...EMPTY_SUB_STATS },
    volley: { ...EMPTY_SUB_STATS },
    footwork: { ...EMPTY_SUB_STATS },
    strategy: { ...EMPTY_SUB_STATS },
  };

  for (const r of mine) {
    valueSums[r.skill] += r.value;
    valueCounts[r.skill] += 1;
    for (const key of SUB_STAT_KEYS) {
      // Only count sub-stats that belong to this skill; sub-stats from
      // other skill rows are 0 and irrelevant for the average.
      if (SKILL_SUB_STATS[r.skill].includes(key)) {
        subStatSums[r.skill][key] += r.subStats[key];
        subStatCounts[r.skill][key] += 1;
      }
    }
  }

  const values: SkillValues = { ...EMPTY_SKILL_VALUES };
  const subStats: Record<SkillKey, SkillSubStats> = {
    forehand: { ...EMPTY_SUB_STATS },
    backhand: { ...EMPTY_SUB_STATS },
    serve: { ...EMPTY_SUB_STATS },
    volley: { ...EMPTY_SUB_STATS },
    footwork: { ...EMPTY_SUB_STATS },
    strategy: { ...EMPTY_SUB_STATS },
  };
  for (const skill of SKILL_KEYS) {
    if (valueCounts[skill] > 0) {
      values[skill] = clampSkillValue(valueSums[skill] / valueCounts[skill]);
    }
    for (const key of SKILL_SUB_STATS[skill]) {
      const c = subStatCounts[skill][key];
      if (c > 0) {
        subStats[skill][key] = clampSkillValue(subStatSums[skill][key] / c);
      }
    }
  }

  return { values, subStats, activityCount: mine.length };
}

export type UserActivitySkillPoints = {
  activityId: string;
  values: SkillValues;
  subStats: SkillSubStats;
  updatedAt: string | null;
};

/**
 * Aggregate the user's per-(user, activity, skill) rows into one record
 * per activity. Used by the profile "Joined Activities" card so each
 * card can show its own radar-axis totals + sub-stat totals.
 */
export async function getSkillPointsForUserByActivity(
  email: string,
): Promise<UserActivitySkillPoints[]> {
  const all = await listAllUserSkillPoints();
  const lower = email.trim().toLowerCase();
  const mine = all.filter((r) => r.userEmail === lower);
  if (mine.length === 0) return [];

  const byActivity = new Map<
    string,
    { values: SkillValues; subStats: SkillSubStats; updatedAt: string | null }
  >();
  for (const r of mine) {
    const existing =
      byActivity.get(r.activityId) ??
      {
        values: { ...EMPTY_SKILL_VALUES },
        subStats: { ...EMPTY_SUB_STATS },
        updatedAt: null as string | null,
      };
    existing.values[r.skill] = clampSkillValue(existing.values[r.skill] + r.value);
    for (const key of SUB_STAT_KEYS) {
      existing.subStats[key] = clampSkillValue(
        existing.subStats[key] + r.subStats[key],
      );
    }
    if (r.updatedAt) {
      if (!existing.updatedAt || r.updatedAt > existing.updatedAt) {
        existing.updatedAt = r.updatedAt;
      }
    }
    byActivity.set(r.activityId, existing);
  }
  return Array.from(byActivity.entries()).map(([activityId, agg]) => ({
    activityId,
    values: agg.values,
    subStats: agg.subStats,
    updatedAt: agg.updatedAt,
  }));
}

export type MemberSkillPoints = {
  userEmail: string;
  /** One record per skill; missing skill = no row yet. */
  rows: Record<SkillKey, UserSkillPointRecord | null>;
};

export async function getSkillPointsForActivity(
  activityId: string,
  memberEmails: string[],
): Promise<MemberSkillPoints[]> {
  const all = await listAllUserSkillPoints();
  const target = activityId.trim();
  const wanted = new Set(memberEmails.map((e) => e.trim().toLowerCase()));
  const byEmailSkill = new Map<string, UserSkillPointRecord>();
  for (const r of all) {
    if (r.activityId !== target) continue;
    if (!wanted.has(r.userEmail)) continue;
    byEmailSkill.set(`${r.userEmail}__${r.skill}`, r);
  }
  return Array.from(wanted).map((email) => {
    const rows = {} as Record<SkillKey, UserSkillPointRecord | null>;
    for (const skill of SKILL_KEYS) {
      rows[skill] = byEmailSkill.get(`${email}__${skill}`) ?? null;
    }
    return { userEmail: email, rows };
  });
}

// Delta payload shape from the admin UI:
// { email: { skill: { main?: number, accuracy?: number, ... } } }
export type ActivitySkillDeltaInput = Record<
  string,
  Partial<Record<SkillKey, { main?: number } & Partial<Record<SubStatKey, number>>>>
>;

function isSkillDeltaObject(
  raw: unknown,
): raw is { main?: number } & Partial<Record<SubStatKey, number>> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
  return true;
}

function sanitiseDeltas(
  input: unknown,
): { ok: true; deltas: ActivitySkillDeltaInput } | { ok: false; error: string } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'deltas must be an object keyed by userEmail' };
  }
  const out: ActivitySkillDeltaInput = {};
  for (const [email, rawSkills] of Object.entries(input as Record<string, unknown>)) {
    if (typeof email !== 'string' || !email.trim()) {
      return { ok: false, error: 'userEmail keys must be non-empty strings' };
    }
    if (!rawSkills || typeof rawSkills !== 'object' || Array.isArray(rawSkills)) {
      return { ok: false, error: `deltas for ${email} must be an object` };
    }
    const perSkill: ActivitySkillDeltaInput[string] = {};
    for (const [skillRaw, rawDelta] of Object.entries(rawSkills as Record<string, unknown>)) {
      if (!isSkillKey(skillRaw)) {
        return { ok: false, error: `unknown skill: ${skillRaw}` };
      }
      if (!isSkillDeltaObject(rawDelta)) {
        return { ok: false, error: `deltas for ${email}.${skillRaw} must be an object` };
      }
      const cleaned: { main?: number } & Partial<Record<SubStatKey, number>> = {};
      const main = rawDelta.main;
      if (typeof main === 'number' && main !== 0) {
        if (!Number.isFinite(main)) {
          return { ok: false, error: `delta for ${email}.${skillRaw}.main must be finite` };
        }
        if (main < -100 || main > 100) {
          return {
            ok: false,
            error: `delta for ${email}.${skillRaw}.main must be between -100 and 100`,
          };
        }
        cleaned.main = Math.round(main);
      }
      for (const subKey of SKILL_SUB_STATS[skillRaw]) {
        const v = rawDelta[subKey];
        if (typeof v !== 'number' || v === 0) continue;
        if (!Number.isFinite(v)) {
          return {
            ok: false,
            error: `delta for ${email}.${skillRaw}.${subKey} must be finite`,
          };
        }
        if (v < -100 || v > 100) {
          return {
            ok: false,
            error: `delta for ${email}.${skillRaw}.${subKey} must be between -100 and 100`,
          };
        }
        cleaned[subKey] = Math.round(v);
      }
      if (cleaned.main !== undefined || Object.keys(cleaned).length > 0) {
        perSkill[skillRaw] = cleaned;
      }
    }
    if (Object.keys(perSkill).length > 0) {
      out[email.trim().toLowerCase()] = perSkill;
    }
  }
  return { ok: true, deltas: out };
}

export type ApplySummary = {
  activityId: string;
  updated: number;
  records: UserSkillPointRecord[];
};

/**
 * Apply a batch of +/- deltas for a single activity across N users. For
 * each (user, skill) combination that has any change, a row is created
 * on first write; subsequent writes update the row. Each row's payload
 * populates its single skill axis plus the per-skill sub-stat columns.
 */
export async function applyActivitySkillPointDeltas(
  activityId: string,
  rawDeltas: unknown,
  adminEmail: string,
): Promise<ApplySummary> {
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) throw new Error('No spreadsheet configured');
  const parsed = sanitiseDeltas(rawDeltas);
  if (!parsed.ok) throw new Error(parsed.error);
  if (Object.keys(parsed.deltas).length === 0) {
    throw new Error('deltas must include at least one user');
  }

  const target = activityId.trim();
  if (!target) throw new Error('activityId is required');

  await ensureUserSkillPointsSheet(spreadsheetId);

  const updatedAt = new Date().toISOString();
  const records: UserSkillPointRecord[] = [];

  for (const [email, perSkill] of Object.entries(parsed.deltas)) {
    for (const skill of SKILL_KEYS) {
      const skillDelta = perSkill[skill];
      if (!skillDelta) continue;
      const hasMain = typeof skillDelta.main === 'number' && skillDelta.main !== 0;
      const subKeys = SKILL_SUB_STATS[skill];
      const subDelta: Partial<Record<SubStatKey, number>> = {};
      for (const k of subKeys) {
        const v = skillDelta[k];
        if (typeof v === 'number' && v !== 0) subDelta[k] = v;
      }
      if (!hasMain && Object.keys(subDelta).length === 0) continue;

      const id = buildRowId(email, target, skill);
      const existing = await readRowById(spreadsheetId, SHEET, id);

      const nextValue = hasMain
        ? clampSkillValue(coerceInt(existing?.[skill]) + skillDelta.main!)
        : coerceInt(existing?.[skill]);

      const nextSubStats: SkillSubStats = { ...EMPTY_SUB_STATS };
      for (const key of subKeys) {
        const base = coerceInt(existing?.[key]);
        const delta = subDelta[key] ?? 0;
        nextSubStats[key] = clampSkillValue(base + delta);
      }
      // For sub-stats that aren't on this skill, preserve the existing
      // value if any (they'll normally be 0 since this row's skill
      // never sets them, but defensive in case of manual edits).
      for (const key of SUB_STAT_KEYS) {
        if (nextSubStats[key] !== 0) continue;
        nextSubStats[key] = coerceInt(existing?.[key]);
      }

      const payload: Record<string, unknown> = {
        id,
        userEmail: email,
        activityId: target,
        skill,
        forehand: 0,
        backhand: 0,
        serve: 0,
        volley: 0,
        footwork: 0,
        strategy: 0,
        ...nextSubStats,
        updatedAt,
        updatedBy: adminEmail,
      };
      payload[skill] = nextValue;

      if (existing) {
        await updateRowById(spreadsheetId, SHEET, id, payload);
      } else {
        await createRowWithId(spreadsheetId, SHEET, payload);
      }

      records.push({
        userEmail: email,
        activityId: target,
        skill,
        value: nextValue,
        subStats: nextSubStats,
        updatedAt,
        updatedBy: adminEmail,
      });
    }
  }

  cacheClear();
  return { activityId: target, updated: records.length, records };
}

export { sanitiseDeltas };
