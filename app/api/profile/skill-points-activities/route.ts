// ============================================
// /api/profile/skill-points-activities
// ============================================
//
// GET → {
//   items: [{ activityId, title, category, image, location,
//             values: Record<SkillKey, number>, updatedAt }]
// }
//
// Sums the signed-in user's per-(user, activity, skill) rows into one
// record per activity (so each Joined Activity card can show its own
// radar-axis totals), then joins with the activity catalog for
// titles/images. Archived activities fall back to the id as the title.

import { NextResponse } from 'next/server';
import { getActivitiesContent } from '@/lib/activities-store';
import { getSkillPointsForUserByActivity } from '@/lib/user-skill-points-store';
import { isAdminEmail } from '@/lib/admin';
import type { SkillValues } from '@/data/user-skill-points-types';

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

export type SkillPointsActivityItem = {
  activityId: string;
  title: string;
  category: string | null;
  image: string | null;
  location: string | null;
  values: SkillValues;
  updatedAt: string | null;
};

export async function GET(request: Request) {
  const email = getRequesterEmail(request);
  if (!email) return unauthorized();

  const { searchParams } = new URL(request.url);
  const requestedUser = searchParams.get('user')?.trim().toLowerCase() || null;
  const targetEmail = requestedUser && isAdminEmail(email) ? requestedUser : email;

  try {
    const [userAgg, content] = await Promise.all([
      getSkillPointsForUserByActivity(targetEmail),
      getActivitiesContent(),
    ]);
    if (userAgg.length === 0) {
      return NextResponse.json({ items: [] });
    }

    const byId = new Map(content.activities.map((a) => [a.id, a]));

    const items: SkillPointsActivityItem[] = userAgg.map((agg) => {
      const activity = byId.get(agg.activityId);
      return {
        activityId: agg.activityId,
        title: activity?.title ?? agg.activityId,
        category: activity?.category ?? null,
        image: activity?.image ?? null,
        location: activity?.location ?? null,
        values: agg.values,
        updatedAt: agg.updatedAt,
      };
    });

    items.sort((a, b) =>
      (a.updatedAt ?? '') < (b.updatedAt ?? '')
        ? 1
        : (a.updatedAt ?? '') > (b.updatedAt ?? '')
          ? -1
          : 0,
    );

    return NextResponse.json({ items });
  } catch (error) {
    console.error('Error in GET /api/profile/skill-points/activities:', error);
    return serverError('Failed to load activity skill points');
  }
}
