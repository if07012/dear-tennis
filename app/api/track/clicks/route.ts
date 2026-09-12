// ============================================
// /api/track/clicks — public click-event ingest
// ============================================
//
// POST { events: TrackedClick[] }  → { ok: true }
//
// No auth (click data is non-personal per PRD §12). ip / browser /
// deviceType come from request headers, never the body. Bot user-agents are
// silently accepted but not stored.

import { NextResponse } from 'next/server';
import { BOT_UA_REGEX, type TrackedClick } from '@/data/click-tracking-types';
import { recordClicks } from '@/lib/click-tracking-store';

const MAX_EVENTS = 50;
const RATE_EVENTS_PER_MINUTE = 200; // per IP, best-effort (see below)

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function cap(value: unknown, max: number): string {
  const s = typeof value === 'string' ? value.trim() : '';
  return s.length > max ? s.slice(0, max) : s;
}

/** Returns null for events that are unusable (bad clickedAt / no button). */
function sanitizeEvent(raw: unknown): TrackedClick | null {
  if (!raw || typeof raw !== 'object') return null;
  const e = raw as Record<string, unknown>;

  const clickedAt = typeof e.clickedAt === 'string' ? e.clickedAt : '';
  if (!clickedAt || Number.isNaN(Date.parse(clickedAt))) return null;

  const elementType =
    e.elementType === 'a' || e.elementType === 'button' ? e.elementType : 'other';
  const targetUrl = cap(e.targetUrl, 500);
  const fallbackText = targetUrl || 'Ikon';
  const buttonText = cap(e.buttonText, 200) || fallbackText;

  return {
    buttonText,
    elementType,
    targetUrl,
    pageUrl: cap(e.pageUrl, 200),
    activityTitle: cap(e.activityTitle, 200),
    clickedAt,
    timezone: cap(e.timezone, 64),
    referrerUrl: cap(e.referrerUrl, 200),
    userName: cap(e.userName, 100) || undefined,
    userEmail: cap(e.userEmail, 200) || undefined,
  };
}

// Best-effort in-memory rate limit. Serverless instances each hold their own
// map, so this is an advisory cap against runaway clients, not a hard wall.
// ponytail: swap for Redis/Upstash if a real abuse vector appears.
const g = globalThis as unknown as {
  __dt_click_rate__?: Map<string, { count: number; resetAt: number }>;
};

function takeRateBudget(ip: string, events: number): boolean {
  if (!g.__dt_click_rate__) g.__dt_click_rate__ = new Map();
  const map = g.__dt_click_rate__;
  const now = Date.now();

  if (map.size > 1000) {
    for (const [key, entry] of map) {
      if (entry.resetAt <= now) map.delete(key);
    }
  }

  const entry = map.get(ip);
  if (!entry || entry.resetAt <= now) {
    map.set(ip, { count: events, resetAt: now + 60_000 });
    return events <= RATE_EVENTS_PER_MINUTE;
  }
  if (entry.count + events > RATE_EVENTS_PER_MINUTE) return false;
  entry.count += events;
  return true;
}

export async function POST(request: Request): Promise<Response> {
  let body: { events?: unknown };
  try {
    body = (await request.json()) as { events?: unknown };
  } catch {
    return badRequest('Invalid JSON');
  }

  const rawEvents = body.events;
  if (!Array.isArray(rawEvents) || rawEvents.length === 0) {
    return badRequest('events must be a non-empty array');
  }
  if (rawEvents.length > MAX_EVENTS) {
    return badRequest(`events exceeds max of ${MAX_EVENTS}`);
  }

  const userAgent = request.headers.get('user-agent') ?? '';
  if (BOT_UA_REGEX.test(userAgent)) {
    // Silently accept — bots get the same response shape, zero info leak.
    return NextResponse.json({ ok: true });
  }

  const events = rawEvents
    .map(sanitizeEvent)
    .filter((e): e is TrackedClick => e !== null);
  if (events.length === 0) return badRequest('no valid events');

  const ip =
    (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() ||
    request.headers.get('x-real-ip')?.trim() ||
    'unknown';

  if (!takeRateBudget(ip, events.length)) {
    return NextResponse.json({ error: 'Too many events' }, { status: 429 });
  }

  await recordClicks(events, { ip, userAgent });
  return NextResponse.json({ ok: true });
}
