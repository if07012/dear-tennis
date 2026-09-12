// ============================================
// CLICK TRACKING DATA STORE
// ============================================
// Writes click events (from /api/track/clicks) and reads them back for the
// admin dashboard at /admin/clicks. Uses the filtered shim helpers instead
// of read-all + JS-sort because click_events is append-only and unbounded.

import {
  CLICK_EVENTS_SHEET,
  CLICK_SORT_COLUMNS,
  detectBrowser,
  detectDevice,
  type ClickEvent,
  type ClicksAdminPayload,
  type ClickSortColumn,
  type ClickStats,
  type TrackedClick,
} from '@/data/click-tracking-types';
import {
  getSpreadsheetId,
  insertRowsBatch,
  queryRowsBySheet,
  type SheetFilter,
} from '@/app/lib/supabase';

function isAdminEmail(email: string | null | undefined): boolean {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!adminEmail || !email) return false;
  return email.trim().toLowerCase() === adminEmail;
}

export { isAdminEmail };

function coerceClickEvent(r: Record<string, unknown>, idx: number): ClickEvent {
  const str = (v: unknown) => (typeof v === 'string' ? v : String(v ?? ''));
  return {
    id: str(r.id) || `fallback-${idx}`,
    buttonText: str(r.buttonText),
    elementType: (['a', 'button', 'other'] as const).includes(
      str(r.elementType) as ClickEvent['elementType'],
    )
      ? (str(r.elementType) as ClickEvent['elementType'])
      : 'other',
    targetUrl: str(r.targetUrl),
    pageUrl: str(r.pageUrl),
    activityTitle: str(r.activityTitle),
    clickedAt: str(r.clickedAt),
    timezone: str(r.timezone),
    referrerUrl: str(r.referrerUrl),
    userName: str(r.userName),
    userEmail: str(r.userEmail),
    ip: str(r.ip),
    browser: str(r.browser),
    deviceType: (['mobile', 'tablet', 'desktop', 'other'] as const).includes(
      str(r.deviceType) as ClickEvent['deviceType'],
    )
      ? (str(r.deviceType) as ClickEvent['deviceType'])
      : 'other',
  };
}

/**
 * Insert a batch of tracked clicks. Never throws — analytics must not break
 * the site; failures are logged and swallowed (the client doesn't retry).
 */
export async function recordClicks(
  events: TrackedClick[],
  meta: { ip: string; userAgent: string },
): Promise<{ inserted: number }> {
  if (events.length === 0) return { inserted: 0 };

  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) return { inserted: 0 };

  const browser = detectBrowser(meta.userAgent);
  const deviceType = detectDevice(meta.userAgent);
  const rows = events.map((e) => ({
    id: crypto.randomUUID(),
    buttonText: e.buttonText,
    elementType: e.elementType,
    targetUrl: e.targetUrl,
    pageUrl: e.pageUrl,
    activityTitle: e.activityTitle,
    clickedAt: e.clickedAt,
    timezone: e.timezone,
    referrerUrl: e.referrerUrl,
    userName: e.userName ?? '',
    userEmail: e.userEmail ?? '',
    ip: meta.ip,
    browser,
    deviceType,
  }));

  try {
    const result = await insertRowsBatch(spreadsheetId, CLICK_EVENTS_SHEET, rows);
    return { inserted: result.count };
  } catch (error) {
    console.error('Failed to insert click events:', error);
    return { inserted: 0 };
  }
}

function emptyStats(): ClickStats {
  return {
    totalToday: 0,
    lastMinute: 0,
    total7d: 0,
    topButtons7d: [],
    byBrowser: {},
    byDevice: {},
    byTimezone: {},
  };
}

/**
 * Aggregates from the most recent rows in JS. ponytail: fetch-2000-reduce is
 * fine to ~50k rows; past that add SQL daily aggregation (PRD FR-012) or a
 * materialized view.
 */
