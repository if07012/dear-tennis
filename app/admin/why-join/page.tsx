import { AdminAuthGate } from '../hero/AdminAuthGate';
import { WhyJoinEditorClient } from './WhyJoinEditorClient';
import { getWhyJoinContentForAdmin } from '@/lib/why-join-store';

export const metadata = {
  title: 'Admin · Why Join Editor — Dear Tennis',
  robots: { index: false, follow: false },
};

export default async function AdminWhyJoinPage() {
  const initial = await getWhyJoinContentForAdmin();
  return (
    <AdminAuthGate>
      <WhyJoinEditorClient initial={initial} />
    </AdminAuthGate>
  );
}
