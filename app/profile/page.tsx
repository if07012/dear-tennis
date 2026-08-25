import { ChartScript } from './ChartScript';
import { ProfilePageClient } from './ProfilePageClient';

export const metadata = {
  title: 'Profile — Dear Tennis',
  description: 'Dashboard latihan, skill breakdown, dan riwayat event kamu.',
};

export default function ProfilePage() {
  return (
    <>
      <ChartScript />
      <ProfilePageClient />
    </>
  );
}