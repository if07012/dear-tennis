// ============================================
// TENNIS LEVEL STORE
// ============================================
// Manages player levels, level-badge requirements, and computes player levels.

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
  LEVEL_HEADERS,
  LEVEL_BADGE_HEADERS,
  BADGE_HEADERS,
  USER_BADGE_HEADERS,
  type LevelRecord,
  type LevelBadgeRecord,
  type BadgeCatalogRecord,
  type BadgeGrantRecord,
  type GrantedBadge,
  type PlayerLevelResult,
} from '@/data/tennis-level-types';

const LEVELS_SHEET = 'levels';
const LEVEL_BADGES_SHEET = 'level_badges';
const BADGES_SHEET = 'badges';
const USER_BADGES_SHEET = 'user_badges';

const CACHE_TTL_MS = 10 * 1000;

type CacheEntry<T> = { expiresAt: number; value: T };

function getCacheStore() {
  const g = globalThis as unknown as {
    __tennis_level_cache__?: Map<string, CacheEntry<unknown>>;
  };
  if (!g.__tennis_level_cache__) {
    g.__tennis_level_cache__ = new Map();
  }
  return g.__tennis_level_cache__;
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

function coerceLevelRow(r: Record<string, unknown>): LevelRecord | null {
  const name = String(r.name ?? '').trim();
  if (!name) return null;
  return {
    id: String(r.id ?? '').trim(),
    name,
    description: String(r.description ?? '').trim(),
    order: Number(r.order ?? 0),
    isActive: coerceBool(r.isActive),
    createdAt: String(r.createdAt ?? '').trim(),
  };
}

function coerceLevelBadgeRow(r: Record<string, unknown>): LevelBadgeRecord | null {
  const levelId = String(r.levelId ?? '').trim();
  const badgeKey = String(r.badgeKey ?? '').trim().toLowerCase();
  if (!levelId || !badgeKey) return null;
  return {
    id: String(r.id ?? '').trim(),
    levelId,
    badgeKey,
  };
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
    type: (String(r.type ?? 'skill').trim().toLowerCase() as 'skill' | 'achievement') || 'skill',
    category: String(r.category ?? '').trim(),
    earningCriteria: String(r.earningCriteria ?? '').trim(),
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
    status: (String(r.status ?? 'active').trim().toLowerCase() as 'active' | 'revoked') || 'active',
    grantedAt: String(r.grantedAt ?? '').trim(),
    grantedBy: String(r.grantedBy ?? '').trim(),
    revokedAt: r.revokedAt ? String(r.revokedAt).trim() : null,
    revokedBy: r.revokedBy ? String(r.revokedBy).trim() : null,
    note: String(r.note ?? '').trim(),
  };
}

async function ensureLevelSheets(spreadsheetId: string) {
  await ensureSheetWithHeaders(spreadsheetId, LEVELS_SHEET, [...LEVEL_HEADERS]);
  await ensureSheetWithHeaders(spreadsheetId, LEVEL_BADGES_SHEET, [...LEVEL_BADGE_HEADERS]);
  await ensureSheetWithHeaders(spreadsheetId, BADGES_SHEET, [...BADGE_HEADERS]);
  await ensureSheetWithHeaders(spreadsheetId, USER_BADGES_SHEET, [...USER_BADGE_HEADERS]);
}

// ----------------------------------------------------------------
// Levels
// ----------------------------------------------------------------

export async function listLevels(): Promise<LevelRecord[]> {
  const cacheKey = 'levels';
  const hit = cacheGet<LevelRecord[]>(cacheKey);
  if (hit) return hit;

  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) return [];
  try {
    await ensureLevelSheets(spreadsheetId);
    const rows = await listRowsBySheet(spreadsheetId, LEVELS_SHEET);
    const list2 = rows
      .map(coerceLevelRow)
      .filter((r): r is LevelRecord => r !== null)
      .sort((a, b) => a.order - b.order);
    cacheSet(cacheKey, list2);
    return list2;
  } catch (error) {
    console.error('Failed to list levels:', error);
    return [];
  }
}

export async function getLevelById(id: string): Promise<LevelRecord | null> {
  const all = await listLevels();
  return all.find((l) => l.id === id) ?? null;
}

