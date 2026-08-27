import { AdminAuthGate } from '../hero/AdminAuthGate';
import { ActivitiesListClient } from './ActivitiesListClient';
import { getActivitiesContentForAdmin } from '@/lib/activities-store';

export const metadata = {
  title: 'Admin · Activities List — Dear Tennis',
  robots: { index: false, follow: false },
};

const PAGE_SIZE = 10;

export default async function AdminActivitiesListPage() {
  const content = await getActivitiesContentForAdmin();
  return (
    <AdminAuthGate>
      <ActivitiesListClient
        initialActivities={content.activities}
        pageSize={PAGE_SIZE}
      />
    </AdminAuthGate>
  );
}
