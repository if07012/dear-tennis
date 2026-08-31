import { AdminAuthGate } from '../hero/AdminAuthGate';
import { ActivitySignupsClient } from './ActivitySignupsClient';
import { listSignupsForAdmin } from '@/lib/activity-signups-store';

export const metadata = {
  title: 'Admin · Activity Signups — Dear Tennis',
  robots: { index: false, follow: false },
};

const ADMIN_PAGE_SIZE = 10;

export default async function AdminActivitySignupsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string; activity?: string }>;
}) {
  const params = await searchParams;
  const status =
    params.status === 'pending' ||
    params.status === 'approved' ||
    params.status === 'rejected' ||
    params.status === 'all'
      ? params.status
      : 'pending';
  const page = Number.parseInt(params.page ?? '1', 10);
  const activityId = params.activity?.trim() || undefined;
  const initial = await listSignupsForAdmin({
    page: Number.isFinite(page) && page > 0 ? page : 1,
    pageSize: ADMIN_PAGE_SIZE,
    status,
    activityId,
  });
  return (
    <AdminAuthGate>
      <ActivitySignupsClient
        initial={initial}
        initialStatus={status}
        pageSize={ADMIN_PAGE_SIZE}
        activityId={activityId}
      />
    </AdminAuthGate>
  );
}
