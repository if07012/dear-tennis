// ============================================
// CALENDAR (EVENTS) TYPES
// ============================================
// Schema for the admin-editable "Calendar" section on the home page.
// One settings row + N event rows.

export type CalendarSettings = {
  id: string; // always "current" — single-row sheet
  tag: string;
  title: string;
  updatedAt: string;
};

export type CalendarEvent = {
  id: string;
  day: string; // e.g. "15"
  month: string; // e.g. "JAN"
  title: string;
  description: string;
  location: string;
  time: string;
  ctaLabel: string;
  ctaHref: string;
  order: number;
  createdAt?: string;
};

export type CalendarContent = {
  settings: CalendarSettings;
  events: CalendarEvent[];
};

export const CALENDAR_SETTINGS_HEADERS = [
  'id',
  'tag',
  'title',
  'updatedAt',
] as const;

export const CALENDAR_EVENT_HEADERS = [
  'id',
  'day',
  'month',
  'title',
  'description',
  'location',
  'time',
  'ctaLabel',
  'ctaHref',
  'order',
  'createdAt',
] as const;
