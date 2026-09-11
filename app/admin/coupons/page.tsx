import { AdminAuthGate } from '../hero/AdminAuthGate';
import { CouponsClient } from './CouponsClient';
import { listClaims, listCoupons } from '@/lib/coupons-store';
import { getActivitiesContentForAdmin } from '@/lib/activities-store';

export const metadata = {
  title: 'Admin · Coupons — Dear Tennis',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminCouponsPage() {
  // Tables may not exist yet (fresh install) — fall back to empty lists so
  // the page still renders and the admin can create the first coupon.
  const empty = { coupons: [] as Awaited<ReturnType<typeof listCoupons>>, claims: [] as Awaited<ReturnType<typeof listClaims>> };
  let data = empty;
  let activities: { id: string; title: string }[] = [];
  try {
    const [coupons, claims, content] = await Promise.all([
      listCoupons(),
      listClaims(),
      getActivitiesContentForAdmin(),
    ]);
    data = { coupons, claims };
    activities = content.activities
      .filter((a) => a.archived !== true)
      .map((a) => ({ id: a.id, title: a.title }));
  } catch {
    // keep empty defaults
  }

  return (
    <AdminAuthGate>
      <CouponsClient
        initialCoupons={data.coupons}
        initialClaims={data.claims}
        activities={activities}
      />
    </AdminAuthGate>
  );
}
