// ============================================
// ACHIEVEMENTS STORE
// ============================================
// Admin-curated badge catalog + per-user grants. Persists in two Supabase
// tables: `badges` (catalog) and `user_badges` (grants).
//
// Caching mirrors lib/user-skill-points-store.ts: a 10s in-memory cache on
// globalThis keyed by sheet so the profile page doesn't hit Sheets on every
// render. Admin writes clear the cache so the next read reflects the change.

import {
  ensureSheetWithHeaders,
  getSpreadsheetId,
  listRowsBySheet,
  createRowWithId,
  updateRowById,
  deleteRowById,
} from '@/app/lib/supabase';
import crypto from 'crypto';
import {
  BADGE_HEADERS,
  USER_BADGE_HEADERS,
  type BadgeCatalogRecord,
  type BadgeGrantRecord,
  type GrantedBadge,
} from '@/data/achievements-types';

const BADGES_SHEET = 'badges';
const USER_BADGES_SHEET = 'user_badges';

const CACHE_TTL_MS = 10 * 1000;

type CacheEntry<T> = { expiresAt: number; value: T };

function getCacheStore() {
  const g = globalThis as unknown as {
    __achievements_cache__?: Map<string, CacheEntry<unknown>>;
  };
  if (!g.__achievements_cache__) {
    g.__achievements_cache__ = new Map();
  }
  return g.__achievements_cache__;
}

function cacheGet<T>(key: string): T | null {
  const entry = getCacheStore().get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    getCacheStore().delete(key);
    return null;
  }
  return entry.value as T;
}

function cacheSet<T>(key: string, value: T) {
  getCacheStore().set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value });
}

function cacheClear() {
  getCacheStore().clear();
}

function newId(): string {
  return crypto.randomBytes(8).toString('hex');
}

function coerceBool(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  const s = String(value ?? '').trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'yes';
}

function coerceBadgeRow(r: Record<string, unknown>): BadgeCatalogRecord | null {
  const key = String(r.key ?? '').trim().toLowerCase();
  const label = String(r.label ?? '').trim();
  if (!key || !label) return null;
  return {
    id: String(r.id ?? '').trim(),
    key,
    label,
    icon: String(r.icon ?? '🏅').trim() || '🏅',
    description: String(r.description ?? '').trim(),
    archived: coerceBool(r.archived),
    createdAt: String(r.createdAt ?? '').trim(),
  };
}

function coerceGrantRow(r: Record<string, unknown>): BadgeGrantRecord | null {
  const email = String(r.userEmail ?? '').trim().toLowerCase();
  const badgeKey = String(r.badgeKey ?? '').trim().toLowerCase();
  if (!email || !badgeKey) return null;
  return {
    id: String(r.id ?? '').trim(),
    userEmail: email,
    badgeKey,
    grantedAt: String(r.grantedAt ?? '').trim(),
    grantedBy: String(r.grantedBy ?? '').trim(),
    note: String(r.note ?? '').trim(),
  };
}

async function ensureSheets(spreadsheetId: string) {
  await ensureSheetWithHeaders(spreadsheetId, BADGES_SHEET, [...BADGE_HEADERS]);
  await ensureSheetWithHeaders(spreadsheetId, USER_BADGES_SHEET, [
    ...USER_BADGE_HEADERS,
  ]);
}

// ----------------------------------------------------------------
// Catalog
// ----------------------------------------------------------------

export async function listBadgeCatalog(): Promise<BadgeCatalogRecord[]> {
  const cacheKey = 'catalog';
  const hit = cacheGet<BadgeCatalogRecord[]>(cacheKey);
  if (hit) return hit;

  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) return [];
  try {
    await ensureSheets(spreadsheetId);
    const rows = await listRowsBySheet(spreadsheetId, BADGES_SHEET);
    const list2 = rows
      .map(coerceBadgeRow)
      .filter((r): r is BadgeCatalogRecord => r !== null);
    cacheSet(cacheKey, list2);
    return list2;
  } catch (error) {
    console.error('Failed to list badge catalog:', error);
    return [];
  }
}

export async function getBadgeByKey(
  key: string,
): Promise<BadgeCatalogRecord | null> {
  const all = await listBadgeCatalog();
  return all.find((b) => b.key === key.toLowerCase()) ?? null;
}

