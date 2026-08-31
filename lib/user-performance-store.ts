// ============================================
// USER PERFORMANCE POINTS STORE
// ============================================
// Per-(user, activity, skill) target/kesalahan values. One row per triple
// in the `user_performance_points` sheet. The profile chart averages the
// user's rows per skill across activities; the admin activity page
// applies a batch of +/- deltas against a single activity.
//
// Caching mirrors lib/user-skill-points-store.ts: a 10s in-memory cache
// on globalThis so the profile chart read doesn't hit the sheet on every
// render. Admin writes clear the cache so the next read reflects the
// change.

import {
  ensureSheetWithHeaders,
  listRowsBySheet,
  readRowById,
  createRowWithId,
  updateRowById,
} from '@/app/lib/googleSheets';
import {
  PERF_KESALAHAN_KEYS,
  PERF_TARGET_KEYS,
  PERFORMANCE_DISPLAY_ORDER,
  PERFORMANCE_SKILL_KEYS,
  USER_PERFORMANCE_HEADERS,
  buildPerfRowId,
  clampPerfValue,
  isPerformanceSkillKey,
  type PerformanceSkillKey,
} from '@/data/user-performance-types';

const SHEET = 'user_performance_points';

const CACHE_TTL_MS = 10 * 1000;

type CacheEntry = { expiresAt: number; value: UserPerformanceRecord[] };

function getCacheStore() {
  const g = globalThis as unknown as {
    __user_performance_cache__?: Map<string, CacheEntry>;
  };
  if (!g.__user_performance_cache__) {
    g.__user_performance_cache__ = new Map();
  }
  return g.__user_performance_cache__;
}

function cacheClear() {
  getCacheStore().clear();
}

export type UserPerformanceRecord = {
  userEmail: string;
  activityId: string;
  skill: PerformanceSkillKey;
  target: number;
  kesalahan: number;
  updatedAt?: string;
  updatedBy?: string;
};

function getSpreadsheetId(): string | null {
  const id =
    process.env.USERS_SPREADSHEET_ID?.trim() ||
    process.env.HERO_SPREADSHEET_ID?.trim() ||
    null;
  return id && id.length > 0 ? id : null;
}

function coerceInt(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return clampPerfValue(value);
  }
  const n = Number.parseInt(String(value ?? ''), 10);
  return clampPerfValue(Number.isFinite(n) ? n : 0);
}

function coerceRow(r: Record<string, unknown>): UserPerformanceRecord | null {
  const email = String(r.userEmail ?? '').trim().toLowerCase();
  const activityId = String(r.activityId ?? '').trim();
  const skillRaw = String(r.skill ?? '').trim();
  if (!email || !activityId || !isPerformanceSkillKey(skillRaw)) return null;
  const targetKey = `${skillRaw}Target` as (typeof PERF_TARGET_KEYS)[number];
  const kesalahanKey = `${skillRaw}Kesalahan` as (typeof PERF_KESALAHAN_KEYS)[number];
  return {
    userEmail: email,
    activityId,
    skill: skillRaw,
    target: coerceInt(r[targetKey]),
    kesalahan: coerceInt(r[kesalahanKey]),
    updatedAt: r.updatedAt ? String(r.updatedAt) : undefined,
    updatedBy: r.updatedBy ? String(r.updatedBy) : undefined,
  };
}

export async function ensureUserPerformanceSheet(spreadsheetId: string) {
  return ensureSheetWithHeaders(
    spreadsheetId,
    SHEET,
    [...USER_PERFORMANCE_HEADERS],
  );
}

export async function listAllUserPerformance(): Promise<UserPerformanceRecord[]> {
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) return [];
  try {
    await ensureUserPerformanceSheet(spreadsheetId);
    const rows = await listRowsBySheet(spreadsheetId, SHEET);
    return rows
      .map(coerceRow)
      .filter((r): r is UserPerformanceRecord => r !== null);
  } catch (error) {
    console.error('Failed to list user performance:', error);
    return [];
  }
}

export type PerformanceAggregated = {
  labels: PerformanceSkillKey[];
  target: number[];
  kesalahan: number[];
  activityCount: number;
};

/**
 * Aggregate the signed-in user's per-(user, activity, skill) rows into
 * per-skill averages across activities. Per-skill denominator; skills
 * the user has no rows for stay at 0.
 */
