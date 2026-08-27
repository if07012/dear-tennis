import { AdminAuthGate } from '../hero/AdminAuthGate';
import { GalleryEditorClient } from './GalleryEditorClient';
import { getGalleryContentForAdmin } from '@/lib/gallery-store';

export const metadata = {
  title: 'Admin · Gallery Editor — Dear Tennis',
  robots: { index: false, follow: false },
};

const ADMIN_PAGE_SIZE = 5;

export default async function AdminGalleryPage() {
  const initial = await getGalleryContentForAdmin({
    page: 1,
    pageSize: ADMIN_PAGE_SIZE,
  });
  return (
    <AdminAuthGate>
      <GalleryEditorClient initial={initial} />
    </AdminAuthGate>
  );
}
