// ============================================
// /api/activity-signups/[activityId]/members — public
// ============================================
//
// GET → { members: [{ name, photo, joinedAt }] } — approved members of
// the activity, joined with their user record (name + optional photo).
// Used by the home-page member popup.

import { NextResponse } from 'next/server';
import { getActivityMembers } from '@/lib/activity-signups-store';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ activityId: string }> },
) {
  const { activityId } = await params;
  if (!activityId || activityId.trim().length === 0) {
    return NextResponse.json({ members: [] });
  }
  const members = await getActivityMembers(activityId.trim());
  return NextResponse.json({
    members: members.map((m) => ({
      name: m.name,
      photo: m.photo ?? null,
      joinedAt: m.joinedAt,
    })),
  });
}
