// ============================================
// GALLERY TYPES
// ============================================
// Schema for the admin-editable "Gallery" section on the home page.
// One settings row + N image rows.
//
// Sheet schema (created on first save):
//   gallery_settings: id,tag,title,subtitle,updatedAt
//   gallery_items:    id,src,alt,large,order,createdAt

export type GallerySettings = {
  id: string; // always "current" — single-row sheet
  tag: string;
  title: string;
  subtitle: string;
  updatedAt: string;
};

export type GalleryItem = {
  id: string;
  src: string; // image URL (Unsplash or any https URL)
  alt: string;
  large?: boolean; // featured tile: spans 2 cols × 2 rows on the home grid
  order: number;
  createdAt?: string;
};

export type GalleryContent = {
  settings: GallerySettings;
  items: GalleryItem[];
};

export const GALLERY_SETTINGS_HEADERS = [
  'id',
  'tag',
  'title',
  'subtitle',
  'updatedAt',
] as const;

export const GALLERY_ITEM_HEADERS = [
  'id',
  'src',
  'alt',
  'large',
  'order',
  'createdAt',
] as const;
