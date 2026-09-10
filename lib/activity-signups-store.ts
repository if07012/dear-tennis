// ============================================
// ACTIVITY SIGNUPS STORE
// ============================================
// Reads/writes activity_signups rows from Supabase (single data layer — see
// app/lib/supabase.ts).
//
// Caching: this sheet is read by the public home page on every render so we
// follow the activities/gallery pattern and cache the per-user lookup for a
// few seconds. Admin reads bypass the cache because they need to see fresh
// approvals the moment they're applied.

import {
  ensureSheetWithHeaders,
  getSpreadsheetId,
  listRowsBySheet,
  readRowById,
  updateRowById,
  deleteRowById,
  createRowWithId,
} from '@/app/lib/supabase';
import {
  SIGNUP_HEADERS,
  isSignupStatus,
  type ActivitySignup,
  type SignupStatus,
} from '@/data/activity-signups-types';

const SHEET = 'activity_signups';

const SIGNUP_CACHE_TTL_MS = 10 * 1000;

type CacheEntry = { expiresAt: number; value: ActivitySignup[] };

function getCacheStore() {
  const g = globalThis as unknown as {
    __activity_signups_cache__?: Map<string, CacheEntry>;
  };
  if (!g.__activity_signups_cache__) {
    g.__activity_signups_cache__ = new Map();
  }
  return g.__activity_signups_cache__;
}

function cacheGet(key: string): ActivitySignup[] | null {
  const hit = getCacheStore().get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    getCacheStore().delete(key);
    return null;
  }
  return hit.value;
}

function cacheSet(key: string, value: ActivitySignup[]) {
  getCacheStore().set(key, {
    expiresAt: Date.now() + SIGNUP_CACHE_TTL_MS,
    value,
  });
}

function cacheClear() {
  getCacheStore().clear();
}

function coerceStatus(value: unknown): SignupStatus {
  return isSignupStatus(String(value ?? '')) ? (String(value) as SignupStatus) : 'pending';
}

function coerceRow(r: Record<string, unknown>, idx: number): ActivitySignup {
  return {
    id: String(r.id ?? '').trim() || `fallback-${idx}`,
    activityId: String(r.activityId ?? '').trim(),
    userEmail: String(r.userEmail ?? '').trim().toLowerCase(),
    userName: String(r.userName ?? '').trim(),
    status: coerceStatus(r.status),
    message: r.message ? String(r.message) : undefined,
    requestedAt: String(r.requestedAt ?? ''),
    decidedAt: r.decidedAt ? String(r.decidedAt) : undefined,
    decidedBy: r.decidedBy ? String(r.decidedBy) : undefined,
  };
}

async function fetchAllRows(spreadsheetId: string): Promise<ActivitySignup[]> {
  const rows = await listRowsBySheet(spreadsheetId, SHEET);
  return rows
    .filter((r) => String(r.userEmail ?? '').trim().length > 0)
    .map((r, idx) => coerceRow(r, idx))
    .sort((a, b) => {
      const aTime = Date.parse(a.requestedAt) || 0;
      const bTime = Date.parse(b.requestedAt) || 0;
      return bTime - aTime;
    });
}

export async function ensureSignupsSheet(spreadsheetId: string) {
  return ensureSheetWithHeaders(spreadsheetId, SHEET, [...SIGNUP_HEADERS]);
}

/**
 * Find an existing signup row for (userEmail, activityId). Returns the row
 * including its id so the caller can update or read status.
 */
export async function findSignup(
  spreadsheetId: string,
  activityId: string,
  userEmail: string,
): Promise<ActivitySignup | null> {
  const lower = userEmail.trim().toLowerCase();
  const cacheKey = `all:${spreadsheetId}`;
  const cached = cacheGet(cacheKey);
  if (cached) {
    return (
      cached.find(
        (s) => s.activityId === activityId && s.userEmail === lower,
      ) ?? null
    );
  }
  const rows = await fetchAllRows(spreadsheetId);
  cacheSet(cacheKey, rows);
  return (
    rows.find((s) => s.activityId === activityId && s.userEmail === lower) ??
    null
  );
}

export type SignupRequestInput = {
  activityId: string;
  userEmail: string;
  userName: string;
  message?: string;
};

export async function requestSignup(
  spreadsheetId: string,
  input: SignupRequestInput,
): Promise<{ signup: ActivitySignup; created: boolean }> {
  await ensureSignupsSheet(spreadsheetId);
  const existing = await findSignup(
    spreadsheetId,
    input.activityId,
    input.userEmail,
  );
  if (existing) {
    // A previously rejected signup is treated as a fresh re-submission:
    // flip the status back to pending, clear the prior decision metadata,
    // and bump requestedAt so the admin queue + sort order pick it up. The
    // row id stays the same so we don't end up with duplicate signups.
    if (existing.status === 'rejected') {
      const requestedAt = new Date().toISOString();
      await updateRowById(spreadsheetId, SHEET, existing.id, {
        status: 'pending',
        requestedAt,
        decidedAt: '',
        decidedBy: '',
        userName: input.userName,
        message: input.message ?? '',
      });
      cacheClear();
      const refreshed = await findSignup(
        spreadsheetId,
        input.activityId,
        input.userEmail,
      );
      return {
        signup:
          refreshed ??
          {
            ...existing,
            status: 'pending',
            requestedAt,
            decidedAt: undefined,
            decidedBy: undefined,
            userName: input.userName,
            message: input.message,
          },
        created: false,
      };
    }
    // Refresh userName/message in case the user edited their profile.
    if (
      existing.userName !== input.userName ||
      (input.message ?? '') !== (existing.message ?? '')
    ) {
      await updateRowById(spreadsheetId, SHEET, existing.id, {
        userName: input.userName,
        message: input.message ?? '',
      });
      cacheClear();
      const refreshed = await findSignup(
        spreadsheetId,
        input.activityId,
        input.userEmail,
      );
      return {
        signup: refreshed ?? { ...existing, userName: input.userName, message: input.message },
        created: false,
      };
    }
    return { signup: existing, created: false };
  }

  const id = crypto.randomUUID();
  const row: ActivitySignup = {
    id,
    activityId: input.activityId,
    userEmail: input.userEmail.trim().toLowerCase(),
    userName: input.userName,
    status: 'pending',
    message: input.message,
    requestedAt: new Date().toISOString(),
  };
  await createRowWithId(spreadsheetId, SHEET, row);
  cacheClear();
  return { signup: row, created: true };
}

