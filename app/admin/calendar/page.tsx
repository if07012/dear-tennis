import { AdminAuthGate } from '../hero/AdminAuthGate';
import { CalendarEditorClient } from './CalendarEditorClient';
import { getCalendarContentForAdmin } from '@/lib/calendar-store';

// Server-rendered admin shell. We fetch the first page of events server-side
// (admin auth is handled inside the auth gate) and pass it as the initial
// snapshot to the client editor, which lazy-loads subsequent pages on demand.
export const metadata = {
  title: 'Admin · Calendar Editor — Dear Tennis',
  robots: { index: false, follow: false },
};

const ADMIN_PAGE_SIZE = 5;

export default async function AdminCalendarPage() {
  const initial = await getCalendarContentForAdmin({
    page: 1,
    pageSize: ADMIN_PAGE_SIZE,
  });
  return (
    <AdminAuthGate>
      <CalendarEditorClient initial={initial} />
    </AdminAuthGate>
  );
}
