import { BadgeManagementClient } from './BadgeManagementClient';
import { listBadgeCatalog } from '@/lib/tennis-level-store';

export default async function BadgeManagementPage() {
  const badges = await listBadgeCatalog();
  return <BadgeManagementClient initialBadges={badges} />;
}