export async function getPerformanceForUser(
  email: string,
): Promise<PerformanceAggregated | null> {
  const all = await listAllUserPerformance();
  const lower = email.trim().toLowerCase();
  const mine = all.filter((r) => r.userEmail === lower);
  if (mine.length === 0) return null;

  const targetSums: Record<PerformanceSkillKey, number> = {
    forehand: 0,
    backhand: 0,
    serve: 0,
    volley: 0,
    footwork: 0,
  };
  const kesalahanSums: Record<PerformanceSkillKey, number> = {
    forehand: 0,
    backhand: 0,
    serve: 0,
    volley: 0,
    footwork: 0,
  };
  const counts: Record<PerformanceSkillKey, number> = {
    forehand: 0,
    backhand: 0,
    serve: 0,
    volley: 0,
    footwork: 0,
  };
  for (const r of mine) {
    targetSums[r.skill] += r.target;
    kesalahanSums[r.skill] += r.kesalahan;
    counts[r.skill] += 1;
  }

  const target = PERFORMANCE_DISPLAY_ORDER.map((s) =>
    counts[s] > 0 ? clampPerfValue(targetSums[s] / counts[s]) : 0,
  );
  const kesalahan = PERFORMANCE_DISPLAY_ORDER.map((s) =>
    counts[s] > 0 ? clampPerfValue(kesalahanSums[s] / counts[s]) : 0,
  );

  return {
    labels: [...PERFORMANCE_DISPLAY_ORDER],
    target,
    kesalahan,
    activityCount: mine.length,
  };
}

export type MemberPerformance = {
  userEmail: string;
  /** One record per skill; missing skill = no row yet. */
  rows: Record<PerformanceSkillKey, UserPerformanceRecord | null>;
};

export async function getPerformanceForActivity(
  activityId: string,
  memberEmails: string[],
): Promise<MemberPerformance[]> {
  const all = await listAllUserPerformance();
  const target = activityId.trim();
  const wanted = new Set(memberEmails.map((e) => e.trim().toLowerCase()));
  const byEmailSkill = new Map<string, UserPerformanceRecord>();
  for (const r of all) {
    if (r.activityId !== target) continue;
    if (!wanted.has(r.userEmail)) continue;
    byEmailSkill.set(`${r.userEmail}__${r.skill}`, r);
  }
  return Array.from(wanted).map((email) => {
    const rows = {} as Record<PerformanceSkillKey, UserPerformanceRecord | null>;
    for (const skill of PERFORMANCE_SKILL_KEYS) {
      rows[skill] = byEmailSkill.get(`${email}__${skill}`) ?? null;
    }
    return { userEmail: email, rows };
  });
}

// Delta payload shape from the admin UI:
// { email: { skill: { target?: number, kesalahan?: number } } }
export type ActivityPerformanceDeltaInput = Record<
  string,
  Partial<
    Record<
      PerformanceSkillKey,
      { target?: number; kesalahan?: number }
    >
  >
>;

function sanitiseDeltas(
  input: unknown,
): { ok: true; deltas: ActivityPerformanceDeltaInput } | { ok: false; error: string } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'deltas must be an object keyed by userEmail' };
  }
  const out: ActivityPerformanceDeltaInput = {};
  for (const [email, rawSkills] of Object.entries(input as Record<string, unknown>)) {
    if (typeof email !== 'string' || !email.trim()) {
      return { ok: false, error: 'userEmail keys must be non-empty strings' };
    }
    if (!rawSkills || typeof rawSkills !== 'object' || Array.isArray(rawSkills)) {
      return { ok: false, error: `deltas for ${email} must be an object` };
    }
    const perSkill: ActivityPerformanceDeltaInput[string] = {};
    for (const [skillRaw, rawDelta] of Object.entries(rawSkills as Record<string, unknown>)) {
      if (!isPerformanceSkillKey(skillRaw)) {
        return { ok: false, error: `unknown skill: ${skillRaw}` };
      }
      if (!rawDelta || typeof rawDelta !== 'object' || Array.isArray(rawDelta)) {
        return { ok: false, error: `deltas for ${email}.${skillRaw} must be an object` };
      }
      const cleaned: { target?: number; kesalahan?: number } = {};
      const t = (rawDelta as { target?: unknown }).target;
      const k = (rawDelta as { kesalahan?: unknown }).kesalahan;
      if (typeof t === 'number' && t !== 0) {
        if (!Number.isFinite(t)) {
          return { ok: false, error: `delta for ${email}.${skillRaw}.target must be finite` };
        }
        if (t < -100 || t > 100) {
          return {
            ok: false,
            error: `delta for ${email}.${skillRaw}.target must be between -100 and 100`,
          };
        }
        cleaned.target = Math.round(t);
      }
      if (typeof k === 'number' && k !== 0) {
        if (!Number.isFinite(k)) {
          return {
            ok: false,
            error: `delta for ${email}.${skillRaw}.kesalahan must be finite`,
          };
        }
        if (k < -100 || k > 100) {
          return {
            ok: false,
            error: `delta for ${email}.${skillRaw}.kesalahan must be between -100 and 100`,
          };
        }
        cleaned.kesalahan = Math.round(k);
      }
      if (cleaned.target !== undefined || cleaned.kesalahan !== undefined) {
        perSkill[skillRaw] = cleaned;
      }
    }
    if (Object.keys(perSkill).length > 0) {
      out[email.trim().toLowerCase()] = perSkill;
    }
  }
  return { ok: true, deltas: out };
}

