// ============================================
// MATCHES DATA STORE (server-only)
// ============================================
// Reads/writes the `activity_matches` sheet for admin-recorded match results
// on Competitive activities. One row per match; no JSON-in-cell columns.
//
// Sheet schema (created on first save):
//   activity_matches: id, activityId, matchIndex, round, format, isDoubles,
//                     sideA, sideB, set1A, set1B, set2A, set2B, set3A, set3B,
//                     winner, recordedBy, recordedAt, updatedAt
//
// `sideA` / `sideB` hold a comma-joined list of lowercased member emails —
// a single email for singles, two emails for doubles.
//
// Types and constants live in `data/matches-types.ts` so client components
// can import them without pulling this server-only module (and its
// supabase dependency chain) into the browser bundle.

import {
  createRowWithId,
  deleteRowById,
  ensureSheetWithHeaders,
  listRowsBySheet,
  updateRowById,
} from '@/app/lib/supabase';
import {
  isMatchFormat,
  isMatchRound,
  isMatchWinner,
  MATCH_FORMATS,
  MATCH_HEADERS,
  MATCH_ROUNDS,
  MATCH_WINNERS,
  type MatchFormat,
  type MatchRecord,
  type MatchRound,
  type MatchWinner,
} from '@/data/matches-types';

export const MATCHES_SHEET = 'activity_matches';
export {
  MATCH_HEADERS,
  MATCH_FORMATS,
  MATCH_ROUNDS,
  MATCH_WINNERS,
  isMatchFormat,
  isMatchRound,
  isMatchWinner,
};
export type {
  MatchFormat,
  MatchRecord,
  MatchRound,
  MatchWinner,
};

function coerceInt(raw: unknown): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.trunc(raw);
  const n = parseInt(String(raw ?? ''), 10);
  return Number.isFinite(n) ? n : 0;
}

function coerceBool(raw: unknown): boolean {
  return raw === true || raw === 'TRUE' || raw === 'true' || raw === 1 || raw === '1';
}

function coerceSide(raw: unknown): string {
  return String(raw ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .join(',');
}

function coerceRecord(row: Record<string, unknown>): MatchRecord | null {
  const id = String(row.id ?? '').trim();
  const activityId = String(row.activityId ?? '').trim();
  if (!id || !activityId) return null;
  const round: MatchRound = isMatchRound(row.round) ? row.round : 'manual';
  const format: MatchFormat = isMatchFormat(row.format) ? row.format : 'bo3';
  const winner: MatchWinner = isMatchWinner(row.winner) ? row.winner : '';
  return {
    id,
    activityId,
    matchIndex: coerceInt(row.matchIndex),
    round,
    format,
    isDoubles: coerceBool(row.isDoubles),
    sideA: coerceSide(row.sideA),
    sideB: coerceSide(row.sideB),
    set1A: coerceInt(row.set1A),
    set1B: coerceInt(row.set1B),
    set2A: coerceInt(row.set2A),
    set2B: coerceInt(row.set2B),
    set3A: coerceInt(row.set3A),
    set3B: coerceInt(row.set3B),
    winner,
    recordedBy: String(row.recordedBy ?? '').trim().toLowerCase(),
    recordedAt: String(row.recordedAt ?? ''),
    updatedAt: String(row.updatedAt ?? ''),
  };
}

export async function ensureMatchesSheet(spreadsheetId: string): Promise<void> {
  await ensureSheetWithHeaders(spreadsheetId, MATCHES_SHEET, [
    'id',
    'activityId',
    'matchIndex',
    'round',
    'format',
    'isDoubles',
    'sideA',
    'sideB',
    'set1A',
    'set1B',
    'set2A',
    'set2B',
    'set3A',
    'set3B',
    'winner',
    'recordedBy',
    'recordedAt',
    'updatedAt',
  ]);
}

export async function listMatchesForActivity(
  spreadsheetId: string,
  activityId: string,
): Promise<MatchRecord[]> {
  await ensureMatchesSheet(spreadsheetId);
  const rows = await listRowsBySheet(spreadsheetId, MATCHES_SHEET);
  const out: MatchRecord[] = [];
  for (const row of rows) {
    const rec = coerceRecord(row);
    if (!rec) continue;
    if (rec.activityId !== activityId) continue;
    out.push(rec);
  }
  return out.sort((a, b) => a.matchIndex - b.matchIndex);
}

/**
 * Full-replace by activity. Caller is responsible for assigning `matchIndex`
 * (0..N-1) on each row so ordering round-trips through sheet.
 */
export async function replaceMatchesForActivity(
  spreadsheetId: string,
  activityId: string,
  recordedBy: string,
  next: MatchRecord[],
): Promise<{ count: number }> {
  await ensureMatchesSheet(spreadsheetId);
  const existing = await listMatchesForActivity(spreadsheetId, activityId);
  const existingIds = new Set(existing.map((m) => m.id));
  const nextIds = new Set(
    next.map((m) => m.id).filter((id) => id && id.trim().length > 0),
  );

  for (const m of existing) {
    if (!nextIds.has(m.id)) {
      await deleteRowById(spreadsheetId, MATCHES_SHEET, m.id);
    }
  }

  const now = new Date().toISOString();
  for (const m of next) {
    if (m.id && existingIds.has(m.id)) {
      await updateRowById(spreadsheetId, MATCHES_SHEET, m.id, {
        activityId,
        matchIndex: m.matchIndex,
        round: m.round,
        format: m.format,
        isDoubles: m.isDoubles ? 'TRUE' : 'FALSE',
        sideA: m.sideA,
        sideB: m.sideB,
        set1A: m.set1A,
        set1B: m.set1B,
        set2A: m.set2A,
        set2B: m.set2B,
        set3A: m.set3A,
        set3B: m.set3B,
        winner: m.winner,
        recordedBy,
        updatedAt: now,
      });
    } else {
      const id = crypto.randomUUID();
      await createRowWithId(spreadsheetId, MATCHES_SHEET, {
        id,
        activityId,
        matchIndex: m.matchIndex,
        round: m.round,
        format: m.format,
        isDoubles: m.isDoubles ? 'TRUE' : 'FALSE',
        sideA: m.sideA,
        sideB: m.sideB,
        set1A: m.set1A,
        set1B: m.set1B,
        set2A: m.set2A,
        set2B: m.set2B,
        set3A: m.set3A,
        set3B: m.set3B,
        winner: m.winner,
        recordedBy,
        recordedAt: now,
        updatedAt: now,
      });
    }
  }
  return { count: next.length };
}