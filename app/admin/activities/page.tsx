import { AdminAuthGate } from '../hero/AdminAuthGate';
import { ActivitiesEditorClient } from './ActivitiesEditorClient';
import { getActivitiesContentForAdmin } from '@/lib/activities-store';

export const metadata = {
  title: 'Admin · Activities Editor — Dear Tennis',
  robots: { index: false, follow: false },
};

export default async function AdminActivitiesPage() {
  const initial = await getActivitiesContentForAdmin();
  return (
    <AdminAuthGate>
      <ActivitiesEditorClient initial={initial} />
    </AdminAuthGate>
  );
}
