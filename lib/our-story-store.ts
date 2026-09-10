// ============================================
// OUR STORY DATA STORE
// ============================================
// Reads/writes the "Our Story" (About section) settings from a Google Sheet.
// Reuses the existing helpers in app/lib/supabase.ts.
//
// Sheet schema (created on first save):
//   our_story_settings: id,tag,title,subtitle,lead,body,closing,image,imageAlt,updatedAt

import {
  ensureSheetWithHeaders,
  getSpreadsheetId,
  listRowsBySheet,
} from '@/app/lib/supabase';
import {
  OUR_STORY_SETTINGS_HEADERS,
  type OurStorySettings,
} from '@/data/our-story-types';

const SETTINGS_SHEET = 'our_story_settings';
const SETTINGS_ROW_ID = 'current';

const OUR_STORY_CACHE_KEY = 'our-story:content';

function getCacheStore() {
  const g = globalThis as unknown as {
    __our_story_cache__?: Map<string, OurStorySettings>;
  };
  if (!g.__our_story_cache__) {
    g.__our_story_cache__ = new Map<string, OurStorySettings>();
  }
  return g.__our_story_cache__;
}

export function clearOurStoryContentCache() {
  getCacheStore().clear();
}

export function getDefaultOurStoryContent(): OurStorySettings {
  const now = new Date().toISOString();
  return {
    id: SETTINGS_ROW_ID,
    tag: 'Our Story',
    title: 'Built on Love for the Game',
    subtitle: '',
    lead:
      'Dear Tennis started with a simple belief: tennis is more than just hitting balls over a net. It’s about connection, growth, and shared moments that last a lifetime.',
    body:
      'Founded in 2020, we’ve grown from a small group of enthusiasts to a thriving community of players, coaches, and fans who share one common passion. Whether you’re picking up a racket for the first time or you’ve been playing for decades, there’s a place for you here.',
    closing:
      'We organize regular meetups, tournaments, training sessions, and social events that bring people together through the beautiful game of tennis.',
    image:
      'https://images.unsplash.com/photo-1661474974379-0f24bee86ce0?q=80&w=800&auto=format&fit=crop',
    imageAlt: 'Dear Tennis Community',
    updatedAt: now,
  };
}

function coerceSettings(rows: Record<string, unknown>[]): OurStorySettings {
  const found = rows.find(
    (r) => String(r.id ?? '').trim() === SETTINGS_ROW_ID,
  );
  if (!found) return getDefaultOurStoryContent();
  const defaults = getDefaultOurStoryContent();
  return {
    id: SETTINGS_ROW_ID,
    tag: String(found.tag ?? defaults.tag),
    title: String(found.title ?? defaults.title),
    subtitle: String(found.subtitle ?? ''),
    lead: String(found.lead ?? defaults.lead),
    body: String(found.body ?? defaults.body),
    closing: String(found.closing ?? defaults.closing),
    image: String(found.image ?? defaults.image),
    imageAlt: String(found.imageAlt ?? defaults.imageAlt),
    updatedAt: String(found.updatedAt ?? new Date().toISOString()),
  };
}

async function fetchFromSheet(spreadsheetId: string): Promise<OurStorySettings> {
  const rows = await listRowsBySheet(spreadsheetId, SETTINGS_SHEET);
  return coerceSettings(rows);
}

export async function getOurStoryContent(): Promise<OurStorySettings> {
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) return getDefaultOurStoryContent();

  const cacheKey = `${OUR_STORY_CACHE_KEY}:${spreadsheetId}`;
  const cached = getCacheStore().get(cacheKey);
  if (cached) return cached;

  try {
    const settings = await fetchFromSheet(spreadsheetId);
    getCacheStore().set(cacheKey, settings);
    return settings;
  } catch (error) {
    console.error('Failed to read our-story content, falling back to defaults:', error);
    return getDefaultOurStoryContent();
  }
}

export async function getOurStoryContentForAdmin(): Promise<OurStorySettings> {
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) return getDefaultOurStoryContent();
  try {
    return await fetchFromSheet(spreadsheetId);
  } catch (error) {
    console.error('Failed to read our-story content for admin:', error);
    return getDefaultOurStoryContent();
  }
}

export async function ensureOurStorySheets(spreadsheetId: string) {
  await ensureSheetWithHeaders(spreadsheetId, SETTINGS_SHEET, [...OUR_STORY_SETTINGS_HEADERS]);
}

export async function getOurStorySettingsRowId(
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

export { SETTINGS_SHEET as OUR_STORY_SHEET, SETTINGS_ROW_ID };
export type { OurStorySettings };
export { OUR_STORY_SETTINGS_HEADERS };