export async function decideSignup(
  spreadsheetId: string,
  id: string,
  status: SignupStatus,
  decidedBy: string,
): Promise<ActivitySignup | null> {
  await ensureSignupsSheet(spreadsheetId);
  const row = await readRowById(spreadsheetId, SHEET, id);
  if (!row) return null;
  await updateRowById(spreadsheetId, SHEET, id, {
    status,
    decidedAt: new Date().toISOString(),
    decidedBy,
  });
  cacheClear();
  const updated = await readRowById(spreadsheetId, SHEET, id);
  if (!updated) return null;
  return coerceRow(updated, 0);
}

export async function removeSignup(
  spreadsheetId: string,
  id: string,
): Promise<boolean> {
  await ensureSignupsSheet(spreadsheetId);
  const row = await readRowById(spreadsheetId, SHEET, id);
  if (!row) return false;
  await deleteRowById(spreadsheetId, SHEET, id);
  cacheClear();
  return true;
}

export type PagedSignups = {
  items: ActivitySignup[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

function normalizeArgs(args?: { page?: number; pageSize?: number; status?: SignupStatus | 'all' }) {
  const pageSize = Math.max(
    1,
    Math.min(100, Math.floor(args?.pageSize ?? 10) || 10),
  );
  const page = Math.max(1, Math.floor(args?.page ?? 1) || 1);
  return { page, pageSize, offset: (page - 1) * pageSize };
}

export async function listSignupsForAdmin(args?: {
  page?: number;
  pageSize?: number;
  status?: SignupStatus | 'all';
  activityId?: string;
}): Promise<PagedSignups> {
  const { page, pageSize, offset } = normalizeArgs(args);
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) {
    return { items: [], total: 0, page, pageSize, totalPages: 1 };
  }

  try {
    await ensureSignupsSheet(spreadsheetId);
    const rows = await fetchAllRows(spreadsheetId);
    let filtered = rows;
    if (args?.status && args.status !== 'all') {
      filtered = filtered.filter((r) => r.status === args.status);
    }
    if (args?.activityId) {
      filtered = filtered.filter((r) => r.activityId === args.activityId);
    }
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    return {
      items: filtered.slice(offset, offset + pageSize),
      total,
      page,
      pageSize,
      totalPages,
    };
  } catch (error) {
    console.error('Failed to list activity signups:', error);
    return { items: [], total: 0, page, pageSize, totalPages: 1 };
  }
}

export async function getActivityTitles(
  spreadsheetId: string,
): Promise<Map<string, string>> {
  try {
    const rows = await listRowsBySheet(spreadsheetId, 'activities_items');
    const map = new Map<string, string>();
    for (const row of rows) {
      const id = String(row.id ?? '').trim();
      const title = String(row.title ?? '').trim();
      if (id && title) map.set(id, title);
    }
    return map;
  } catch {
    return new Map();
  }
}

/**
 * Count approved signups per activityId. Uses the same 10s cache as the
 * public signup lookup so the home page and admin list share a single read.
 * Returns an empty map if the sheet can't be read (e.g. missing env var).
 */
export async function getSignupCountsByActivity(): Promise<Map<string, number>> {
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) return new Map();
  try {
    const rows = await fetchAllRows(spreadsheetId);
    const counts = new Map<string, number>();
    for (const row of rows) {
      if (row.status !== 'approved') continue;
      counts.set(row.activityId, (counts.get(row.activityId) ?? 0) + 1);
    }
    return counts;
  } catch (error) {
    console.error('Failed to count activity signups:', error);
    return new Map();
  }
}

export type ActivityMember = {
  email: string;
  name: string;
  photo?: string;
  joinedAt: string;
};

/**
 * Returns the approved members of a single activity, joined with the
 * matching user record (name + optional photo) so the home page can
 * render a member popup. Falls back to the signup row's stored userName
 * if the user has been deleted from the users sheet since the signup.
 */
export async function getActivityMembers(
  activityId: string,
): Promise<ActivityMember[]> {
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) return [];
  try {
    const [rows, { listAllUsersForAdmin }] = await Promise.all([
      fetchAllRows(spreadsheetId),
      import('@/lib/users-store').then((m) => ({ listAllUsersForAdmin: m.listAllUsersForAdmin })),
    ]);
    const users = await listAllUsersForAdmin();
    const userByEmail = new Map(users.map((u) => [u.email.toLowerCase(), u]));
    return rows
      .filter((r) => r.activityId === activityId && r.status === 'approved')
      .map<ActivityMember>((r) => {
        const u = userByEmail.get(r.userEmail);
        return {
          email: r.userEmail,
          name: u?.name || r.userName || r.userEmail,
          photo: u?.photo,
          joinedAt: r.decidedAt || r.requestedAt,
        };
      })
      .sort((a, b) => (b.joinedAt || '').localeCompare(a.joinedAt || ''));
  } catch (error) {
    console.error('Failed to load activity members:', error);
    return [];
  }
}

export { SHEET };
