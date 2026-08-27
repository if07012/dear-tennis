// ============================================
// STATISTICS DATA STORE
// ============================================
// Reads/writes the "Statistics" strip (the 4 big-number tiles under the
// gallery) from a Google Sheet. Reuses the existing helpers in
// app/lib/googleSheets.ts.
//
// Public reads return the full list for the home page; admin reads accept
// explicit pagination args and return a paginated envelope.
//
// Sheet schema (created on first save):
//   statistics_items: id,value,label,suffix,order,createdAt

import {
  ensureSheetWithHeaders,
  listRowsBySheet,
} from '@/app/lib/googleSheets';
import { statistics as fallbackStatistics } from '@/data/statistics';
import {
  STATISTICS_ITEM_HEADERS,
  type Statistic,
  type StatisticsContent,
} from '@/data/statistics-types';

const ITEMS_SHEET = 'statistics_items';

const STATISTICS_CACHE_KEY = 'statistics:content';
// Keep the public read cache short so edits made directly in the Google
// Sheet UI (which don't go through the admin mutation routes) show up on the
// home page within a minute instead of waiting for a server restart.
const STATISTICS_PUBLIC_CACHE_TTL_MS = 60 * 1000;

type StatisticsCacheEntry = { expiresAt: number; value: StatisticsContent };

function getCacheStore() {
  const g = globalThis as unknown as {
    __statistics_cache__?: Map<string, StatisticsCacheEntry>;
  };
  if (!g.__statistics_cache__) {
    g.__statistics_cache__ = new Map<string, StatisticsCacheEntry>();
  }
  return g.__statistics_cache__;
}

function readCache(key: string): StatisticsContent | null {
  const store = getCacheStore();
  const hit = store.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    store.delete(key);
    return null;
  }
  return hit.value;
}

function writeCache(key: string, value: StatisticsContent) {
  getCacheStore().set(key, {
    expiresAt: Date.now() + STATISTICS_PUBLIC_CACHE_TTL_MS,
    value,
  });
}

export function clearStatisticsContentCache() {
  getCacheStore().clear();
}

function getSpreadsheetId(): string | null {
  const id = process.env.HERO_SPREADSHEET_ID;
  return id && id.trim().length > 0 ? id : null;
}

export function isAdminEmail(email: string | null | undefined): boolean {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!adminEmail || !email) return false;
  return email.trim().toLowerCase() === adminEmail;
}

export function getDefaultStatisticsContent(): StatisticsContent {
  return {
    items: fallbackStatistics.map((s, idx) => ({
      id: s.id,
      value: s.value,
      label: s.label,
      suffix: s.suffix,
      order: idx,
    })),
  };
}

function coerceItem(r: Record<string, unknown>, idx: number): Statistic {
  return {
    id: String(r.id ?? '').trim() || `fallback-${idx}`,
    value: Number(r.value ?? 0),
    label: String(r.label ?? ''),
    suffix: r.suffix ? String(r.suffix) : undefined,
    order: Number(r.order ?? idx),
    createdAt: r.createdAt ? String(r.createdAt) : undefined,
  };
}

function coerceItems(rows: Record<string, unknown>[]): Statistic[] {
  // A row is valid as long as it has a non-empty label and a numeric value.
  // Truly blank rows in the grid are dropped.
  const out = rows
    .filter(
      (r) =>
        String(r.label ?? '').trim().length > 0 && Number(r.value ?? 0) > 0,
    )
    .map((r, idx) => coerceItem(r, idx));
  return out.sort((a, b) => a.order - b.order);
}

/**
 * Bundled defaults are the baseline stat tiles. Sheet rows override matching
 * ids (e.g. editing "members") and any extra rows (new UUIDs) are appended.
 * Without this merge, saving even one stat to the sheet would hide the rest
 * of the bundled defaults on the home page.
 */