async function computeStats(): Promise<ClickStats> {
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) return emptyStats();

  try {
    const { rows } = await queryRowsBySheet(spreadsheetId, CLICK_EVENTS_SHEET, {
      orderBy: 'clickedAt',
      ascending: false,
      limit: 2000,
    });
    const now = Date.now();
    const minuteAgo = now - 60_000;
    const dayAgo = now - 24 * 60 * 60_000;
    const weekAgo = now - 7 * 24 * 60 * 60_000;

    const stats = emptyStats();
    const buttonCounts = new Map<string, number>();

    for (const r of rows) {
      const t = Date.parse(String(r.clickedAt ?? ''));
      if (!Number.isFinite(t)) continue;
      if (t >= dayAgo) stats.totalToday += 1;
      if (t >= minuteAgo) stats.lastMinute += 1;
      if (t < weekAgo) continue; // rows are newest-first; nothing older counts
      stats.total7d += 1;

      const buttonText = String(r.buttonText ?? '');
      if (buttonText) buttonCounts.set(buttonText, (buttonCounts.get(buttonText) ?? 0) + 1);
      const browser = String(r.browser ?? 'Lain') || 'Lain';
      stats.byBrowser[browser] = (stats.byBrowser[browser] ?? 0) + 1;
      const device = String(r.deviceType ?? 'other') || 'other';
      stats.byDevice[device] = (stats.byDevice[device] ?? 0) + 1;
      const tz = String(r.timezone ?? 'Tidak diketahui') || 'Tidak diketahui';
      stats.byTimezone[tz] = (stats.byTimezone[tz] ?? 0) + 1;
    }

    stats.topButtons7d = [...buttonCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([buttonText, count]) => ({ buttonText, count }));

    return stats;
  } catch (error) {
    console.error('Failed to compute click stats:', error);
    return emptyStats();
  }
}

/**
 * Read clicks for the admin dashboard with filters, sorting and pagination.
 * `q` searches across buttonText / targetUrl / userName / ip (ilike, OR).
 */
export async function getClicksForAdmin(args?: {
  page?: number;
  pageSize?: number;
  q?: string;
  from?: string; // ISO, gte clickedAt
  to?: string; // ISO, lte clickedAt
  sort?: ClickSortColumn;
  dir?: 'asc' | 'desc';
}): Promise<ClicksAdminPayload> {
  const page = Math.max(1, args?.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, args?.pageSize ?? 20));
  const sort: ClickSortColumn = CLICK_SORT_COLUMNS.includes(
    (args?.sort ?? 'clickedAt') as ClickSortColumn,
  )
    ? (args?.sort as ClickSortColumn)
    : 'clickedAt';
  const dir = args?.dir === 'asc' ? 'asc' : 'desc';
  const offset = (page - 1) * pageSize;

  const spreadsheetId = getSpreadsheetId();
  const fallback: ClicksAdminPayload = {
    clicks: [],
    total: 0,
    page,
    totalPages: 1,
    stats: emptyStats(),
  };
  if (!spreadsheetId) return { ...fallback, stats: await computeStats() };

  // Strip wildcards so user input can't smuggle extra pattern matching.
  const q = args?.q?.trim().replace(/%/g, '').replace(/_/g, '') ?? '';

  const filters: SheetFilter[] = [];
  if (args?.from) filters.push({ op: 'gte', column: 'clickedAt', value: args.from });
  if (args?.to) filters.push({ op: 'lte', column: 'clickedAt', value: args.to });

  try {
    const [result, stats] = await Promise.all([
      queryRowsBySheet(spreadsheetId, CLICK_EVENTS_SHEET, {
        filters,
        orQuery: q
          ? `buttonText.ilike.%${q}%,targetUrl.ilike.%${q}%,userName.ilike.%${q}%,ip.ilike.%${q}%`
          : undefined,
        orderBy: sort,
        ascending: dir === 'asc',
        offset,
        limit: pageSize,
        exactCount: true,
      }),
      computeStats(),
    ]);

    const clicks = result.rows.map(coerceClickEvent);
    const total = result.total ?? clicks.length;
    return {
      clicks,
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      stats,
    };
  } catch (error) {
    console.error('Failed to read click events for admin:', error);
    return { ...fallback, stats: emptyStats() };
  }
}
