import { AdminAuthGate } from '../hero/AdminAuthGate';
import { UsersClient } from './UsersClient';
import { getUsersContentForAdmin } from '@/lib/users-store';

export const metadata = {
  title: 'Admin · Manage Users — Dear Tennis',
  robots: { index: false, follow: false },
};

const ADMIN_PAGE_SIZE = 10;

export default async function AdminUsersPage() {
  const initial = await getUsersContentForAdmin({
    page: 1,
    pageSize: ADMIN_PAGE_SIZE,
  });
  return (
    <AdminAuthGate>
      <UsersClient initial={initial} />
    </AdminAuthGate>
  );
}