export async function upsertBadge(
  input: Omit<BadgeCatalogRecord, 'id' | 'createdAt' | 'archived'> & {
    archived?: boolean;
  },
): Promise<BadgeCatalogRecord> {
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) throw new Error('Spreadsheet ID not configured');
  await ensureSheets(spreadsheetId);

  const all = await listBadgeCatalog();
  const key = input.key.trim().toLowerCase();
  const existing = all.find((b) => b.key === key);
  const next: BadgeCatalogRecord = existing
    ? {
        ...existing,
        label: input.label.trim() || existing.label,
        icon: input.icon.trim() || existing.icon,
        description: input.description.trim(),
        archived: input.archived ?? existing.archived,
      }
    : {
        id: newId(),
        key,
        label: input.label.trim(),
        icon: input.icon.trim() || '🏅',
        description: input.description.trim(),
        archived: input.archived ?? false,
        createdAt: new Date().toISOString(),
      };

  const row = {
    id: next.id,
    key: next.key,
    label: next.label,
    icon: next.icon,
    description: next.description,
    archived: next.archived ? 'true' : 'false',
    createdAt: next.createdAt,
  };
  if (existing) {
    await updateRowById(spreadsheetId, BADGES_SHEET, existing.id, row);
  } else {
    await createRowWithId(spreadsheetId, BADGES_SHEET, row);
  }
  cacheClear();
  return next;
}

// ----------------------------------------------------------------
// Grants
// ----------------------------------------------------------------

export async function listAllGrants(): Promise<BadgeGrantRecord[]> {
  const cacheKey = 'grants';
  const hit = cacheGet<BadgeGrantRecord[]>(cacheKey);
  if (hit) return hit;

  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) return [];
  try {
    await ensureSheets(spreadsheetId);
    const rows = await listRowsBySheet(spreadsheetId, USER_BADGES_SHEET);
    const list2 = rows
      .map(coerceGrantRow)
      .filter((r): r is BadgeGrantRecord => r !== null);
    cacheSet(cacheKey, list2);
    return list2;
  } catch (error) {
    console.error('Failed to list badge grants:', error);
    return [];
  }
}

export async function listGrantedBadgesForUser(
  email: string,
): Promise<GrantedBadge[]> {
  const lower = email.trim().toLowerCase();
  const [grants, catalog] = await Promise.all([
    listAllGrants(),
    listBadgeCatalog(),
  ]);
  const byKey = new Map(catalog.map((b) => [b.key, b]));
  const out: GrantedBadge[] = [];
  for (const g of grants) {
    if (g.userEmail !== lower) continue;
    const badge = byKey.get(g.badgeKey);
    if (!badge || badge.archived) continue;
    out.push({
      ...badge,
      grantedAt: g.grantedAt,
      grantedBy: g.grantedBy,
      note: g.note,
    });
  }
  // Newest first.
  out.sort((a, b) => (a.grantedAt < b.grantedAt ? 1 : a.grantedAt > b.grantedAt ? -1 : 0));
  return out;
}

export async function countGrantedBadgesForUser(email: string): Promise<number> {
  const lower = email.trim().toLowerCase();
  const grants = await listAllGrants();
  return grants.filter((g) => g.userEmail === lower).length;
}

export async function grantBadge(input: {
  userEmail: string;
  badgeKey: string;
  grantedBy: string;
  note?: string;
}): Promise<BadgeGrantRecord> {
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) throw new Error('Spreadsheet ID not configured');
  await ensureSheets(spreadsheetId);

  const email = input.userEmail.trim().toLowerCase();
  const badgeKey = input.badgeKey.trim().toLowerCase();
  const existing = await listAllGrants();
  const dup = existing.find(
    (g) => g.userEmail === email && g.badgeKey === badgeKey,
  );
  if (dup) return dup;

  const record: BadgeGrantRecord = {
    id: newId(),
    userEmail: email,
    badgeKey,
    grantedAt: new Date().toISOString(),
    grantedBy: input.grantedBy.trim().toLowerCase(),
    note: (input.note ?? '').trim(),
  };
  await createRowWithId(spreadsheetId, USER_BADGES_SHEET, {
    id: record.id,
    userEmail: record.userEmail,
    badgeKey: record.badgeKey,
    grantedAt: record.grantedAt,
    grantedBy: record.grantedBy,
    note: record.note,
  });
  cacheClear();
  return record;
}

export async function revokeGrantByKey(input: {
  userEmail: string;
  badgeKey: string;
}): Promise<boolean> {
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) throw new Error('Spreadsheet ID not configured');
  const email = input.userEmail.trim().toLowerCase();
  const badgeKey = input.badgeKey.trim().toLowerCase();
  const grants = await listAllGrants();
  const target = grants.find(
    (g) => g.userEmail === email && g.badgeKey === badgeKey,
  );
  if (!target) return false;
  await deleteRowById(spreadsheetId, USER_BADGES_SHEET, target.id);
  cacheClear();
  return true;
}

export async function listGrantedKeysForUser(email: string): Promise<string[]> {
  const lower = email.trim().toLowerCase();
  const grants = await listAllGrants();
  return grants.filter((g) => g.userEmail === lower).map((g) => g.badgeKey);
}