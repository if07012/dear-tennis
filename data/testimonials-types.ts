// ============================================
// TESTIMONIALS (MEMBER EXPERIENCES) TYPES
// ============================================
// Schema for the admin-editable "Member Experiences" section on the home page.
// One settings row + N testimonial rows.
//
// Sheet schema (created on first save):
//   testimonials_settings: id,tag,title,subtitle,updatedAt
//   testimonials_items:    id,quote,name,since,avatar,order,createdAt

export type TestimonialsSettings = {
  id: string; // always "current" — single-row sheet
  tag: string;
  title: string;
  subtitle: string;
  updatedAt: string;
};

export type Testimonial = {
  id: string;
  quote: string;
  name: string;
  since: string;
  avatar: string; // avatar image URL
  order: number;
  createdAt?: string;
};

export type TestimonialsContent = {
  settings: TestimonialsSettings;
  items: Testimonial[];
};

export const TESTIMONIALS_SETTINGS_HEADERS = [
  'id',
  'tag',
  'title',
  'subtitle',
  'updatedAt',
] as const;

export const TESTIMONIAL_ITEM_HEADERS = [
  'id',
  'quote',
  'name',
  'since',
  'avatar',
  'order',
  'createdAt',
] as const;
