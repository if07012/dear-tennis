// ============================================
// MATCHES STANDINGS
// ============================================
// Pure functions that turn a list of `MatchRecord` into a per-player
// W/L/D tally + games-won / games-lost, used by the admin standings drawer.
//
// Doubles matches credit BOTH players on a side with the same result so the
// standings reflect the partnership, not just one player. Manual placeholder
// emails (e.g. `__manual_caca@guest.local`) participate in the table so the
// admin still sees walk-ins.

import type { MatchRecord } from '@/data/matches-types';

export type Standing = {
  /** Lowercased email — the row's primary key. */
  email: string;
  /** Human label, resolved via the caller-supplied name lookup. */
  name: string;
  wins: number;
  losses: number;
  draws: number;
  /** Total games won across all matches (each set counts as a game). */
  gamesWon: number;
  /** Total games lost across all matches. */
  gamesLost: number;
  /** Convenience: W − L (draws do not count toward the diff). */
  winDiff: number;
  /** Convenience: GW − GL. */
  gameDiff: number;
};

function splitSides(side: string): string[] {
  return side
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function setPairs(rec: MatchRecord): Array<[number, number]> {
  return [
    [rec.set1A, rec.set1B],
    [rec.set2A, rec.set2B],
    [rec.set3A, rec.set3B],
  ];
}

/**
 * Build the standings table from a match list. The empty state is `[]` — UI
 * shows a "no matches recorded" hint instead of a misleading zero table.
 *
 * `nameOf` is a required email→display-name resolver. The admin drawer passes
 * the approved-signups roster so players are labelled by their real name;
 * manual placeholder emails fall back to whatever the resolver returns
 * (e.g. the slug, or a guest label).
 */
export function computeStandings(
  matches: MatchRecord[],
  nameOf: (email: string) => string,
): Standing[] {
  const byEmail = new Map<string, Standing>();

  const get = (email: string): Standing => {
    const key = email.toLowerCase();
    let row = byEmail.get(key);
    if (!row) {
      row = {
        email: key,
        name: nameOf(key) || key,
        wins: 0,
        losses: 0,
        draws: 0,
        gamesWon: 0,
        gamesLost: 0,
        winDiff: 0,
        gameDiff: 0,
      };
      byEmail.set(key, row);
    }
    return row;
  };

  for (const m of matches) {
    const a = splitSides(m.sideA);
    const b = splitSides(m.sideB);
    if (a.length === 0 || b.length === 0) continue;

    // Tally games for everyone on the court regardless of winner — useful
    // when an admin enters partial scores before deciding the winner.
    let aGames = 0;
    let bGames = 0;
    for (const [aScore, bScore] of setPairs(m)) {
      if (aScore === 0 && bScore === 0) continue;
      aGames += aScore;
      bGames += bScore;
    }

    for (const email of a) {
      const row = get(email);
      row.gamesWon += aGames;
      row.gamesLost += bGames;
    }
    for (const email of b) {
      const row = get(email);
      row.gamesWon += bGames;
      row.gamesLost += aGames;
    }

    if (m.winner === 'A') {
      for (const email of a) get(email).wins += 1;
      for (const email of b) get(email).losses += 1;
    } else if (m.winner === 'B') {
      for (const email of b) get(email).wins += 1;
      for (const email of a) get(email).losses += 1;
    } else if (m.winner === 'draw') {
      for (const email of a) get(email).draws += 1;
      for (const email of b) get(email).draws += 1;
    }
    // winner === '' means "belum" — games already credited, no W/L/D yet.
  }

  const out = Array.from(byEmail.values());
  for (const row of out) {
    row.winDiff = row.wins - row.losses;
    row.gameDiff = row.gamesWon - row.gamesLost;
  }
  out.sort((x, y) => {
    if (y.wins !== x.wins) return y.wins - x.wins;
    if (y.winDiff !== x.winDiff) return y.winDiff - x.winDiff;
    if (y.gameDiff !== x.gameDiff) return y.gameDiff - x.gameDiff;
    if (y.gamesWon !== x.gamesWon) return y.gamesWon - x.gamesWon;
    return x.name.localeCompare(y.name);
  });
  return out;
}
