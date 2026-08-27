// ============================================
// ACTIVITIES DATA STORE
// ============================================
// Reads/writes the "Activities & Programs" section (settings + activity
// cards) from a Google Sheet. Reuses the existing helpers in
// app/lib/googleSheets.ts.
//
// Sheet schema (created on first save):
//   activities_settings: id,tag,title,subtitle,updatedAt
//   activities_items:    id,category,title,description,image,duration,groupSize,
//                        location,time,order,createdAt

import {
  ensureSheetWithHeaders,
  getGoogleSheet,
  listRowsBySheet,
} from '@/app/lib/googleSheets';
import { activities as fallbackActivities } from '@/data/activities';
import {
  ACTIVITIES_SETTINGS_HEADERS,
  ACTIVITY_HEADERS,
  type ActivitiesContent,
  type ActivitiesSettings,
  type ActivityCategory,
  type ActivityItem,
} from '@/data/activities-types';

const SETTINGS_SHEET = 'activities_settings';
const ITEMS_SHEET = 'activities_items';
const SETTINGS_ROW_ID = 'current';

const ACTIVITIES_CACHE_KEY = 'activities:content';

function getCacheStore() {
  const g = globalThis as unknown as {
    __activities_cache__?: Map<string, ActivitiesContent>;
  };
  if (!g.__activities_cache__) {
    g.__activities_cache__ = new Map<string, ActivitiesContent>();
  }
  return g.__activities_cache__;
}

export function clearActivitiesContentCache() {
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

export function getDefaultActivitiesContent(): ActivitiesContent {
  const now = new Date().toISOString();
  return {
    settings: {
      id: SETTINGS_ROW_ID,
      tag: 'What We Do',
      title: 'Activities & Programs',
      subtitle: 'Something for everyone, from beginners to advanced players',
      updatedAt: now,
    },
    activities: fallbackActivities.map((a, idx) => ({
      id: a.id,
      category: a.category,
      title: a.title,
      description: a.description,
      image: a.image,
      duration: a.duration,
      groupSize: a.groupSize,
      location: '',
      time: '',
      order: idx,
    })),
  };
}

function coerceSettings(rows: Record<string, unknown>[]): ActivitiesSettings {
  const found = rows.find(
    (r) => String(r.id ?? '').trim() === SETTINGS_ROW_ID,
  );
  const defaults = getDefaultActivitiesContent().settings;
  if (!found) return defaults;
  return {
    id: SETTINGS_ROW_ID,
    tag: String(found.tag ?? defaults.tag),
    title: String(found.title ?? defaults.title),
    subtitle: String(found.subtitle ?? defaults.subtitle),
    updatedAt: String(found.updatedAt ?? new Date().toISOString()),
  };
}

function coerceItem(r: Record<string, unknown>, idx: number): ActivityItem {
  const category = String(r.category ?? 'training') as ActivityCategory;
  const validCategory: ActivityCategory =
    category === 'training' || category === 'social' || category === 'competitive'
      ? category
      : 'training';
  return {
    id: String(r.id ?? '').trim() || `fallback-${idx}`,
    category: validCategory,
    title: String(r.title ?? ''),
    description: String(r.description ?? ''),
    image: String(r.image ?? ''),
    duration: String(r.duration ?? ''),
    groupSize: String(r.groupSize ?? ''),
    location: String(r.location ?? ''),
    time: String(r.time ?? ''),
    order: Number(r.order ?? idx),
    createdAt: r.createdAt ? String(r.createdAt) : undefined,
  };
}

function coerceItems(rows: Record<string, unknown>[]): ActivityItem[] {
  const out = rows
    .filter((r) => String(r.title ?? '').trim().length > 0)
    .map((r, idx) => coerceItem(r, idx));
  return out.sort((a, b) => a.order - b.order);
}

async function fetchFromSheet(spreadsheetId: string): Promise<ActivitiesContent> {
  const [settingsRows, itemRows] = await Promise.all([
    listRowsBySheet(spreadsheetId, SETTINGS_SHEET),
    listRowsBySheet(spreadsheetId, ITEMS_SHEET),
  ]);
  const settings = coerceSettings(settingsRows);
  const activities = coerceItems(itemRows);
  if (activities.length === 0) {
    return { settings, activities: getDefaultActivitiesContent().activities };
  }
  return { settings, activities };
}

export async function getActivitiesContent(): Promise<ActivitiesContent> {
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) return getDefaultActivitiesContent();

  const cacheKey = `${ACTIVITIES_CACHE_KEY}:${spreadsheetId}`;
  const cached = getCacheStore().get(cacheKey);
  if (cached) return cached;

  try {
    const content = await fetchFromSheet(spreadsheetId);
    getCacheStore().set(cacheKey, content);
    return content;
  } catch (error) {
    console.error('Failed to read activities content, falling back to defaults:', error);
    return getDefaultActivitiesContent();
  }
}

export async function getActivitiesContentForAdmin(): Promise<ActivitiesContent> {
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) return getDefaultActivitiesContent();
  try {
    return await fetchFromSheet(spreadsheetId);
  } catch (error) {
    console.error('Failed to read activities content for admin:', error);
    return getDefaultActivitiesContent();
  }
}

export async function ensureActivitiesSheets(spreadsheetId: string) {
  await Promise.all([
    ensureSheetWithHeaders(spreadsheetId, SETTINGS_SHEET, [...ACTIVITIES_SETTINGS_HEADERS]),
    ensureSheetWithHeaders(spreadsheetId, ITEMS_SHEET, [...ACTIVITY_HEADERS]),
  ]);
}

export async function getActivitiesSettingsRowId(
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
export type { ActivitiesContent, ActivitiesSettings, ActivityItem, ActivityCategory };
export { ACTIVITIES_SETTINGS_HEADERS, ACTIVITY_HEADERS };
