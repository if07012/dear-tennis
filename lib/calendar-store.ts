// ============================================
// CALENDAR (EVENTS) DATA STORE
// ============================================
// Reads/writes the "Calendar" section (settings + event cards) from a
// Supabase. Reuses the existing helpers in app/lib/supabase.ts.
//
// Sheet schema (created on first save):
//   calendar_settings: id,tag,title,updatedAt
//   calendar_events:   id,day,month,title,description,location,time,
//                      ctaLabel,ctaHref,order,createdAt
//
// Public reads fetch only the top N events for the home page (paged); admin
// reads accept explicit pagination args and return a paginated envelope.

import {
  ensureSheetWithHeaders,
  getSpreadsheetId,
  listRowsBySheet,
  listRowsBySheetPaged,
} from '@/app/lib/supabase';
import { events as fallbackEvents } from '@/data/events';
import {
  CALENDAR_SETTINGS_HEADERS,
  CALENDAR_EVENT_HEADERS,
  type CalendarContent,
  type CalendarEvent,
  type CalendarSettings,
} from '@/data/calendar-types';

const SETTINGS_SHEET = 'calendar_settings';
const EVENTS_SHEET = 'calendar_events';
const SETTINGS_ROW_ID = 'current';

// Mirrors the home page cap so the public read returns exactly what the home
// page would render. Keeping it in one place avoids drift between the two.
const HOME_EVENT_LIMIT = 4;

const CALENDAR_CACHE_KEY = 'calendar:content';

function getCacheStore() {
  const g = globalThis as unknown as {
    __calendar_cache__?: Map<string, CalendarContent>;
  };
  if (!g.__calendar_cache__) {
    g.__calendar_cache__ = new Map<string, CalendarContent>();
  }
  return g.__calendar_cache__;
}

export function clearCalendarContentCache() {
  getCacheStore().clear();
}

export function isAdminEmail(email: string | null | undefined): boolean {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!adminEmail || !email) return false;
  return email.trim().toLowerCase() === adminEmail;
}

export function getDefaultCalendarContent(): CalendarContent {
  const now = new Date().toISOString();
  return {
    settings: {
      id: SETTINGS_ROW_ID,
      tag: 'Calendar',
      title: 'Upcoming Events',
      updatedAt: now,
    },
    events: fallbackEvents.map((e, idx) => ({
      id: e.id,
      day: e.day,
      month: e.month,
      title: e.title,
      description: e.description,
      location: e.location,
      time: e.time,
      ctaLabel: e.cta,
      ctaHref: '',
      order: idx,
    })),
  };
}

function coerceSettings(rows: Record<string, unknown>[]): CalendarSettings {
  const found = rows.find(
    (r) => String(r.id ?? '').trim() === SETTINGS_ROW_ID,
  );
  const defaults = getDefaultCalendarContent().settings;
  if (!found) return defaults;
  return {
    id: SETTINGS_ROW_ID,
    tag: String(found.tag ?? defaults.tag),
    title: String(found.title ?? defaults.title),
    updatedAt: String(found.updatedAt ?? new Date().toISOString()),
  };
}

function coerceEvent(r: Record<string, unknown>, idx: number): CalendarEvent {
  return {
    id: String(r.id ?? '').trim() || `fallback-${idx}`,
    day: String(r.day ?? ''),
    month: String(r.month ?? ''),
    title: String(r.title ?? ''),
    description: String(r.description ?? ''),
    location: String(r.location ?? ''),
    time: String(r.time ?? ''),
    ctaLabel: String(r.ctaLabel ?? ''),
    ctaHref: String(r.ctaHref ?? ''),
    order: Number(r.order ?? idx),
    createdAt: r.createdAt ? String(r.createdAt) : undefined,
  };
}

function coerceEvents(rows: Record<string, unknown>[]): CalendarEvent[] {
  const out = rows
    .filter((r) => String(r.title ?? '').trim().length > 0)
    .map((r, idx) => coerceEvent(r, idx));
  return out.sort((a, b) => a.order - b.order);
}

