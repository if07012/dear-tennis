// ============================================
// ACHIEVEMENTS TYPES
// ============================================
// Admin-curated badge catalog + per-user grants. Two Google Sheets:
//   - `badges`        : one row per badge the admin can grant.
//   - `user_badges`   : one row per (user, badge) grant.
//
// The admin user-management page lets the admin grant/revoke a badge for
// a given user via a popover. The profile Achievements panel renders the
// catalog entries the signed-in user (or the admin's view-as target) has
// been granted; the sidebar "Badges" stat counts those grants.

export const BADGE_HEADERS = [
  'id',
  'key',
  'label',
  'icon',
  'description',
  'archived',
  'createdAt',
] as const;

export const USER_BADGE_HEADERS = [
  'id',
  'userEmail',
  'badgeKey',
  'grantedAt',
  'grantedBy',
  'note',
] as const;

export type BadgeCatalogRecord = {
  id: string;
  /** Stable slug used as the grant key (e.g. "champion"). */
  key: string;
  label: string;
  /** Emoji or short string rendered on the profile card. */
  icon: string;
  description: string;
  archived: boolean;
  createdAt: string;
};

export type BadgeGrantRecord = {
  id: string;
  userEmail: string;
  badgeKey: string;
  grantedAt: string;
  grantedBy: string;
  note: string;
};

/** Joined view: a catalog entry paired with the grant metadata. */
export type GrantedBadge = BadgeCatalogRecord & {
  grantedAt: string;
  grantedBy: string;
  note: string;
};