// ============================================
// CLICK TRACKING TYPES
// ============================================
// Browser-safe shape of one tracked click. Mirrors the `click_events` table
// schema. Keep this file free of server-only imports (supabase, node:*) so
// client components can import it directly.
//
// ip / browser / deviceType are NOT sent by the client — the track API
// derives them from request headers so they can't be spoofed via the body.

export const CLICK_EVENTS_SHEET = 'click_events';

/** What the client tracker sends (subset of a full row). */
export type TrackedClick = {
  buttonText: string; // ≤ 200 chars
  elementType: 'a' | 'button' | 'other';
  targetUrl: string; // ≤ 500
  pageUrl: string; // ≤ 200
  activityTitle: string; // ≤ 200 (tracking is activity-detail-only)
  clickedAt: string; // UTC ISO-8601 (lexicographically sortable)
  timezone: string; // IANA, e.g. "Asia/Jakarta"
  referrerUrl: string; // ≤ 200
  userName?: string;
  userEmail?: string;
};

/** Full row as read back by the admin dashboard. */
export type ClickEvent = TrackedClick & {
  id: string;
  ip: string;
  browser: string;
  deviceType: 'mobile' | 'tablet' | 'desktop' | 'other';
};

export type ClickStats = {
  totalToday: number;
  lastMinute: number;
  total7d: number;
  topButtons7d: { buttonText: string; count: number }[]; // top 5
  byBrowser: Record<string, number>;
  byDevice: Record<string, number>;
  byTimezone: Record<string, number>;
};

export type ClicksAdminPayload = {
  clicks: ClickEvent[];
  total: number;
  page: number;
  totalPages: number;
  stats: ClickStats;
};

export const CLICK_EVENT_HEADERS = [
  'id',
  'buttonText',
  'elementType',
  'targetUrl',
  'pageUrl',
  'activityTitle',
  'clickedAt',
  'timezone',
  'referrerUrl',
  'userName',
  'userEmail',
  'ip',
  'browser',
  'deviceType',
] as const;

/** Columns the admin dashboard may sort by (shared by store + client). */
export const CLICK_SORT_COLUMNS = ['clickedAt', 'buttonText', 'targetUrl'] as const;
export type ClickSortColumn = (typeof CLICK_SORT_COLUMNS)[number];

// Known bot/crawler user agents — their clicks are dropped, never stored.
export const BOT_UA_REGEX =
  /googlebot|bingbot|slurp|baiduspider|duckduckbot|bot|crawl|spider/i;

export function detectBrowser(ua: string): string {
  if (/edg\//i.test(ua)) return 'Edge';
  if (/opr\//i.test(ua)) return 'Opera';
  if (/firefox\//i.test(ua)) return 'Firefox';
  if (/chrome\//i.test(ua)) return 'Chrome';
  if (/safari\//i.test(ua)) return 'Safari';
  return 'Lain';
}

export function detectDevice(ua: string): ClickEvent['deviceType'] {
  if (/ipad|tablet/i.test(ua)) return 'tablet';
  if (/mobi|android.*mobile|iphone/i.test(ua)) return 'mobile';
  if (/mobile/i.test(ua)) return 'mobile';
  return 'desktop';
}
