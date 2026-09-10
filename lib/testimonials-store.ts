// ============================================
// TESTIMONIALS (MEMBER EXPERIENCES) DATA STORE
// ============================================
// Reads/writes the "Member Experiences" section (settings + testimonial
// cards) from a Google Sheet. Reuses the existing helpers in
// app/lib/supabase.ts.
//
// Sheet schema (created on first save):
//   testimonials_settings: id,tag,title,subtitle,updatedAt
//   testimonials_items:    id,quote,name,since,avatar,order,createdAt

import {
  ensureSheetWithHeaders,
  getSpreadsheetId,
  listRowsBySheet,
} from '@/app/lib/supabase';
import { testimonials as fallbackTestimonials } from '@/data/testimonials';
import {
  TESTIMONIALS_SETTINGS_HEADERS,
  TESTIMONIAL_ITEM_HEADERS,
  type Testimonial,
  type TestimonialsContent,
  type TestimonialsSettings,
} from '@/data/testimonials-types';

const SETTINGS_SHEET = 'testimonials_settings';
const ITEMS_SHEET = 'testimonials_items';
const SETTINGS_ROW_ID = 'current';

const TESTIMONIALS_CACHE_KEY = 'testimonials:content';
// Keep the public read cache short so edits made directly in the Google
// Sheet UI (which don't go through the admin mutation routes) show up on the
// home page within a minute instead of waiting for a server restart.
const TESTIMONIALS_PUBLIC_CACHE_TTL_MS = 60 * 1000;

type TestimonialsCacheEntry = { expiresAt: number; value: TestimonialsContent };

function getCacheStore() {
  const g = globalThis as unknown as {
    __testimonials_cache__?: Map<string, TestimonialsCacheEntry>;
  };
  if (!g.__testimonials_cache__) {
    g.__testimonials_cache__ = new Map<string, TestimonialsCacheEntry>();
  }
  return g.__testimonials_cache__;
}

function readCache(key: string): TestimonialsContent | null {
  const store = getCacheStore();
  const hit = store.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    store.delete(key);
    return null;
  }
  return hit.value;
}

function writeCache(key: string, value: TestimonialsContent) {
  getCacheStore().set(key, {
    expiresAt: Date.now() + TESTIMONIALS_PUBLIC_CACHE_TTL_MS,
    value,
  });
}

export function clearTestimonialsContentCache() {
  getCacheStore().clear();
}

export function isAdminEmail(email: string | null | undefined): boolean {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!adminEmail || !email) return false;
  return email.trim().toLowerCase() === adminEmail;
}

export function getDefaultTestimonialsContent(): TestimonialsContent {
  const now = new Date().toISOString();
  return {
    settings: {
      id: SETTINGS_ROW_ID,
      tag: 'Stories',
      title: 'Member Experiences',
      subtitle: 'Hear from the people who make Dear Tennis special',
      updatedAt: now,
    },
    items: fallbackTestimonials.map((t, idx) => ({
      id: t.id,
      quote: t.quote,
      name: t.name,
      since: t.since,
      avatar: t.avatar,
      order: idx,
    })),
  };
}

function coerceSettings(rows: Record<string, unknown>[]): TestimonialsSettings {
  const found = rows.find(
    (r) => String(r.id ?? '').trim() === SETTINGS_ROW_ID,
  );
  const defaults = getDefaultTestimonialsContent().settings;
  if (!found) return defaults;
  return {
    id: SETTINGS_ROW_ID,
    tag: String(found.tag ?? defaults.tag),
    title: String(found.title ?? defaults.title),
    subtitle: String(found.subtitle ?? defaults.subtitle),
    updatedAt: String(found.updatedAt ?? new Date().toISOString()),
  };
}

function coerceItem(r: Record<string, unknown>, idx: number): Testimonial {
  return {
    id: String(r.id ?? '').trim() || `fallback-${idx}`,
    quote: String(r.quote ?? ''),
    name: String(r.name ?? ''),
    since: String(r.since ?? ''),
    avatar: String(r.avatar ?? ''),
    order: Number(r.order ?? idx),
    createdAt: r.createdAt ? String(r.createdAt) : undefined,
  };
}

