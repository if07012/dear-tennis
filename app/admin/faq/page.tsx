import { AdminAuthGate } from '../hero/AdminAuthGate';
import { FAQEditorClient } from './FAQEditorClient';
import { getFAQContentForAdmin } from '@/lib/faq-store';

export const metadata = {
  title: 'Admin · FAQ Editor — Dear Tennis',
  robots: { index: false, follow: false },
};

const ADMIN_PAGE_SIZE = 5;

export default async function AdminFAQPage() {
  const initial = await getFAQContentForAdmin({
    page: 1,
    pageSize: ADMIN_PAGE_SIZE,
  });
  return (
    <AdminAuthGate>
      <FAQEditorClient initial={initial} />
    </AdminAuthGate>
  );
}