export async function upsertLevel(
  input: (Omit<LevelRecord, 'id' | 'createdAt' | 'isActive'> & { isActive?: boolean }) | (Partial<Omit<LevelRecord, 'createdAt' | 'isActive'>> & { id: string; isActive?: boolean }),
): Promise<LevelRecord> {
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) throw new Error('Spreadsheet ID not configured');
  await ensureLevelSheets(spreadsheetId);

  const all = await listLevels();
  const existing = 'id' in input ? all.find((l) => l.id === input.id) : null;
  const next: LevelRecord = existing
    ? {
        ...existing,
        name: input.name?.trim() || existing.name,
        description: input.description?.trim() ?? existing.description,
        order: input.order ?? existing.order,
        isActive: input.isActive ?? existing.isActive,
      }
    : {
        id: newId(),
        name: input.name!.trim(),
        description: input.description?.trim() ?? '',
        order: input.order ?? 0,
        isActive: input.isActive ?? true,
        createdAt: new Date().toISOString(),
      };

  const row = {
    id: next.id,
    name: next.name,
    description: next.description,
    order: String(next.order),
    isActive: next.isActive ? 'true' : 'false',
    createdAt: next.createdAt,
  };
  if (existing) {
    await updateRowById(spreadsheetId, LEVELS_SHEET, existing.id, row);
  } else {
    await createRowWithId(spreadsheetId, LEVELS_SHEET, row);
  }
  cacheClear();
  return next;
}

export async function deleteLevel(id: string): Promise<boolean> {
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) throw new Error('Spreadsheet ID not configured');
  await ensureLevelSheets(spreadsheetId);

  const all = await listLevels();
  const target = all.find((l) => l.id === id);
  if (!target) return false;

  // Also delete level-badge relationships
  const lbRows = await listLevelBadges();
  for (const lb of lbRows.filter((x) => x.levelId === id)) {
    await deleteRowById(spreadsheetId, LEVEL_BADGES_SHEET, lb.id);
  }

  await deleteRowById(spreadsheetId, LEVELS_SHEET, target.id);
  cacheClear();
  return true;
}

// ----------------------------------------------------------------
// Level-Badge Requirements
// ----------------------------------------------------------------

export async function listLevelBadges(): Promise<LevelBadgeRecord[]> {
  const cacheKey = 'level_badges';
  const hit = cacheGet<LevelBadgeRecord[]>(cacheKey);
  if (hit) return hit;

  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) return [];
  try {
    await ensureLevelSheets(spreadsheetId);
    const rows = await listRowsBySheet(spreadsheetId, LEVEL_BADGES_SHEET);
    const list2 = rows
      .map(coerceLevelBadgeRow)
      .filter((r): r is LevelBadgeRecord => r !== null);
    cacheSet(cacheKey, list2);
    return list2;
  } catch (error) {
    console.error('Failed to list level badges:', error);
    return [];
  }
}

export async function getRequiredBadgesForLevel(levelId: string): Promise<string[]> {
  const all = await listLevelBadges();
  return all.filter((lb) => lb.levelId === levelId).map((lb) => lb.badgeKey);
}

export async function upsertLevelBadge(
  levelId: string,
  badgeKey: string,
): Promise<LevelBadgeRecord> {
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) throw new Error('Spreadsheet ID not configured');
  await ensureLevelSheets(spreadsheetId);

  const all = await listLevelBadges();
  const existing = all.find(
    (lb) => lb.levelId === levelId && lb.badgeKey === badgeKey.toLowerCase(),
  );
  const next: LevelBadgeRecord = existing
    ? existing
    : {
        id: newId(),
        levelId,
        badgeKey: badgeKey.toLowerCase(),
      };

  if (!existing) {
    const row = {
      id: next.id,
      levelId: next.levelId,
      badgeKey: next.badgeKey,
    };
    await createRowWithId(spreadsheetId, LEVEL_BADGES_SHEET, row);
    cacheClear();
  }
  return next;
}

export async function deleteLevelBadge(levelId: string, badgeKey: string): Promise<boolean> {
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) throw new Error('Spreadsheet ID not configured');
  const all = await listLevelBadges();
  const target = all.find(
    (lb) => lb.levelId === levelId && lb.badgeKey === badgeKey.toLowerCase(),
  );
  if (!target) return false;
  await deleteRowById(spreadsheetId, LEVEL_BADGES_SHEET, target.id);
  cacheClear();
  return true;
}

export async function setLevelBadges(levelId: string, badgeKeys: string[]): Promise<void> {
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) throw new Error('Spreadsheet ID not configured');
  await ensureLevelSheets(spreadsheetId);

  const current = await listLevelBadges();
  const currentForLevel = current.filter((lb) => lb.levelId === levelId);
  const currentKeys = new Set(currentForLevel.map((lb) => lb.badgeKey));
  const newKeys = new Set(badgeKeys.map((k) => k.toLowerCase()));

  // Delete removed
  for (const lb of currentForLevel) {
    if (!newKeys.has(lb.badgeKey)) {
      await deleteRowById(spreadsheetId, LEVEL_BADGES_SHEET, lb.id);
    }
  }

  // Add new
  for (const key of newKeys) {
    if (!currentKeys.has(key)) {
      const row = {
        id: newId(),
        levelId,
        badgeKey: key,
      };
      await createRowWithId(spreadsheetId, LEVEL_BADGES_SHEET, row);
    }
  }
  cacheClear();
}

