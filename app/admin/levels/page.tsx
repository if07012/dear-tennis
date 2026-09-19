import { LevelsClient } from './LevelsClient';
import { listLevels } from '@/lib/tennis-level-store';

export default async function LevelsPage() {
  const levels = await listLevels();
  return <LevelsClient initial={levels} />;
}