import { AdminAuthGate } from './AdminAuthGate';
import { HeroEditorClient } from './HeroEditorClient';
import { getHeroContentForAdmin } from '@/lib/hero-store';

export const metadata = {
  title: 'Admin · Hero Editor — Dear Tennis',
  robots: { index: false, follow: false },
};

export default async function AdminHeroPage() {
  const initial = await getHeroContentForAdmin();
  return (
    <AdminAuthGate>
      <HeroEditorClient initial={initial} />
    </AdminAuthGate>
  );
}
