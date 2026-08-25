import { AdminAuthGate } from '../hero/AdminAuthGate';
import { OurStoryEditorClient } from './OurStoryEditorClient';
import { getOurStoryContentForAdmin } from '@/lib/our-story-store';

export const metadata = {
  title: 'Admin · Our Story Editor — Dear Tennis',
  robots: { index: false, follow: false },
};

export default async function AdminOurStoryPage() {
  const initial = await getOurStoryContentForAdmin();
  return (
    <AdminAuthGate>
      <OurStoryEditorClient initial={initial} />
    </AdminAuthGate>
  );
}
