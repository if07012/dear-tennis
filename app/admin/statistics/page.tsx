import { AdminAuthGate } from '../hero/AdminAuthGate';
import { StatisticsEditorClient } from './StatisticsEditorClient';
import { getStatisticsContentForAdmin } from '@/lib/statistics-store';

export const metadata = {
  title: 'Admin · Statistics Editor — Dear Tennis',
  robots: { index: false, follow: false },
};

const ADMIN_PAGE_SIZE = 5;

export default async function AdminStatisticsPage() {
  const initial = await getStatisticsContentForAdmin({
    page: 1,
    pageSize: ADMIN_PAGE_SIZE,
  });
  return (
    <AdminAuthGate>
      <StatisticsEditorClient initial={initial} />
    </AdminAuthGate>
  );
}