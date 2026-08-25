// ============================================
// HERO CONTENT TYPES
// ============================================
// Schema shared between the admin editor (writes to a Google Sheet) and the
// home page (reads at SSR). The settings sheet is single-row; the slides
// sheet has one row per slide.

export type HeroSettings = {
  id: string; // always "current" — single-row sheet
  title: string;
  subtitle: string;
  description: string;
  ctaPrimaryLabel: string;
  ctaPrimaryHref: string;
  ctaSecondaryLabel: string;
  ctaSecondaryHref: string;
  updatedAt: string;
};

export type HeroSlideData = {
  id: string;
  image: string;
  alt: string;
  order: number;
  createdAt?: string;
};

export type HeroContent = {
  settings: HeroSettings;
  slides: HeroSlideData[];
};

export const HERO_SETTINGS_HEADERS = [
  'id',
  'title',
  'subtitle',
  'description',
  'ctaPrimaryLabel',
  'ctaPrimaryHref',
  'ctaSecondaryLabel',
  'ctaSecondaryHref',
  'updatedAt',
] as const;

export const HERO_SLIDE_HEADERS = ['id', 'image', 'alt', 'order', 'createdAt'] as const;
