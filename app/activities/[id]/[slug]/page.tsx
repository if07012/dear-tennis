import type { Metadata } from 'next';
import { getActivitiesContentForAdmin } from '@/lib/activities-store';
import { getActivityMembers } from '@/lib/activity-signups-store';
import { listAllUsersForAdmin } from '@/lib/users-store';
import { getSpreadsheetId } from '@/app/lib/supabase';
import { listMatchesForActivity } from '@/app/lib/matches-store';
import type { MatchRecord } from '@/data/matches-types';
import { ActivityDetailClient } from './ActivityDetailClient';

export const dynamic = 'force-dynamic';

type Params = {
  params: Promise<{ id: string; slug: string }>;
};

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const content = await getActivitiesContentForAdmin();
  const activity = content.activities.find((a) => a.id === id);
  return {
    title: activity
      ? `${activity.title} — Dear Tennis`
      : 'Activity — Dear Tennis',
    description: activity?.description?.slice(0, 160) ?? undefined,
  };
}

export default async function ActivityDetailPage({ params }: Params) {
  // `slug` is cosmetic — the id alone identifies the row, so an
  // outdated title in a shared link still resolves.
  const { id } = await params;
  const content = await getActivitiesContentForAdmin();
  const activity = content.activities.find((a) => a.id === id) ?? null;

  // Members joined with user records so we can show name + photo + rank
  // (level). getActivityMembers already merges name/photo; rank comes from
  // the users list below.
  let members: Array<{
    email: string;
    name: string;
    photo: string | null;
    rank: string | null;
  }> = [];
  let matches: MatchRecord[] = [];
  if (activity) {
    const [signupMembers, users] = await Promise.all([
      getActivityMembers(id),
      listAllUsersForAdmin(),
    ]);
    const rankByEmail = new Map(
      users.map((u) => [u.email.toLowerCase(), u.rank ?? null]),
    );
    members = signupMembers.map((m) => ({
      email: m.email,
      name: m.name,
      photo: m.photo ?? null,
      rank: rankByEmail.get(m.email.toLowerCase()) ?? null,
    }));

    if (activity.category === 'competitive') {
      const spreadsheetId = getSpreadsheetId();
      if (spreadsheetId) {
        try {
          matches = await listMatchesForActivity(spreadsheetId, id);
        } catch {
          matches = [];
        }
      }
    }
  }

  return <ActivityDetailClient activity={activity} members={members} matches={matches} />;
}
