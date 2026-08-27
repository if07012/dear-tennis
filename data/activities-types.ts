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
] as const;

export const ALL_CATEGORIES: ActivityCategory[] = ['training', 'social', 'competitive'];

export function isValidCategory(value: string): value is ActivityCategory {
  return (ALL_CATEGORIES as string[]).includes(value);
}
