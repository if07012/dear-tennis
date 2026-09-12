import { AdminAuthGate } from '../hero/AdminAuthGate';
import { ClicksClient } from './ClicksClient';
import { getClicksForAdmin } from '@/lib/click-tracking-store';

export const metadata = {
  title: 'Admin · Click Tracking — Dear Tennis',
  robots: { index: false, follow: false },
};

const ADMIN_PAGE_SIZE = 20;

export default async function AdminClicksPage() {
  const initial = await getClicksForAdmin({ page: 1, pageSize: ADMIN_PAGE_SIZE });
  return (
    <AdminAuthGate>
      <ClicksClient initial={initial} pageSize={ADMIN_PAGE_SIZE} />
    </AdminAuthGate>
  );
}
