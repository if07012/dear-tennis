// ============================================
// /api/profile/joined-activities
// ============================================
//
// GET → { events: FilterableEvent[] }
//
// Returns the activities the current user has joined (approved signups),
// reshaped into the FilterableEvent shape consumed by the profile page's
// "Event History" section. Each entry is sourced from `ActivityItem` (the
// admin-editable catalog) plus the user's signup row, so:
//   - title, location, image come from the activity catalog
//   - `date` falls back to the signup decision timestamp (approvedAt) or
//     the request timestamp, since `ActivityItem` itself is undated
//   - `type` is mapped from `ActivityCategory` to the EventType union
//     (training -> 'training', social -> 'open', competitive -> 'tournament')
//   - `photos` is a single-element array with the activity image so the
//     existing card layout still renders
//   - `matches` is attached from the `activity_matches` sheet, filtered to
//     rows where the requesting user is on side A or side B. Score is
//     reconstructed from per-set scores in viewer-perspective order so
//     `6-4, 3-6, 6-3` always means the viewer's number first.
//
// Only signups with status 'approved' are included. Pending / rejected
// signups are intentionally hidden — the user hasn't actually joined yet.

import { NextResponse } from 'next/server';
import { getSpreadsheetId, listRowsBySheet } from '@/app/lib/supabase';
import { isSignupStatus } from '@/data/activity-signups-types';
import { getActivitiesContent } from '@/lib/activities-store';
import { isAdminEmail } from '@/lib/admin';
import type { EventType, FilterableEvent, FunmatchMatch, MatchResult } from '@/data/profile-types';
import type { ActivityCategory, ActivityItem } from '@/data/activities-types';
import { listMatchesForActivity, type MatchRecord } from '@/app/lib/matches-store';

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

function serverError(message: string) {
  return NextResponse.json({ error: message }, { status: 500 });
}

function getRequesterEmail(request: Request): string | null {
  const header = request.headers.get('x-auth-email');
  return header && header.trim().length > 0 ? header.trim().toLowerCase() : null;
}

const CATEGORY_TO_EVENT_TYPE: Record<ActivityCategory, EventType> = {
  training: 'training',
  social: 'open',
  competitive: 'tournament',
};

const CATEGORY_EMOJI: Record<ActivityCategory, string> = {
  training: '🎯',
  social: '🤝',
  competitive: '🏆',
};

/**
 * Convert one admin-stored match into the viewer-facing FunmatchMatch shape.
 * Returns null if the viewer isn't on either side (defensive — caller already
 * pre-filters, but this keeps the conversion self-contained).
 */
function toFunmatchMatch(
  rec: MatchRecord,
  viewerEmail: string,
  nameOf: (email: string) => string,
): FunmatchMatch | null {
  const viewer = viewerEmail.toLowerCase();
  const a = rec.sideA.split(',').map((s) => s.trim()).filter(Boolean);
  const b = rec.sideB.split(',').map((s) => s.trim()).filter(Boolean);
  const viewerOnA = a.includes(viewer);
  const viewerOnB = b.includes(viewer);
  if (!viewerOnA && !viewerOnB) return null;
  const mySide = viewerOnA ? a : b;
  const oppSide = viewerOnA ? b : a;

  const pairs: Array<[number, number]> = [
    [rec.set1A, rec.set1B],
    [rec.set2A, rec.set2B],
    [rec.set3A, rec.set3B],
  ];
  const sets = pairs
    .filter(([x, y]) => x > 0 || y > 0)
    .map(([x, y]) => (viewerOnA ? `${x}-${y}` : `${y}-${x}`));
  const score = sets.join(', ') || '-';

  let result: MatchResult = 'draw';
  if (rec.winner === 'A') result = viewerOnA ? 'win' : 'loss';
  else if (rec.winner === 'B') result = viewerOnA ? 'loss' : 'win';

  return {
    score,
    isDoubles: rec.isDoubles,
    partners: mySide.filter((e) => e !== viewer).map(nameOf),
    opponent: oppSide.map(nameOf).join(' & '),
    result,
  };
}

const MANUAL_EMAIL_PREFIX = '__manual_';
const MANUAL_EMAIL_DOMAIN = 'guest.local';

function slugFromManualEmail(email: string): string | null {
  if (!email.startsWith(MANUAL_EMAIL_PREFIX)) return null;
  const local = email.slice(MANUAL_EMAIL_PREFIX.length).split('@')[0];
  return local || null;
}

type SignupRow = Record<string, unknown>;

