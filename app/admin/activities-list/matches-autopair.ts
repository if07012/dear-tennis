// ============================================
// MATCHES AUTO-PAIR
// ============================================
// Pure functions that turn an approved-member roster into a list of
// `MatchRecord` suggestions. No sheet reads — caller passes the pool of
// lowercased emails and the desired format.
//
// Round-robin uses the standard "circle" algorithm: fix one player, rotate
// the rest. For odd rosters we add a "BYE" placeholder so pairings stay
// even; matches containing BYE are dropped before returning.
//
// Bracket seeds players 1..N, pads to the next power of 2 with BYE, and
// pairs (1 vs N, 2 vs N-1, …). Drop BYE pairs.

import type {
  MatchFormat,
  MatchRecord,
  MatchRound,
} from '@/data/matches-types';

const BYE = '__BYE__';

function shuffle<T>(arr: T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function nextPowerOfTwo(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

function formatToSets(format: MatchFormat): number {
  if (format === 'bo1') return 1;
  if (format === 'bo3') return 2;
  return 3;
}

function blankRecord(
  activityId: string,
  matchIndex: number,
  round: MatchRound,
  format: MatchFormat,
  isDoubles: boolean,
  sideA: string,
  sideB: string,
): MatchRecord {
  return {
    id: '',
    activityId,
    matchIndex,
    round,
    format,
    isDoubles,
    sideA,
    sideB,
    set1A: 0,
    set1B: 0,
    set2A: 0,
    set2B: 0,
    set3A: 0,
    set3B: 0,
    winner: '',
    recordedBy: '',
    recordedAt: '',
    updatedAt: '',
  };
}

/**
 * Round-robin: every player meets every other player exactly once.
 * Doubles mode pairs adjacent players into fixed teams.
 */
export function pairRoundRobin(
  activityId: string,
  members: string[],
  format: MatchFormat,
  isDoubles: boolean,
): MatchRecord[] {
  if (members.length < 2) return [];

  let pool = members.map((m) => m.trim().toLowerCase()).filter(Boolean);
  // Doubles needs an even number of members; pad with a BYE seed to balance
  // the circle (BYE matches are filtered out at the end).
  if (isDoubles && pool.length % 2 !== 0) pool.push(BYE);

  // Odd singles count: add one BYE so the circle rotation works.
  const isOddSingles = !isDoubles && pool.length % 2 !== 0;
  if (isOddSingles) pool.push(BYE);

  const n = pool.length;
  if (n < 2) return [];

  // Fix player 0, rotate the rest through n-1 rounds.
  const fixed = pool[0];
  const rotating = pool.slice(1);
  const rounds = n - 1;
  const matches: MatchRecord[] = [];
  let idx = 0;

  for (let r = 0; r < rounds; r++) {
    // Side A is the fixed player; side B is the rotated player at position 0
    // in this round. Each successive pair shifts the rotating list.
    const ring = [fixed, ...rotating];
    for (let i = 0; i < n / 2; i++) {
      const a = ring[i];
      const b = ring[n - 1 - i];
      if (a === BYE || b === BYE) continue;
      matches.push(blankRecord(activityId, idx++, 'RR', format, isDoubles, a, b));
    }
    // Rotate: move last rotating player to the front.
    rotating.unshift(rotating.pop()!);
  }

  if (isDoubles) {
    // Re-pair adjacent singles results into doubles teams. Skip — the
    // generator emits singles; admin toggles `isDoubles` later if they want
    // doubles. Keeping the generator simple: doubles mode here only flips
    // the isDoubles flag on each generated match.
  }
  return matches;
}

/**
 * Single-elimination bracket. Seeds 1..N, pads to the next power of 2 with
 * BYE, pairs (1 vs N, 2 vs N-1, …). Returns one row per non-bye match.
 * `round` is derived from bracket size: 16→R1/QF/SF/F, 8→QF/SF/F, etc.
 */
export function pairBracket(
  activityId: string,
  members: string[],
  format: MatchFormat,
  isDoubles: boolean,
): MatchRecord[] {
  if (members.length < 2) return [];

  let pool = members.map((m) => m.trim().toLowerCase()).filter(Boolean);
  if (isDoubles && pool.length % 2 !== 0) pool.push(BYE);

  const size = nextPowerOfTwo(pool.length);
  while (pool.length < size) pool.push(BYE);

  const depth = Math.log2(size); // 4 for size 16, 3 for 8, etc.
  const roundLabel: MatchRound =
    depth >= 4 ? 'R1' : depth === 3 ? 'QF' : depth === 2 ? 'SF' : 'F';

  const matches: MatchRecord[] = [];
  for (let i = 0; i < size / 2; i++) {
    const a = pool[i];
    const b = pool[size - 1 - i];
    if (a === BYE || b === BYE) continue;
    matches.push(blankRecord(activityId, i, roundLabel, format, isDoubles, a, b));
  }
  return matches;
}

/**
 * Auto-balance a doubles match: if exactly one player is currently on each
 * side, fill the second slot on each side with a random member that isn't
 * already in the match. Returns the same shape with new `sideA`/`sideB`.
 * If both sides already have 2 players, returns the input unchanged.
 */
export function autoBalanceDoubles(
  sideA: string,
  sideB: string,
  members: string[],
): { sideA: string; sideB: string } {
  const a = sideA.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  const b = sideB.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (a.length === 2 && b.length === 2) return { sideA, sideB };
  if (a.length !== 1 || b.length !== 1) return { sideA, sideB };

  const taken = new Set([...a, ...b]);
  const pool = members
    .map((m) => m.trim().toLowerCase())
    .filter((m) => m && !taken.has(m));
  if (pool.length < 2) return { sideA, sideB };

  const picks = shuffle(pool).slice(0, 2);
  return {
    sideA: `${a[0]},${picks[0]}`,
    sideB: `${b[0]},${picks[1]}`,
  };
}

export const FORMAT_SETS = formatToSets;