// ----------------------------------------------------------------
// Badge Catalog (reusing existing badges table with extended types)
// ----------------------------------------------------------------

export async function listBadgeCatalog(): Promise<BadgeCatalogRecord[]> {
  const cacheKey = 'badge_catalog';
  const hit = cacheGet<BadgeCatalogRecord[]>(cacheKey);
  if (hit) return hit;

  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) return [];
  try {
    await ensureLevelSheets(spreadsheetId);
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

export async function getBadgeByKey(key: string): Promise<BadgeCatalogRecord | null> {
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
  await ensureLevelSheets(spreadsheetId);

  const all = await listBadgeCatalog();
  const key = input.key.trim().toLowerCase();
  const existing = all.find((b) => b.key === key);
  const next: BadgeCatalogRecord = existing
    ? {
        ...existing,
        label: input.label.trim() || existing.label,
        icon: input.icon.trim() || existing.icon,
        description: input.description.trim(),
        type: input.type ?? existing.type,
        category: input.category ?? existing.category,
        earningCriteria: input.earningCriteria ?? existing.earningCriteria,
        archived: input.archived ?? existing.archived,
      }
    : {
        id: newId(),
        key,
        label: input.label.trim(),
        icon: input.icon.trim() || '🏅',
        description: input.description.trim(),
        type: input.type ?? 'skill',
        category: input.category ?? '',
        earningCriteria: input.earningCriteria ?? '',
        archived: input.archived ?? false,
        createdAt: new Date().toISOString(),
      };

  const row = {
    id: next.id,
    key: next.key,
    label: next.label,
    icon: next.icon,
    description: next.description,
    type: next.type,
    category: next.category,
    earningCriteria: next.earningCriteria,
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

export async function deleteBadge(key: string): Promise<boolean> {
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) throw new Error('Spreadsheet ID not configured');
  const all = await listBadgeCatalog();
  const target = all.find((b) => b.key === key.toLowerCase());
  if (!target) return false;
  await deleteRowById(spreadsheetId, BADGES_SHEET, target.id);
  // Also remove from level-badge requirements
  const lbRows = await listLevelBadges();
  for (const lb of lbRows.filter((x) => x.badgeKey === key.toLowerCase())) {
    await deleteRowById(spreadsheetId, LEVEL_BADGES_SHEET, lb.id);
  }
  cacheClear();
  return true;
}

// ----------------------------------------------------------------
// User Badge Grants (extended with revocation)
// ----------------------------------------------------------------

export async function listAllGrants(): Promise<BadgeGrantRecord[]> {
  const cacheKey = 'all_grants';
  const hit = cacheGet<BadgeGrantRecord[]>(cacheKey);
  if (hit) return hit;

  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) return [];
  try {
    await ensureLevelSheets(spreadsheetId);
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
      userEmail: g.userEmail,
      badgeKey: g.badgeKey,
      status: g.status,
      grantedAt: g.grantedAt,
      grantedBy: g.grantedBy,
      revokedAt: g.revokedAt,
      revokedBy: g.revokedBy,
      note: g.note,
    });
  }
  out.sort((a, b) => (a.grantedAt < b.grantedAt ? 1 : a.grantedAt > b.grantedAt ? -1 : 0));
  return out;
}

export async function listActiveSkillBadgeKeysForUser(email: string): Promise<string[]> {
  const grants = await listAllGrants();
  const catalog = await listBadgeCatalog();
  const skillBadgeKeys = new Set(catalog.filter((b) => b.type === 'skill').map((b) => b.key));
  const lower = email.trim().toLowerCase();
  return grants
    .filter(
      (g) => g.userEmail === lower && g.status === 'active' && skillBadgeKeys.has(g.badgeKey),
    )
    .map((g) => g.badgeKey);
}

export async function countGrantedBadgesForUser(email: string): Promise<number> {
  const lower = email.trim().toLowerCase();
  const grants = await listAllGrants();
  return grants.filter((g) => g.userEmail === lower && g.status === 'active').length;
}