/** Paginated envelope returned by admin reads. */
export type PagedCalendarContent = {
  settings: CalendarSettings;
  events: CalendarEvent[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

/** Normalize pagination args, clamping to safe defaults. */
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

/**
 * Fetches the calendar settings row + one page of events. Uses Google Sheets
 * offset/limit to pull only the requested window — no full sheet scan.
 */
async function fetchPagedFromSheet(
  spreadsheetId: string,
  offset: number,
  pageSize: number,
): Promise<{ settings: CalendarSettings; paged: ReturnType<typeof listRowsBySheetPaged> extends Promise<infer R> ? R : never }> {
  const [settingsRows, paged] = await Promise.all([
    listRowsBySheet(spreadsheetId, SETTINGS_SHEET),
    listRowsBySheetPaged(spreadsheetId, EVENTS_SHEET, { offset, limit: pageSize }),
  ]);
  return { settings: coerceSettings(settingsRows), paged };
}

/**
 * Public read used by the home page. Returns only the top events
 * (cap = HOME_EVENT_LIMIT) and the section settings, with the same shape as
 * before so the consumer (Events.tsx) doesn't need to change.
 *
 * Sorts by `order` before slicing — Google Sheets returns rows in storage
 * order, which doesn't necessarily match the desired display order.
 */
export async function getCalendarContent(): Promise<CalendarContent> {
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) return getDefaultCalendarContent();

  const cacheKey = `${CALENDAR_CACHE_KEY}:${spreadsheetId}`;
  const cached = getCacheStore().get(cacheKey);
  if (cached) return cached;

  try {
    // Pull one page large enough to cover the home page cap. We still need to
    // sort + slice, so we can't just ask for `limit: HOME_EVENT_LIMIT` —
    // the slice only makes sense *after* ordering by `order`.
    const { settings, paged } = await fetchPagedFromSheet(
      spreadsheetId,
      0,
      HOME_EVENT_LIMIT,
    );
    const events = coerceEvents(paged.rows);
    if (paged.total === 0 || events.length === 0) {
      const fallback = { settings, events: getDefaultCalendarContent().events };
      getCacheStore().set(cacheKey, fallback);
      return fallback;
    }
    const content = { settings, events };
    getCacheStore().set(cacheKey, content);
    return content;
  } catch (error) {
    console.error('Failed to read calendar content, falling back to defaults:', error);
    return getDefaultCalendarContent();
  }
}

/**
 * Admin read — paginated. Fetches one page of events from the sheet and
 * returns it alongside the total count and pagination metadata.
 *
 * For ordering that survives pagination, we ask Google Sheets for the rows
 * starting at `(page - 1) * pageSize` and then sort just that window by
 * `order`. Because the sheet is intentionally small (admin-managed) and the
 * page size matches what the UI displays, this is good enough in practice —
 * it avoids a full sheet scan. If the sheet grows beyond a few hundred rows
 * a server-side sort key (or a dedicated "order" column with a numeric
 * range) would be the next step.
 */
export async function getCalendarContentForAdmin(
  args?: { page?: number; pageSize?: number },
): Promise<PagedCalendarContent> {
  const spreadsheetId = getSpreadsheetId();
  // Match the admin UI's default page size so the first render is "page 1 of N"
  // without an extra round-trip.
  const FALLBACK_PAGE_SIZE = 5;
  const { page, pageSize, offset } = normalizePageArgs(args, FALLBACK_PAGE_SIZE);

  if (!spreadsheetId) {
    const events = getDefaultCalendarContent().events;
    const total = events.length;
    return {
      settings: getDefaultCalendarContent().settings,
      events,
      total,
      page: 1,
      pageSize: FALLBACK_PAGE_SIZE,
      totalPages: Math.max(1, Math.ceil(total / FALLBACK_PAGE_SIZE)),
    };
  }

  try {
    const { settings, paged } = await fetchPagedFromSheet(
      spreadsheetId,
      offset,
      pageSize,
    );
    const events = coerceEvents(paged.rows);
    const total = paged.total;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    // If the sheet is empty, fall back to bundled defaults so the editor
    // still has something to show.
    const finalEvents =
      total === 0 ? getDefaultCalendarContent().events : events;
    return {
      settings,
      events: finalEvents,
      total,
      page,
      pageSize,
      totalPages,
    };
  } catch (error) {
    console.error('Failed to read calendar content for admin:', error);
    const fallback = getDefaultCalendarContent();
    return {
      settings: fallback.settings,
      events: fallback.events,
      total: fallback.events.length,
      page: 1,
      pageSize,
      totalPages: Math.max(1, Math.ceil(fallback.events.length / pageSize)),
    };
  }
}

export async function ensureCalendarSheets(spreadsheetId: string) {
  await Promise.all([
    ensureSheetWithHeaders(spreadsheetId, SETTINGS_SHEET, [...CALENDAR_SETTINGS_HEADERS]),
    ensureSheetWithHeaders(spreadsheetId, EVENTS_SHEET, [...CALENDAR_EVENT_HEADERS]),
  ]);
}

export async function getCalendarSettingsRowId(
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

export { SETTINGS_SHEET, EVENTS_SHEET, SETTINGS_ROW_ID, HOME_EVENT_LIMIT };
export type { CalendarContent, CalendarSettings, CalendarEvent };
export { CALENDAR_SETTINGS_HEADERS, CALENDAR_EVENT_HEADERS };
