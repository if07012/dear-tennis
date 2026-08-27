// ============================================
// GALLERY DATA STORE
// ============================================
// Reads/writes the "Gallery" section (settings + image cards) from a
// Google Sheet. Reuses the existing helpers in app/lib/googleSheets.ts.
//
// Public reads return the full gallery for the home page; admin reads accept
// explicit pagination args and return a paginated envelope.
//
// Sheet schema (created on first save):
//   gallery_settings: id,tag,title,subtitle,updatedAt
//   gallery_items:    id,src,alt,large,order,createdAt

import {
  ensureSheetWithHeaders,
  getGoogleSheet,
  listRowsBySheet,
} from '@/app/lib/googleSheets';
import { gallery as fallbackGallery } from '@/data/gallery';
import {
  GALLERY_SETTINGS_HEADERS,
  GALLERY_ITEM_HEADERS,
  type GalleryContent,
  type GalleryItem,
  type GallerySettings,
} from '@/data/gallery-types';

const SETTINGS_SHEET = 'gallery_settings';
const ITEMS_SHEET = 'gallery_items';
const SETTINGS_ROW_ID = 'current';

const GALLERY_CACHE_KEY = 'gallery:content';
// Keep the public read cache short so edits made directly in the Google
// Sheet UI (which don't go through the admin mutation routes — and therefore
// don't bust the cache via clearGalleryContentCache) show up on the home
// page within a minute instead of waiting for a server restart.
const GALLERY_PUBLIC_CACHE_TTL_MS = 60 * 1000;

type GalleryCacheEntry = { expiresAt: number; value: GalleryContent };

function getCacheStore() {
  const g = globalThis as unknown as {
    __gallery_cache__?: Map<string, GalleryCacheEntry>;
  };
  if (!g.__gallery_cache__) {
    g.__gallery_cache__ = new Map<string, GalleryCacheEntry>();
  }
  return g.__gallery_cache__;
}

function readGalleryCache(key: string): GalleryContent | null {
  const store = getCacheStore();
  const hit = store.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    store.delete(key);
    return null;
  }
  return hit.value;
}

function writeGalleryCache(key: string, value: GalleryContent) {
  getCacheStore().set(key, {
    expiresAt: Date.now() + GALLERY_PUBLIC_CACHE_TTL_MS,
    value,
  });
}

