// ============================================
// OUR STORY (ABOUT SECTION) TYPES
// ============================================
// Schema for the admin-editable "Our Story" section on the home page. Single-row
// sheet; the editor updates one row at a time.

export type OurStorySettings = {
  id: string; // always "current" — single-row sheet
  tag: string;
  title: string;
  subtitle: string;
  lead: string;
  body: string;
  closing: string;
  image: string;
  imageAlt: string;
  updatedAt: string;
};

export const OUR_STORY_SETTINGS_HEADERS = [
  'id',
  'tag',
  'title',
  'subtitle',
  'lead',
  'body',
  'closing',
  'image',
  'imageAlt',
  'updatedAt',
] as const;
