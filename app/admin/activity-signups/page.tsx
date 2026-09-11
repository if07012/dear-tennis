import { AdminAuthGate } from '../hero/AdminAuthGate';
import { ActivitySignupsClient } from './ActivitySignupsClient';
import { listSignupsForAdmin } from '@/lib/activity-signups-store';
import { coerceLegacyStatus, isSignupStatus } from '@/data/activity-signups-types';

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
  // Accept legacy values (pending/approved) from old links/bookmarks.
  const statusParam = params.status?.trim() ?? '';
  const status =
    statusParam === 'all'
      ? 'all'
      : isSignupStatus(statusParam)
        ? statusParam
        : coerceLegacyStatus(statusParam) ?? 'pending_approval';
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