export async function grantBadge(input: {
  userEmail: string;
  badgeKey: string;
  grantedBy: string;
  note?: string;
}): Promise<BadgeGrantRecord> {
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) throw new Error('Spreadsheet ID not configured');
  await ensureLevelSheets(spreadsheetId);

  const email = input.userEmail.trim().toLowerCase();
  const badgeKey = input.badgeKey.trim().toLowerCase();
  const existing = await listAllGrants();
  const dup = existing.find(
    (g) => g.userEmail === email && g.badgeKey === badgeKey && g.status === 'active',
  );
  if (dup) return dup;

  const record: BadgeGrantRecord = {
    id: newId(),
    userEmail: email,
    badgeKey,
    status: 'active',
    grantedAt: new Date().toISOString(),
    grantedBy: input.grantedBy.trim().toLowerCase(),
    revokedAt: null,
    revokedBy: null,
    note: (input.note ?? '').trim(),
  };
  await createRowWithId(spreadsheetId, USER_BADGES_SHEET, {
    id: record.id,
    userEmail: record.userEmail,
    badgeKey: record.badgeKey,
    status: record.status,
    grantedAt: record.grantedAt,
    grantedBy: record.grantedBy,
    revokedAt: record.revokedAt ?? '',
    revokedBy: record.revokedBy ?? '',
    note: record.note,
  });
  cacheClear();
  return record;
}

export async function revokeBadge(input: {
  userEmail: string;
  badgeKey: string;
  revokedBy: string;
  note?: string;
}): Promise<boolean> {
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) throw new Error('Spreadsheet ID not configured');
  const email = input.userEmail.trim().toLowerCase();
  const badgeKey = input.badgeKey.trim().toLowerCase();
  const grants = await listAllGrants();
  const target = grants.find(
    (g) => g.userEmail === email && g.badgeKey === badgeKey && g.status === 'active',
  );
  if (!target) return false;

  const now = new Date().toISOString();
  await updateRowById(spreadsheetId, USER_BADGES_SHEET, target.id, {
    id: target.id,
    userEmail: target.userEmail,
    badgeKey: target.badgeKey,
    status: 'revoked',
    grantedAt: target.grantedAt,
    grantedBy: target.grantedBy,
    revokedAt: now,
    revokedBy: input.revokedBy.trim().toLowerCase(),
    note: (input.note ?? target.note ?? '').trim(),
  });
  cacheClear();
  return true;
}

// ----------------------------------------------------------------
// Level Computation
// ----------------------------------------------------------------

export async function computePlayerLevel(email: string): Promise<PlayerLevelResult> {
  const lower = email.trim().toLowerCase();

  // Get player's active skill badge keys
  const earnedSkillBadgeKeys = await listActiveSkillBadgeKeysForUser(lower);

  // Get all active levels with their required badges
  const allLevels = await listLevels();
  const activeLevels = allLevels.filter((l) => l.isActive).sort((a, b) => a.order - b.order);

  // Build level -> required badge keys map
  const levelBadges = await listLevelBadges();
  const requiredByLevel = new Map<string, string[]>();
  for (const lb of levelBadges) {
    const arr = requiredByLevel.get(lb.levelId) ?? [];
    arr.push(lb.badgeKey);
    requiredByLevel.set(lb.levelId, arr);
  }

  // Find highest eligible level
  let currentLevel: LevelRecord | null = null;
  for (const level of activeLevels) {
    const required = requiredByLevel.get(level.id) ?? [];
    if (required.length === 0) {
      // Level with no requirements (e.g., Newbie) - always eligible
      currentLevel = level;
      continue;
    }
    const hasAll = required.every((k) => earnedSkillBadgeKeys.includes(k));
    if (hasAll) {
      currentLevel = level;
    } else {
      // Stop at first level where requirements aren't met
      break;
    }
  }

  // If no level found, fallback to Newbie (lowest order)
  if (!currentLevel && activeLevels.length > 0) {
    currentLevel = activeLevels[0];
  }

  // Find next level
  let nextLevel: LevelRecord | null = null;
  if (currentLevel) {
    const currentIndex = activeLevels.findIndex((l) => l.id === currentLevel!.id);
    if (currentIndex >= 0 && currentIndex + 1 < activeLevels.length) {
      nextLevel = activeLevels[currentIndex + 1];
    }
  }

  // Compute progress for next level
  let earned = 0;
  let required = 0;
  let missingBadges: string[] = [];

  if (nextLevel) {
    const nextRequired = requiredByLevel.get(nextLevel.id) ?? [];
    required = nextRequired.length;
    for (const key of nextRequired) {
      if (earnedSkillBadgeKeys.includes(key)) {
        earned++;
      } else {
        missingBadges.push(key);
      }
    }
  }

  return {
    currentLevel,
    nextLevel,
    progress: { earned, required },
    missingBadges,
    allLevels: activeLevels,
  };
}