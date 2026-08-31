// ============================================
// /api/admin/activity-matches — per-activity match results
// ============================================
//
// GET  ?activity=<id>      → { activityId, members: [{ email, name }],
//                              matches: MatchRecord[] }
//                              Members seeded from approved signups.
//                              Matches loaded from `activity_matches`.
//
// POST { activityId, matches: Array<{ id?, matchIndex, round, format,
//                                    isDoubles, sideA, sideB,
//                                    set1A..set3B, winner }> }
//                            → full-replace-by-activity. Server validates
//                              sides reference an approved member and
//                              re-numbers `matchIndex` 0..N-1.
//
// Both endpoints require `x-auth-email` matching ADMIN_EMAIL.

import { NextResponse } from 'next/server';
import { isAdminEmail } from '@/lib/admin';
import { listSignupsForAdmin } from '@/lib/activity-signups-store';
import {
  isMatchFormat,
  isMatchRound,
  isMatchWinner,
  listMatchesForActivity,
  replaceMatchesForActivity,
  type MatchFormat,
  type MatchRecord,
  type MatchRound,
  type MatchWinner,
} from '@/app/lib/matches-store';

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}
function serverError(message: string) {
  return NextResponse.json({ error: message }, { status: 500 });
}
function getRequesterEmail(request: Request): string | null {
  const header = request.headers.get('x-auth-email');
  return header && header.trim().length > 0 ? header.trim().toLowerCase() : null;
}
function getSpreadsheetId(): string | null {
  const id = process.env.HERO_SPREADSHEET_ID?.trim();
  return id && id.length > 0 ? id : null;
}

function coerceInt(raw: unknown): number {
  const n = parseInt(String(raw ?? ''), 10);
  return Number.isFinite(n) ? n : 0;
}
function normaliseSide(raw: unknown): string {
  return String(raw ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .join(',');
}

type MemberLite = { email: string; name: string };

function validateSides(matches: MatchRecord[], memberEmails: Set<string>): string | null {
  for (const m of matches) {
    const a = m.sideA;
    const b = m.sideB;
    if (!a || !b) return `Match ${m.matchIndex + 1}: kedua sisi harus dipilih`;
    if (a === b) return `Match ${m.matchIndex + 1}: sisi A dan B tidak boleh sama`;
    for (const email of a.split(',')) {
      if (!memberEmails.has(email)) {
        return `Match ${m.matchIndex + 1}: ${email} bukan member yang di-approve`;
      }
    }
    for (const email of b.split(',')) {
      if (!memberEmails.has(email)) {
        return `Match ${m.matchIndex + 1}: ${email} bukan member yang di-approve`;
      }
    }
    if (m.isDoubles) {
      if (a.split(',').length !== 2 || b.split(',').length !== 2) {
        return `Match ${m.matchIndex + 1}: mode doubles harus punya 2 pemain per sisi`;
      }
    } else {
      if (a.split(',').length !== 1 || b.split(',').length !== 1) {
        return `Match ${m.matchIndex + 1}: mode singles harus punya 1 pemain per sisi`;
      }
    }
  }
  return null;
}

export async function GET(request: Request) {
  const email = getRequesterEmail(request);
  if (!isAdminEmail(email)) return unauthorized();

  const url = new URL(request.url);
  const activityId = url.searchParams.get('activity')?.trim();
  if (!activityId) return badRequest('activity query param is required');

  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) return serverError('HERO_SPREADSHEET_ID is not set');

  try {
    const signupsPage = await listSignupsForAdmin({
      page: 1,
      pageSize: 100,
      status: 'approved',
      activityId,
    });
    const seen = new Set<string>();
    const members: MemberLite[] = [];
    for (const s of signupsPage.items) {
      const e = s.userEmail.toLowerCase();
      if (seen.has(e)) continue;
      seen.add(e);
      members.push({ email: e, name: s.userName });
    }

    const matches = await listMatchesForActivity(spreadsheetId, activityId);
    return NextResponse.json({ activityId, members, matches });
  } catch (error) {
    console.error('Error in GET /api/admin/activity-matches:', error);
    return serverError('Failed to load activity matches');
  }
}

