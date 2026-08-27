// ============================================
// FAQ TYPES
// ============================================
// Schema for the admin-editable "Frequently Asked Questions" section on the
// home page. One settings row + N Q&A rows.
//
// Sheet schema (created on first save):
//   faq_settings: id,tag,title,subtitle,updatedAt
//   faq_items:    id,question,answer,order,createdAt

export type FAQSettings = {
  id: string; // always "current" — single-row sheet
  tag: string;
  title: string;
  subtitle: string;
  updatedAt: string;
};

export type FAQ = {
  id: string;
  question: string;
  answer: string;
  order: number;
  createdAt?: string;
};

export type FAQContent = {
  settings: FAQSettings;
  items: FAQ[];
};

export const FAQ_SETTINGS_HEADERS = [
  'id',
  'tag',
  'title',
  'subtitle',
  'updatedAt',
] as const;

export const FAQ_ITEM_HEADERS = [
  'id',
  'question',
  'answer',
  'order',
  'createdAt',
] as const;