/**
 * Build a per-activity `nameOf` lookup. Approved signups contribute their
 * user name; any side email that isn't in the signup list falls back to the
 * slug of a manual placeholder email (admin-typed name), then to the email
 * itself as a last resort so the renderer never prints `undefined`.
 */
function buildNameOf(
  rows: SignupRow[],
  activityId: string,
  viewerEmail: string,
): (email: string) => string {
  const map = new Map<string, string>();
  for (const raw of rows) {
    const row = raw as Record<string, unknown>;
    if (String(row.activityId ?? '').trim() !== activityId) continue;
    if (String(row.status ?? '') !== 'approved') continue;
    const email = String(row.userEmail ?? '').trim().toLowerCase();
    const name = String(row.userName ?? '').trim();
    if (email && name && !map.has(email)) map.set(email, name);
  }
  // The viewer is always a signup (route already proved that), but seed the
  // map defensively so their partner row on a doubles card never falls back
  // to the bare email.
  return (email: string) => {
    const key = email.toLowerCase();
    const fromSignup = map.get(key);
    if (fromSignup) return fromSignup;
    if (key === viewerEmail.toLowerCase()) {
      return map.get(key) ?? email;
    }
    const slug = slugFromManualEmail(key);
    if (slug) return slug;
    return email;
  };
}

function buildEventFromActivity(
  activity: ActivityItem,
  approvedAt: string,
  matches: FunmatchMatch[],
): FilterableEvent {
  return {
    id: activity.id,
    title: activity.title,
    date: approvedAt,
    type: CATEGORY_TO_EVENT_TYPE[activity.category],
    category: activity.category,
    icon: CATEGORY_EMOJI[activity.category],
    location: activity.location,
    duration: activity.duration || undefined,
    photos: activity.image ? [activity.image] : [],
    description: activity.description || undefined,
    matches,
  };
}

export async function GET(request: Request) {
  const email = getRequesterEmail(request);
  if (!email) return unauthorized();

  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) return serverError('Supabase is not configured');

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search')?.trim().toLowerCase() || '';

  // Admins can view any user's joined activities. Non-admins may only
  // view their own — ignore the param in that case.
  const requestedUser = searchParams.get('user')?.trim().toLowerCase() || null;
  const targetEmail = requestedUser && isAdminEmail(email) ? requestedUser : email;

  try {
    const [rows, content] = await Promise.all([
      listRowsBySheet(spreadsheetId, 'activity_signups'),
      getActivitiesContent(),
    ]);

    const lower = targetEmail.trim().toLowerCase();
    const byId = new Map<string, ActivityItem>();
    for (const a of content.activities) byId.set(a.id, a);

    const seen = new Set<string>();
    const events: FilterableEvent[] = [];
    for (const raw of rows) {
      const row = raw as unknown as Record<string, unknown>;
      const rowEmail = String(row.userEmail ?? '').trim().toLowerCase();
      if (rowEmail !== lower) continue;

      const statusRaw = String(row.status ?? '');
      if (!isSignupStatus(statusRaw) || statusRaw !== 'approved') continue;

      const activityId = String(row.activityId ?? '').trim();
      if (!activityId || seen.has(activityId)) continue;

      const activity = byId.get(activityId);
      if (!activity || activity.archived) continue;

      // Filter by search term if provided
      if (search && !activity.title.toLowerCase().includes(search)) continue;

      const decidedAt = row.decidedAt ? String(row.decidedAt) : '';
      const requestedAt = String(row.requestedAt ?? '');
      const approvedAt = decidedAt || requestedAt;
      if (!approvedAt) continue;

      // Pull matches for this activity and project them to the viewer's
      // perspective. Missing sheet / errors fall back to no matches so the
      // rest of the page still renders. The `nameOf` map substitutes the
      // admin-typed display name for each email so the public scorecard
      // shows names only (no raw addresses).
      let matches: FunmatchMatch[] = [];
      try {
        const stored = await listMatchesForActivity(spreadsheetId, activityId);
        const nameOf = buildNameOf(rows, activityId, lower);
        matches = stored
          .map((m) => toFunmatchMatch(m, lower, nameOf))
          .filter((m): m is FunmatchMatch => m !== null);
      } catch {
        matches = [];
      }

      seen.add(activityId);
      events.push(buildEventFromActivity(activity, approvedAt, matches));
    }

    // Newest first — `approvedAt` is ISO, so a plain string sort is correct.
    events.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

    return NextResponse.json({ events });
  } catch (error) {
    console.error('Error in GET /api/profile/joined-activities:', error);
    return serverError('Failed to load joined activities');
  }
}