function mergeStatistics(sheetItems: Statistic[]): Statistic[] {
  const defaults = getDefaultStatisticsContent().items;
  if (sheetItems.length === 0) return defaults;

  const defaultIds = new Set(defaults.map((d) => d.id));
  const sheetById = new Map(sheetItems.map((i) => [i.id, i]));

  const merged: Statistic[] = defaults.map(
    (d) => sheetById.get(d.id) ?? d,
  );
  for (const item of sheetItems) {
    if (!defaultIds.has(item.id)) merged.push(item);
  }

  return merged
    .sort(
      (a, b) =>
        a.order - b.order ||
        String(a.createdAt ?? '').localeCompare(String(b.createdAt ?? '')),
    )
    .map((item, idx) => ({ ...item, order: idx }));
}

async function fetchFromSheet(
  spreadsheetId: string,
): Promise<StatisticsContent> {
  const itemRows = await listRowsBySheet(spreadsheetId, ITEMS_SHEET);
  const items = mergeStatistics(coerceItems(itemRows));
  return { items };
}

/** Paginated envelope returned by admin reads. */
export type PagedStatisticsContent = {
  items: Statistic[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

function normalizePageArgs(
  args: { page?: number; pageSize?: number } | undefined,
  fallbackPageSize: number,
): { page: number; pageSize: number; offset: number } {
  const pageSize = Math.max(
    1,
    Math.min(200, Math.floor(args?.pageSize ?? fallbackPageSize) || fallbackPageSize),
  );
  const page = Math.max(1, Math.floor(args?.page ?? 1) || 1);
  return { page, pageSize, offset: (page - 1) * pageSize };
}

/** Row count for assigning order on create. */
export async function getStatisticsItemCount(
  spreadsheetId: string,
): Promise<number> {
  const itemRows = await listRowsBySheet(spreadsheetId, ITEMS_SHEET);
  return mergeStatistics(coerceItems(itemRows)).length;
}

export async function getStatisticsContent(): Promise<StatisticsContent> {
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) return getDefaultStatisticsContent();

  const cacheKey = `${STATISTICS_CACHE_KEY}:${spreadsheetId}`;
  const cached = readCache(cacheKey);
  if (cached) return cached;

  try {
    const content = await fetchFromSheet(spreadsheetId);
    writeCache(cacheKey, content);
    return content;
  } catch (error) {
    console.error(
      'Failed to read statistics content, falling back to defaults:',
      error,
    );
    return getDefaultStatisticsContent();
  }
}

export async function getStatisticsContentForAdmin(
  args?: { page?: number; pageSize?: number },
): Promise<PagedStatisticsContent> {
  const spreadsheetId = getSpreadsheetId();
  const FALLBACK_PAGE_SIZE = 5;
  const { page, pageSize, offset } = normalizePageArgs(args, FALLBACK_PAGE_SIZE);

  if (!spreadsheetId) {
    const allItems = getDefaultStatisticsContent().items;
    const total = allItems.length;
    return {
      items: allItems.slice(offset, offset + pageSize),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  try {
    const itemRows = await listRowsBySheet(spreadsheetId, ITEMS_SHEET);
    const allItems = mergeStatistics(coerceItems(itemRows));
    const total = allItems.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    return {
      items: allItems.slice(offset, offset + pageSize),
      total,
      page,
      pageSize,
      totalPages,
    };
  } catch (error) {
    console.error('Failed to read statistics content for admin:', error);
    const fallback = getDefaultStatisticsContent();
    return {
      items: fallback.items,
      total: fallback.items.length,
      page: 1,
      pageSize,
      totalPages: Math.max(1, Math.ceil(fallback.items.length / pageSize)),
    };
  }
}

export async function ensureStatisticsSheets(spreadsheetId: string) {
  await ensureSheetWithHeaders(spreadsheetId, ITEMS_SHEET, [
    ...STATISTICS_ITEM_HEADERS,
  ]);
}

export { ITEMS_SHEET };
export type { StatisticsContent, Statistic };
export { STATISTICS_ITEM_HEADERS };