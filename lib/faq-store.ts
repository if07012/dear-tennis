// ============================================
// FAQ DATA STORE
// ============================================
// Reads/writes the "Frequently Asked Questions" section (settings + Q&A
// cards) from a Google Sheet. Reuses the existing helpers in
// app/lib/supabase.ts.
//
// Public reads return the full FAQ list for the home page; admin reads
// accept explicit pagination args and return a paginated envelope.
//
// Sheet schema (created on first save):
//   faq_settings: id,tag,title,subtitle,updatedAt
//   faq_items:    id,question,answer,order,createdAt

import {
  ensureSheetWithHeaders,
  getSpreadsheetId,
  listRowsBySheet,
} from '@/app/lib/supabase';
import { faqs as fallbackFaqs } from '@/data/faqs';
import {
  FAQ_SETTINGS_HEADERS,
  FAQ_ITEM_HEADERS,
  type FAQ,
  type FAQContent,
  type FAQSettings,
} from '@/data/faq-types';

const SETTINGS_SHEET = 'faq_settings';
const ITEMS_SHEET = 'faq_items';
const SETTINGS_ROW_ID = 'current';

const FAQ_CACHE_KEY = 'faq:content';
// Keep the public read cache short so edits made directly in the Google
// Sheet UI (which don't go through the admin mutation routes) show up on the
// home page within a minute instead of waiting for a server restart.
const FAQ_PUBLIC_CACHE_TTL_MS = 60 * 1000;

type FAQCacheEntry = { expiresAt: number; value: FAQContent };

function getCacheStore() {
  const g = globalThis as unknown as {
    __faq_cache__?: Map<string, FAQCacheEntry>;
  };
  if (!g.__faq_cache__) {
    g.__faq_cache__ = new Map<string, FAQCacheEntry>();
  }
  return g.__faq_cache__;
}

function readCache(key: string): FAQContent | null {
  const store = getCacheStore();
  const hit = store.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    store.delete(key);
    return null;
  }
  return hit.value;
}

function writeCache(key: string, value: FAQContent) {
  getCacheStore().set(key, {
    expiresAt: Date.now() + FAQ_PUBLIC_CACHE_TTL_MS,
    value,
  });
}

export function clearFAQContentCache() {
  getCacheStore().clear();
}

export function isAdminEmail(email: string | null | undefined): boolean {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!adminEmail || !email) return false;
  return email.trim().toLowerCase() === adminEmail;
}

export function getDefaultFAQContent(): FAQContent {
  const now = new Date().toISOString();
  return {
    settings: {
      id: SETTINGS_ROW_ID,
      tag: 'Questions',
      title: 'Frequently Asked Questions',
      subtitle: '',
      updatedAt: now,
    },
    items: fallbackFaqs.map((f, idx) => ({
      id: f.id,
      question: f.question,
      answer: f.answer,
      order: idx,
    })),
  };
}

function coerceSettings(rows: Record<string, unknown>[]): FAQSettings {
  const found = rows.find(
    (r) => String(r.id ?? '').trim() === SETTINGS_ROW_ID,
  );
  const defaults = getDefaultFAQContent().settings;
  if (!found) return defaults;
  return {
    id: SETTINGS_ROW_ID,
    tag: String(found.tag ?? defaults.tag),
    title: String(found.title ?? defaults.title),
    subtitle: String(found.subtitle ?? defaults.subtitle),
    updatedAt: String(found.updatedAt ?? new Date().toISOString()),
  };
}

function coerceItem(r: Record<string, unknown>, idx: number): FAQ {
  return {
    id: String(r.id ?? '').trim() || `fallback-${idx}`,
    question: String(r.question ?? ''),
    answer: String(r.answer ?? ''),
    order: Number(r.order ?? idx),
    createdAt: r.createdAt ? String(r.createdAt) : undefined,
  };
}

function coerceItems(rows: Record<string, unknown>[]): FAQ[] {
  // A FAQ row is valid as long as it has a non-empty question — empty answers
  // can be filled in later. Truly blank rows are dropped.
  const out = rows
    .filter((r) => String(r.question ?? '').trim().length > 0)
    .map((r, idx) => coerceItem(r, idx));
  return out.sort((a, b) => a.order - b.order);
}

/**
 * Bundled defaults are the baseline FAQ list. Sheet rows override matching
 * ids (e.g. editing "beginner") and any extra rows (new UUIDs) are appended.
 * Without this merge, saving even one FAQ to the sheet would hide the rest
 * of the bundled defaults on the home page.
 */
function mergeFAQs(sheetItems: FAQ[]): FAQ[] {
  const defaults = getDefaultFAQContent().items;
  if (sheetItems.length === 0) return defaults;

  const defaultIds = new Set(defaults.map((d) => d.id));
  const sheetById = new Map(sheetItems.map((i) => [i.id, i]));

  const merged: FAQ[] = defaults.map((d) => sheetById.get(d.id) ?? d);
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
): Promise<FAQContent> {
  const [settingsRows, itemRows] = await Promise.all([
    listRowsBySheet(spreadsheetId, SETTINGS_SHEET),
    listRowsBySheet(spreadsheetId, ITEMS_SHEET),
  ]);
  const settings = coerceSettings(settingsRows);
  const items = mergeFAQs(coerceItems(itemRows));
  return { settings, items };
}

/** Paginated envelope returned by admin reads. */
export type PagedFAQContent = {
  settings: FAQSettings;
  items: FAQ[];
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
export async function getFAQItemCount(spreadsheetId: string): Promise<number> {
  const itemRows = await listRowsBySheet(spreadsheetId, ITEMS_SHEET);
  return mergeFAQs(coerceItems(itemRows)).length;
}

export async function getFAQContent(): Promise<FAQContent> {
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) return getDefaultFAQContent();

  const cacheKey = `${FAQ_CACHE_KEY}:${spreadsheetId}`;
  const cached = readCache(cacheKey);
  if (cached) return cached;

  try {
    const content = await fetchFromSheet(spreadsheetId);
    writeCache(cacheKey, content);
    return content;
  } catch (error) {
    console.error(
      'Failed to read FAQ content, falling back to defaults:',
      error,
    );
    return getDefaultFAQContent();
  }
}

export async function getFAQContentForAdmin(
  args?: { page?: number; pageSize?: number },
): Promise<PagedFAQContent> {
  const spreadsheetId = getSpreadsheetId();
  const FALLBACK_PAGE_SIZE = 5;
  const { page, pageSize, offset } = normalizePageArgs(args, FALLBACK_PAGE_SIZE);

  if (!spreadsheetId) {
    const allItems = getDefaultFAQContent().items;
    const total = allItems.length;
    return {
      settings: getDefaultFAQContent().settings,
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
    const allItems = mergeFAQs(coerceItems(itemRows));
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
    console.error('Failed to read FAQ content for admin:', error);
    const fallback = getDefaultFAQContent();
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

export async function ensureFAQSheets(spreadsheetId: string) {
  await Promise.all([
    ensureSheetWithHeaders(spreadsheetId, SETTINGS_SHEET, [
      ...FAQ_SETTINGS_HEADERS,
    ]),
    ensureSheetWithHeaders(spreadsheetId, ITEMS_SHEET, [...FAQ_ITEM_HEADERS]),
  ]);
}

export async function getFAQSettingsRowId(
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
export type { FAQContent, FAQSettings, FAQ };
export { FAQ_SETTINGS_HEADERS, FAQ_ITEM_HEADERS };