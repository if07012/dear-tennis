// ============================================
// WHY JOIN (BENEFITS SECTION) TYPES
// ============================================
// Schema for the admin-editable "Why Join" section on the home page.
// One settings row + N benefit rows.

export type BenefitIconKey =
  | 'users'
  | 'lightning'
  | 'calendar'
  | 'layers'
  | 'clock'
  | 'heart'
  | 'trophy'
  | 'star'
  | 'target'
  | 'sparkles';

export type WhyJoinSettings = {
  id: string; // always "current" — single-row sheet
  tag: string;
  title: string;
  subtitle: string;
  updatedAt: string;
};

export type BenefitItem = {
  id: string;
  title: string;
  description: string;
  icon: BenefitIconKey;
  order: number;
  createdAt?: string;
};

export type WhyJoinContent = {
  settings: WhyJoinSettings;
  benefits: BenefitItem[];
};

export const WHY_JOIN_SETTINGS_HEADERS = [
  'id',
  'tag',
  'title',
  'subtitle',
  'updatedAt',
] as const;

export const WHY_JOIN_BENEFIT_HEADERS = [
  'id',
  'title',
  'description',
  'icon',
  'order',
  'createdAt',
] as const;
