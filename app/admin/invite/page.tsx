import { AdminAuthGate } from '../hero/AdminAuthGate';
import { InviteManagerClient } from './InviteManagerClient';
import { getInviteContentForAdmin } from '@/lib/invite-store';

export const metadata = {
  title: 'Admin · Invite Members — Dear Tennis',
  robots: { index: false, follow: false },
};

const ADMIN_PAGE_SIZE = 10;

export default async function AdminInvitePage() {
  const initial = await getInviteContentForAdmin({
    page: 1,
    pageSize: ADMIN_PAGE_SIZE,
  });
  return (
    <AdminAuthGate>
      <InviteManagerClient initial={initial} />
    </AdminAuthGate>
  );
}