type RawMatch = {
  id?: unknown;
  matchIndex?: unknown;
  round?: unknown;
  format?: unknown;
  isDoubles?: unknown;
  sideA?: unknown;
  sideB?: unknown;
  set1A?: unknown;
  set1B?: unknown;
  set2A?: unknown;
  set2B?: unknown;
  set3A?: unknown;
  set3B?: unknown;
  winner?: unknown;
};

type PostBody = {
  activityId?: unknown;
  matches?: unknown;
  manualMembers?: unknown;
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const email = getRequesterEmail(request);
  if (!isAdminEmail(email)) return unauthorized();

  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) return serverError('HERO_SPREADSHEET_ID is not set');

  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return badRequest('Invalid JSON');
  }
  if (!body || typeof body.activityId !== 'string' || !body.activityId.trim()) {
    return badRequest('activityId is required');
  }
  if (!Array.isArray(body.matches)) {
    return badRequest('matches must be an array');
  }

  const activityId = body.activityId.trim();
  const signupsPage = await listSignupsForAdmin({
    page: 1,
    pageSize: 100,
    status: 'approved',
    activityId,
  });
  const memberEmails = new Set(signupsPage.items.map((s) => s.userEmail.toLowerCase()));

  // Manual members: emails the admin typed in (guests, walk-ins, subs) that
  // aren't in the approved signups list. Each must look like an email; we
  // union them into the validation set so matches referencing them pass.
  const manualEmails = new Set<string>();
  if (Array.isArray(body.manualMembers)) {
    for (const raw of body.manualMembers) {
      const e = String(raw ?? '').trim().toLowerCase();
      if (!e) continue;
      if (!emailRegex.test(e)) {
        return badRequest(`Manual member tidak valid: ${e}`);
      }
      manualEmails.add(e);
      memberEmails.add(e);
    }
  }

  const normalised: MatchRecord[] = [];
  for (let i = 0; i < body.matches.length; i++) {
    const raw = body.matches[i] as RawMatch;
    if (!raw || typeof raw !== 'object') {
      return badRequest(`Match ${i + 1}: payload tidak valid`);
    }
    if (!isMatchRound(raw.round)) return badRequest(`Match ${i + 1}: round tidak valid`);
    if (!isMatchFormat(raw.format)) return badRequest(`Match ${i + 1}: format tidak valid`);
    if (!isMatchWinner(raw.winner)) return badRequest(`Match ${i + 1}: winner tidak valid`);
    const sideA = normaliseSide(raw.sideA);
    const sideB = normaliseSide(raw.sideB);
    const round: MatchRound = raw.round;
    const format: MatchFormat = raw.format;
    const winner: MatchWinner = raw.winner;
    normalised.push({
      id: typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : '',
      activityId,
      matchIndex: i,
      round,
      format,
      isDoubles: raw.isDoubles === true || raw.isDoubles === 'TRUE' || raw.isDoubles === 'true',
      sideA,
      sideB,
      set1A: coerceInt(raw.set1A),
      set1B: coerceInt(raw.set1B),
      set2A: coerceInt(raw.set2A),
      set2B: coerceInt(raw.set2B),
      set3A: coerceInt(raw.set3A),
      set3B: coerceInt(raw.set3B),
      winner,
      recordedBy: '',
      recordedAt: '',
      updatedAt: '',
    });
  }

  const validationError = validateSides(normalised, memberEmails);
  if (validationError) return badRequest(validationError);

  try {
    const result = await replaceMatchesForActivity(
      spreadsheetId,
      activityId,
      email ?? '',
      normalised,
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('Error in POST /api/admin/activity-matches:', error);
    return serverError(
      error instanceof Error ? error.message : 'Failed to save activity matches',
    );
  }
}