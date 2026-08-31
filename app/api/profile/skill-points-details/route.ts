// ============================================
// /api/profile/skill-points-details
// ============================================
//
// GET → {
//   perSkill: Record<SkillKey, {
//     value: number,
//     accuracy?: number, power?: number, consistency?: number,
//     speed?: number, agility?: number, balance?: number,
//   }> | null,
//   activities: number
// }
//
// Per-skill aggregation of sub-stats for the signed-in user. Drives the
// profile "Skill Breakdown" panel. Returns `null` for `perSkill` when the
// user has no recorded skill rows so the UI can fall back to the static
// `skillBreakdownDefaults` data.
//
// Admins can pass `?user=<email>` to fetch another member's breakdown.

import { NextResponse } from 'next/server';
import { getSkillPointsForUser } from '@/lib/user-skill-points-store';
import {
  SKILL_KEYS,
  SKILL_SUB_STATS,
  type SkillKey,
} from '@/data/user-skill-points-types';
import { isAdminEmail } from '@/lib/admin';

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

export async function GET(request: Request) {
  const email = getRequesterEmail(request);
  if (!email) return unauthorized();

  const { searchParams } = new URL(request.url);
  const requestedUser = searchParams.get('user')?.trim().toLowerCase() || null;
  const targetEmail =
    requestedUser && isAdminEmail(email) ? requestedUser : email;

  try {
    const total = await getSkillPointsForUser(targetEmail);
    if (!total) {
      return NextResponse.json({ perSkill: null, activities: 0 });
    }

    const perSkill = {} as Record<
      SkillKey,
      { value: number; [key: string]: number }
    >;
    for (const skill of SKILL_KEYS) {
      const entry: { value: number; [key: string]: number } = {
        value: total.values[skill],
      };
      for (const sub of SKILL_SUB_STATS[skill]) {
        entry[sub] = total.subStats[skill][sub];
      }
      perSkill[skill] = entry;
    }

    return NextResponse.json({ perSkill, activities: total.activityCount });
  } catch (error) {
    console.error('Error in GET /api/profile/skill-points-details:', error);
    return serverError('Failed to load skill breakdown');
  }
}