export type ApplyPerformanceSummary = {
  activityId: string;
  updated: number;
  records: UserPerformanceRecord[];
};

/**
 * Apply a batch of +/- deltas for a single activity across N users. For
 * each (user, skill) combination that has any change, a row is created
 * on first write; subsequent writes update the row. Each row's payload
 * populates its single skill's target + kesalahan columns.
 */
export async function applyActivityPerformanceDeltas(
  activityId: string,
  rawDeltas: unknown,
  adminEmail: string,
): Promise<ApplyPerformanceSummary> {
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) throw new Error('No spreadsheet configured');
  const parsed = sanitiseDeltas(rawDeltas);
  if (!parsed.ok) throw new Error(parsed.error);
  if (Object.keys(parsed.deltas).length === 0) {
    throw new Error('deltas must include at least one user');
  }

  const target = activityId.trim();
  if (!target) throw new Error('activityId is required');

  await ensureUserPerformanceSheet(spreadsheetId);

  const updatedAt = new Date().toISOString();
  const records: UserPerformanceRecord[] = [];

  for (const [email, perSkill] of Object.entries(parsed.deltas)) {
    for (const skill of PERFORMANCE_SKILL_KEYS) {
      const skillDelta = perSkill[skill];
      if (!skillDelta) continue;
      const hasTarget =
        typeof skillDelta.target === 'number' && skillDelta.target !== 0;
      const hasKesalahan =
        typeof skillDelta.kesalahan === 'number' && skillDelta.kesalahan !== 0;
      if (!hasTarget && !hasKesalahan) continue;

      const id = buildPerfRowId(email, target, skill);
      const existing = await readRowById(spreadsheetId, SHEET, id);

      const targetKey = `${skill}Target` as (typeof PERF_TARGET_KEYS)[number];
      const kesalahanKey =
        `${skill}Kesalahan` as (typeof PERF_KESALAHAN_KEYS)[number];

      const nextTarget = hasTarget
        ? clampPerfValue(coerceInt(existing?.[targetKey]) + skillDelta.target!)
        : coerceInt(existing?.[targetKey]);
      const nextKesalahan = hasKesalahan
        ? clampPerfValue(coerceInt(existing?.[kesalahanKey]) + skillDelta.kesalahan!)
        : coerceInt(existing?.[kesalahanKey]);

      const payload: Record<string, unknown> = {
        id,
        userEmail: email,
        activityId: target,
        skill,
        updatedAt,
        updatedBy: adminEmail,
      };
      // Zero out all target/kesalahan columns first, then fill this row's.
      for (const k of PERF_TARGET_KEYS) payload[k] = 0;
      for (const k of PERF_KESALAHAN_KEYS) payload[k] = 0;
      payload[targetKey] = nextTarget;
      payload[kesalahanKey] = nextKesalahan;

      if (existing) {
        await updateRowById(spreadsheetId, SHEET, id, payload);
      } else {
        await createRowWithId(spreadsheetId, SHEET, payload);
      }

      records.push({
        userEmail: email,
        activityId: target,
        skill,
        target: nextTarget,
        kesalahan: nextKesalahan,
        updatedAt,
        updatedBy: adminEmail,
      });
    }
  }

  cacheClear();
  return { activityId: target, updated: records.length, records };
}

export { sanitiseDeltas };
