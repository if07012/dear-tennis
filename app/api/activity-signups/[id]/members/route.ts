// ============================================
// /api/activity-signups/[activityId]/members — public
// ============================================
//
// GET → { members: [{ name, photo, joinedAt }] } — approved members of
// the activity, joined with their user record (name + optional photo).
// Used by the home-page member popup.
//
// ponytail: the dynamic segment is named [id] to match the sibling
// payment route (Next.js requires same-level dynamic segments to share
// one name) — it still carries the activity id for this route.

import { NextResponse } from 'next/server';
import { getActivityMembers } from '@/lib/activity-signups-store';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const activityId = (await params).id;
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
