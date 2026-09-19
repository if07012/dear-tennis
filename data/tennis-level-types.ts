// ============================================
// TENNIS LEVEL & BADGE TYPES
// ============================================
// Extended types for the Player Level & Badge System per PRD.

export const LEVEL_HEADERS = [
  'id',
  'name',
  'description',
  'order',
  'isActive',
  'createdAt',
] as const;

export const LEVEL_BADGE_HEADERS = [
  'id',
  'levelId',
  'badgeKey',
] as const;

export const BADGE_HEADERS = [
  'id',
  'key',
  'label',
  'icon',
  'description',
  'type',           // 'skill' | 'achievement'
  'category',
  'earningCriteria',
  'archived',
  'createdAt',
] as const;

export const USER_BADGE_HEADERS = [
  'id',
  'userEmail',
  'badgeKey',
  'status',         // 'active' | 'revoked'
  'grantedAt',
  'grantedBy',
  'revokedAt',
  'revokedBy',
  'note',
] as const;

export type BadgeType = 'skill' | 'achievement';
export type BadgeStatus = 'active' | 'revoked';

export type LevelRecord = {
  id: string;
  name: string;
  description: string;
  order: number;
  isActive: boolean;
  createdAt: string;
};

export type LevelBadgeRecord = {
  id: string;
  levelId: string;
  badgeKey: string;
};

export type BadgeCatalogRecord = {
  id: string;
  key: string;
  label: string;
  icon: string;
  description: string;
  type: BadgeType;
  category: string;
  earningCriteria: string;
  archived: boolean;
  createdAt: string;
};

export type BadgeGrantRecord = {
  id: string;
  userEmail: string;
  badgeKey: string;
  status: BadgeStatus;
  grantedAt: string;
  grantedBy: string;
  revokedAt: string | null;
  revokedBy: string | null;
  note: string;
};

/** Joined view: a catalog entry paired with the grant metadata. */
export type GrantedBadge = BadgeCatalogRecord & {
  userEmail: string;
  badgeKey: string;
  status: BadgeStatus;
  grantedAt: string;
  grantedBy: string;
  revokedAt: string | null;
  revokedBy: string | null;
  note: string;
};

/** Player level computation result. */
export type PlayerLevelResult = {
  currentLevel: LevelRecord | null;
  nextLevel: LevelRecord | null;
  progress: {
    earned: number;
    required: number;
  };
  missingBadges: string[]; // badge keys
  allLevels: LevelRecord[];
};