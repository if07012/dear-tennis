// ============================================
// /api/profile/skill-points
// ============================================
//
// GET → { values: number[6] | null, activities: number }
//
// Averages the signed-in user's per-(user, activity, skill) rows per
// skill across activities (each skill uses its own denominator), then
// clamps to 0-100. When the user has no rows, `values` is `null` so the
// chart falls back to the static `skillRadar` constant.

import { NextResponse } from 'next/server';
import { getSkillPointsForUser } from '@/lib/user-skill-points-store';
import { SKILL_DISPLAY_ORDER } from '@/data/user-skill-points-types';
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
  const targetEmail = requestedUser && isAdminEmail(email) ? requestedUser : email;

  try {
    const total = await getSkillPointsForUser(targetEmail);
    if (!total) {
      return NextResponse.json({ values: null, activities: 0 });
    }
    const values = SKILL_DISPLAY_ORDER.map((k) => total.values[k]);
    return NextResponse.json({
      values,
      activities: total.activityCount,
    });
  } catch (error) {
    console.error('Error in GET /api/profile/skill-points:', error);
    return serverError('Failed to load skill points');
  }
}
