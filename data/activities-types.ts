// ============================================
// ACTIVITIES & PROGRAMS TYPES
// ============================================
// Schema for the admin-editable "Activities & Programs" section on the home
// page. One settings row + N activity rows.

export type ActivityCategory = 'training' | 'social' | 'competitive';

export type ActivitiesSettings = {
  id: string; // always "current" — single-row sheet
  tag: string;
  title: string;
  subtitle: string;
  updatedAt: string;
};

export type ActivityItem = {
  id: string;
  category: ActivityCategory;
  title: string;
  description: string;
  image: string;
  duration: string;
  groupSize: string;
  location: string;
  time: string;
  order: number;
  createdAt?: string;
  /**
   * Admin-only flag: when true, the home-page Join button is replaced by a
   * disabled "Full Book" button. Existing approved signups still apply —
   * flipping the flag back to false re-opens registration. Optional so
   * older rows that pre-date the column read as false.
   */
  isFull?: boolean;
  /**
   * Admin-only flag: when true, the activity is hidden from the home page
   * (and the public 6-card list) but remains in the admin editor for
   * reference and reactivation. Optional so older rows read as false.
   */
  archived?: boolean;
  /**
   * Display price, free text ("Rp 50.000", "$10"). Optional — older rows
   * have no price and the UI hides the line.
   */
  price?: string;
  /**
   * CSV of trained skills (subset of the 6 skill keys). Used by the
   * WhatsApp bot to recommend activities that train a member's weakest
   * skill. Optional so older rows read as ''.
   */
  skillTags?: string;
};

export type ActivitiesContent = {
  settings: ActivitiesSettings;
  activities: ActivityItem[];
};

export const ACTIVITIES_SETTINGS_HEADERS = [
  'id',
  'tag',
  'title',
  'subtitle',
  'updatedAt',
] as const;

export const ACTIVITY_HEADERS = [
  'id',
  'category',
  'title',
  'description',
  'image',
  'duration',
  'groupSize',
  'location',
  'time',
  'order',
  'createdAt',
  'isFull',
  'archived',
  'price',
  'skillTags',
] as const;

export const ALL_CATEGORIES: ActivityCategory[] = ['training', 'social', 'competitive'];

export function isValidCategory(value: string): value is ActivityCategory {
  return (ALL_CATEGORIES as string[]).includes(value);
}
