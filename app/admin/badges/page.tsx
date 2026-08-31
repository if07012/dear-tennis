import { AdminAuthGate } from '../hero/AdminAuthGate';
import { BadgesClient } from './BadgesClient';
import { listBadgeCatalog } from '@/lib/achievements-store';

export const metadata = {
  title: 'Admin · Badge Catalog — Dear Tennis',
  robots: { index: false, follow: false },
};

export default async function AdminBadgesPage() {
  const initial = await listBadgeCatalog();
  return (
    <AdminAuthGate>
      <BadgesClient initial={initial} />
    </AdminAuthGate>
  );
}