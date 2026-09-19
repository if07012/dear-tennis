import { LevelsBadgesClient } from '../LevelsBadgesClient';
import { listLevels } from '@/lib/tennis-level-store';
import { listBadgeCatalog } from '@/lib/tennis-level-store';

export default async function LevelsBadgesPage() {
  const [levels, badges] = await Promise.all([listLevels(), listBadgeCatalog()]);
  return <LevelsBadgesClient initialLevels={levels} initialBadges={badges} />;
}