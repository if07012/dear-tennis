// ============================================
// MATCHES TYPES
// ============================================
// Browser-safe shape of one match record. Mirrors the `activity_matches`
// sheet schema. Keep this file free of server-only imports (google-spreadsheet,
// node:fs, etc.) so client components can import it directly.

export type MatchFormat = 'bo1' | 'bo3' | 'bo5';
export type MatchRound = 'RR' | 'R1' | 'QF' | 'SF' | 'F' | 'manual';
export type MatchWinner = 'A' | 'B' | 'draw' | '';

export type MatchRecord = {
  id: string;
  activityId: string;
  matchIndex: number;
  round: MatchRound;
  format: MatchFormat;
  isDoubles: boolean;
  sideA: string;
  sideB: string;
  set1A: number;
  set1B: number;
  set2A: number;
  set2B: number;
  set3A: number;
  set3B: number;
  winner: MatchWinner;
  recordedBy: string;
  recordedAt: string;
  updatedAt: string;
};

export const MATCH_HEADERS = [
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
] as const;

export const MATCH_FORMATS: MatchFormat[] = ['bo1', 'bo3', 'bo5'];
export const MATCH_ROUNDS: MatchRound[] = ['RR', 'R1', 'QF', 'SF', 'F', 'manual'];
export const MATCH_WINNERS: MatchWinner[] = ['A', 'B', 'draw', ''];

export function isMatchFormat(value: unknown): value is MatchFormat {
  return typeof value === 'string' && (MATCH_FORMATS as string[]).includes(value);
}
export function isMatchRound(value: unknown): value is MatchRound {
  return typeof value === 'string' && (MATCH_ROUNDS as string[]).includes(value);
}
export function isMatchWinner(value: unknown): value is MatchWinner {
  return typeof value === 'string' && (MATCH_WINNERS as string[]).includes(value);
}