function coerceItems(rows: Record<string, unknown>[]): Testimonial[] {
  // A testimonial row is valid as long as it has a quote — empty name/avatar
  // can be filled in later. Empty quotes (truly blank rows in the grid) are
  // dropped.
  const out = rows
    .filter((r) => String(r.quote ?? '').trim().length > 0)
    .map((r, idx) => coerceItem(r, idx));
  return out.sort((a, b) => a.order - b.order);
}

/**
 * Bundled defaults are the baseline gallery of testimonials. Sheet rows
 * override matching ids (e.g. editing "sarah-chen") and any extra rows
 * (new UUIDs) are appended. Without this merge, saving even one testimonial
 * to the sheet would hide the rest of the bundled defaults on the home page.
 */
function mergeTestimonials(sheetItems: Testimonial[]): Testimonial[] {
  const defaults = getDefaultTestimonialsContent().items;
  if (sheetItems.length === 0) return defaults;

  const defaultIds = new Set(defaults.map((d) => d.id));
  const sheetById = new Map(sheetItems.map((i) => [i.id, i]));

  const merged: Testimonial[] = defaults.map((d) => sheetById.get(d.id) ?? d);
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
): Promise<TestimonialsContent> {
  const [settingsRows, itemRows] = await Promise.all([
    listRowsBySheet(spreadsheetId, SETTINGS_SHEET),
    listRowsBySheet(spreadsheetId, ITEMS_SHEET),
  ]);
  const settings = coerceSettings(settingsRows);
  const items = mergeTestimonials(coerceItems(itemRows));
  return { settings, items };
}

/** Paginated envelope returned by admin reads. */
export type PagedTestimonialsContent = {
  settings: TestimonialsSettings;
  items: Testimonial[];
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

/** Row count for assigning order on create (uses the merged view). */
export async function getTestimonialsItemCount(
  spreadsheetId: string,
): Promise<number> {
  const itemRows = await listRowsBySheet(spreadsheetId, ITEMS_SHEET);
  return mergeTestimonials(coerceItems(itemRows)).length;
}

export async function getTestimonialsContent(): Promise<TestimonialsContent> {
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) return getDefaultTestimonialsContent();

  const cacheKey = `${TESTIMONIALS_CACHE_KEY}:${spreadsheetId}`;
  const cached = readCache(cacheKey);
  if (cached) return cached;

  try {
    const content = await fetchFromSheet(spreadsheetId);
    writeCache(cacheKey, content);
    return content;
  } catch (error) {
    console.error(
      'Failed to read testimonials content, falling back to defaults:',
      error,
    );
    return getDefaultTestimonialsContent();
  }
}

export async function getTestimonialsContentForAdmin(
  args?: { page?: number; pageSize?: number },
): Promise<PagedTestimonialsContent> {
  const spreadsheetId = getSpreadsheetId();
  const FALLBACK_PAGE_SIZE = 5;
  const { page, pageSize, offset } = normalizePageArgs(args, FALLBACK_PAGE_SIZE);

  if (!spreadsheetId) {
    const allItems = getDefaultTestimonialsContent().items;
    const total = allItems.length;
    return {
      settings: getDefaultTestimonialsContent().settings,
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
    const allItems = mergeTestimonials(coerceItems(itemRows));
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
    console.error(
      'Failed to read testimonials content for admin:',
      error,
    );
    const fallback = getDefaultTestimonialsContent();
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

export async function ensureTestimonialsSheets(spreadsheetId: string) {
  await Promise.all([
    ensureSheetWithHeaders(spreadsheetId, SETTINGS_SHEET, [
      ...TESTIMONIALS_SETTINGS_HEADERS,
    ]),
    ensureSheetWithHeaders(spreadsheetId, ITEMS_SHEET, [
      ...TESTIMONIAL_ITEM_HEADERS,
    ]),
  ]);
}

export async function getTestimonialsSettingsRowId(
  spreadsheetId: string,
): Promise<string | null> {
  try {
    const rows = await listRowsBySheet(spreadsheetId, SETTINGS_SHEET);
    const found = rows.some(
      (r) => String(r.id ?? '').trim() === SETTINGS_ROW_ID,
    );
    return found ? SETTINGS_ROW_ID : null;
  } catch {
    return null;
  }
}

export { SETTINGS_SHEET, ITEMS_SHEET, SETTINGS_ROW_ID };
export type {
  TestimonialsContent,
  TestimonialsSettings,
  Testimonial,
};
export { TESTIMONIALS_SETTINGS_HEADERS, TESTIMONIAL_ITEM_HEADERS };
