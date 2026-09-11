import { redirect } from 'next/navigation';
import { getActivitiesContentForAdmin } from '@/lib/activities-store';
import { activityPath } from '@/lib/slug';

export const dynamic = 'force-dynamic';

type Params = {
  params: Promise<{ id: string }>;
};

// Legacy /activities/<id> URLs bounce to the canonical
// /activities/<id>/<title-slug> form.
export default async function ActivityIdRedirectPage({ params }: Params) {
  const { id } = await params;
  const content = await getActivitiesContentForAdmin();
  const activity = content.activities.find((a) => a.id === id);
  redirect(activity ? activityPath(id, activity.title) : `/activities/${id}/detail`);
}
