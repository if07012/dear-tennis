import { AdminAuthGate } from '../hero/AdminAuthGate';
import { TestimonialsEditorClient } from './TestimonialsEditorClient';
import { getTestimonialsContentForAdmin } from '@/lib/testimonials-store';

export const metadata = {
  title: 'Admin · Testimonials Editor — Dear Tennis',
  robots: { index: false, follow: false },
};

const ADMIN_PAGE_SIZE = 5;

export default async function AdminTestimonialsPage() {
  const initial = await getTestimonialsContentForAdmin({
    page: 1,
    pageSize: ADMIN_PAGE_SIZE,
  });
  return (
    <AdminAuthGate>
      <TestimonialsEditorClient initial={initial} />
    </AdminAuthGate>
  );
}