export function clearGalleryContentCache() {
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

export function getDefaultGalleryContent(): GalleryContent {
  const now = new Date().toISOString();
  return {
    settings: {
      id: SETTINGS_ROW_ID,
      tag: 'Moments',
      title: 'Captured Memories',
      subtitle: 'Highlights from our community on and off the court',
      updatedAt: now,
    },
    items: fallbackGallery.map((g, idx) => ({
      id: g.id,
      src: g.src,
      alt: g.alt,
      large: Boolean(g.large),
      order: idx,
    })),
  };
}

function coerceSettings(rows: Record<string, unknown>[]): GallerySettings {
  const found = rows.find(
    (r) => String(r.id ?? '').trim() === SETTINGS_ROW_ID,
  );
  const defaults = getDefaultGalleryContent().settings;
  if (!found) return defaults;
  return {
    id: SETTINGS_ROW_ID,
    tag: String(found.tag ?? defaults.tag),
    title: String(found.title ?? defaults.title),
    subtitle: String(found.subtitle ?? defaults.subtitle),
    updatedAt: String(found.updatedAt ?? new Date().toISOString()),
  };
}

function coerceItem(r: Record<string, unknown>, idx: number): GalleryItem {
  // Sheets serialise booleans as the strings "TRUE"/"FALSE". Normalise so
  // downstream code can treat `large` as a real boolean regardless of how
  // the row was edited (sheet UI vs API).
  const rawLarge = r.large;
  const large =
    rawLarge === true ||
    rawLarge === 'TRUE' ||
    rawLarge === 'true' ||
    rawLarge === 1 ||
    rawLarge === '1';
  return {
    id: String(r.id ?? '').trim() || `fallback-${idx}`,
    src: String(r.src ?? ''),
    alt: String(r.alt ?? ''),
    large,
    order: Number(r.order ?? idx),
    createdAt: r.createdAt ? String(r.createdAt) : undefined,
  };
}

function coerceItems(rows: Record<string, unknown>[]): GalleryItem[] {
  const out = rows
    .filter((r) => String(r.src ?? '').trim().length > 0)
    .map((r, idx) => coerceItem(r, idx));
  return out.sort((a, b) => a.order - b.order);
}

/**
 * Bundled defaults are the baseline gallery. Sheet rows override matching ids
 * (e.g. editing "match-point") and any extra rows (new UUIDs) are appended.
 * Without this merge, saving even one item to the sheet would hide the rest of
 * the bundled defaults on the home page.
 */
function mergeGalleryItems(sheetItems: GalleryItem[]): GalleryItem[] {
  const defaults = getDefaultGalleryContent().items;
  if (sheetItems.length === 0) return defaults;

  const defaultIds = new Set(defaults.map((d) => d.id));
  const sheetById = new Map(sheetItems.map((i) => [i.id, i]));

  const merged: GalleryItem[] = defaults.map((d) => sheetById.get(d.id) ?? d);
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

async function fetchFromSheet(spreadsheetId: string): Promise<GalleryContent> {
  const [settingsRows, itemRows] = await Promise.all([
    listRowsBySheet(spreadsheetId, SETTINGS_SHEET),
    listRowsBySheet(spreadsheetId, ITEMS_SHEET),
  ]);
  const settings = coerceSettings(settingsRows);
  const items = mergeGalleryItems(coerceItems(itemRows));
  return { settings, items };
}

/** Paginated envelope returned by admin reads. */
export type PagedGalleryContent = {
  settings: GallerySettings;
  items: GalleryItem[];
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
export async function getGalleryItemCount(spreadsheetId: string): Promise<number> {
  const itemRows = await listRowsBySheet(spreadsheetId, ITEMS_SHEET);
  return mergeGalleryItems(coerceItems(itemRows)).length;
}

export async function getGalleryContent(): Promise<GalleryContent> {
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) return getDefaultGalleryContent();

  const cacheKey = `${GALLERY_CACHE_KEY}:${spreadsheetId}`;
  const cached = readGalleryCache(cacheKey);
  if (cached) return cached;

  try {
    const content = await fetchFromSheet(spreadsheetId);
    writeGalleryCache(cacheKey, content);
    return content;
  } catch (error) {
    console.error('Failed to read gallery content, falling back to defaults:', error);
    return getDefaultGalleryContent();
  }
}

export async function getGalleryContentForAdmin(
  args?: { page?: number; pageSize?: number },
): Promise<PagedGalleryContent> {
  const spreadsheetId = getSpreadsheetId();
  const FALLBACK_PAGE_SIZE = 5;
  const { page, pageSize, offset } = normalizePageArgs(args, FALLBACK_PAGE_SIZE);

  if (!spreadsheetId) {
    const allItems = getDefaultGalleryContent().items;
    const total = allItems.length;
    return {
      settings: getDefaultGalleryContent().settings,
      items: allItems.slice(offset, offset + pageSize),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  try {
    const [settingsRows, itemRows] = await Promise.all([
      listRowsBySheet(spreadsheetId, SETTINGS_SHEET),
      listRowsBySheet(spreadsheetId, ITEMS_SHEET),
    ]);
    const settings = coerceSettings(settingsRows);
    const allItems = mergeGalleryItems(coerceItems(itemRows));
    const total = allItems.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return {
      settings,
      items: allItems.slice(offset, offset + pageSize),
      total,
      page,
      pageSize,
      totalPages,
    };
  } catch (error) {
    console.error('Failed to read gallery content for admin:', error);
    const fallback = getDefaultGalleryContent();
    return {
      settings: fallback.settings,
      items: fallback.items,
      total: fallback.items.length,
      page: 1,
      pageSize,
      totalPages: Math.max(1, Math.ceil(fallback.items.length / pageSize)),
    };
  }
}

export async function ensureGallerySheets(spreadsheetId: string) {
  await Promise.all([
    ensureSheetWithHeaders(spreadsheetId, SETTINGS_SHEET, [...GALLERY_SETTINGS_HEADERS]),
    ensureSheetWithHeaders(spreadsheetId, ITEMS_SHEET, [...GALLERY_ITEM_HEADERS]),
  ]);
}

export async function getGallerySettingsRowId(
  spreadsheetId: string,
): Promise<string | null> {
  const doc = await getGoogleSheet(spreadsheetId);
  const sheet = doc.sheetsByTitle[SETTINGS_SHEET];
  if (!sheet) return null;
  const rows = await sheet.getRows();
  const found = rows.find(
    (r) => String(r.toObject().id ?? '').trim() === SETTINGS_ROW_ID,
  );
  return found ? SETTINGS_ROW_ID : null;
}

export { SETTINGS_SHEET, ITEMS_SHEET, SETTINGS_ROW_ID };
export type { GalleryContent, GallerySettings, GalleryItem };
export { GALLERY_SETTINGS_HEADERS, GALLERY_ITEM_HEADERS };
