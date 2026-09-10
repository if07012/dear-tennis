// ============================================
// HERO DATA STORE
// ============================================
// Reads/writes the hero content (settings + slides) from a Google Sheet.
// All I/O goes through the existing helpers in app/lib/supabase.ts so we
// inherit the in-memory doc/row cache + invalidation.
//
// Public reads via getHeroContent() are additionally cached in-memory until
// clearHeroContentCache() runs (called by /api/hero mutations).
//
// Sheet schema (created on first save):
//   hero_settings: id,title,subtitle,description,ctaPrimaryLabel,ctaPrimaryHref,
//                  ctaSecondaryLabel,ctaSecondaryHref,updatedAt
//   hero_slides:   id,image,alt,order,createdAt

import {
  ensureSheetWithHeaders,
  getSpreadsheetId,
  listRowsBySheet,
} from '@/app/lib/supabase';
import { heroSlides as fallbackSlides } from '@/data/hero-slides';
import {
  HERO_SETTINGS_HEADERS,
  HERO_SLIDE_HEADERS,
  type HeroContent,
  type HeroSettings,
  type HeroSlideData,
} from '@/data/hero-types';

const SETTINGS_SHEET = 'hero_settings';
const SLIDES_SHEET = 'hero_slides';
const SETTINGS_ROW_ID = 'current';

const HERO_CONTENT_CACHE_KEY = 'hero:content';

function getHeroContentCacheStore() {
  const g = globalThis as unknown as {
    __hero_content_cache__?: Map<string, HeroContent>;
  };
  if (!g.__hero_content_cache__) {
    g.__hero_content_cache__ = new Map<string, HeroContent>();
  }
  return g.__hero_content_cache__;
}

/** Clears the cached public hero payload (call after admin writes). */
export function clearHeroContentCache() {
  getHeroContentCacheStore().clear();
}

export function isAdminEmail(email: string | null | undefined): boolean {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!adminEmail || !email) return false;
  return email.trim().toLowerCase() === adminEmail;
}

export function getDefaultHeroContent(): HeroContent {
  const now = new Date().toISOString();
  return {
    settings: {
      id: SETTINGS_ROW_ID,
      title: 'More Than Just a Game.',
      subtitle: "It's a Community.",
      description:
        'Where passion meets connection. Join Dear Tennis and become part of something extraordinary.',
      ctaPrimaryLabel: 'Start Your Journey',
      ctaPrimaryHref: '/#cta',
      ctaSecondaryLabel: 'Learn More',
      ctaSecondaryHref: '/#about',
      updatedAt: now,
    },
    slides: fallbackSlides.map((slide, idx) => ({
      id: String(slide.id ?? idx),
      image: slide.image,
      alt: slide.alt,
      order: idx,
    })),
  };
}

function coerceSettings(rows: Record<string, unknown>[]): HeroSettings {
  const found = rows.find(
    (r) => String(r.id ?? '').trim() === SETTINGS_ROW_ID,
  );
  if (!found) return getDefaultHeroContent().settings;
  return {
    id: SETTINGS_ROW_ID,
    title: String(found.title ?? ''),
    subtitle: String(found.subtitle ?? ''),
    description: String(found.description ?? ''),
    ctaPrimaryLabel: String(found.ctaPrimaryLabel ?? 'Start Your Journey'),
    ctaPrimaryHref: String(found.ctaPrimaryHref ?? '/#cta'),
    ctaSecondaryLabel: String(found.ctaSecondaryLabel ?? 'Learn More'),
    ctaSecondaryHref: String(found.ctaSecondaryHref ?? '/#about'),
    updatedAt: String(found.updatedAt ?? new Date().toISOString()),
  };
}

function coerceSlides(rows: Record<string, unknown>[]): HeroSlideData[] {
  const out = rows
    .filter((r) => String(r.image ?? '').trim().length > 0)
    .map((r, idx) => ({
      id: String(r.id ?? '').trim() || `fallback-${idx}`,
      image: String(r.image ?? ''),
      alt: String(r.alt ?? ''),
      order: Number(r.order ?? idx),
      createdAt: r.createdAt ? String(r.createdAt) : undefined,
    }));
  return out.sort((a, b) => a.order - b.order);
}

async function fetchHeroContentFromSheet(spreadsheetId: string): Promise<HeroContent> {
  const [settingsRows, slideRows] = await Promise.all([
    listRowsBySheet(spreadsheetId, SETTINGS_SHEET),
    listRowsBySheet(spreadsheetId, SLIDES_SHEET),
  ]);
  const settings = coerceSettings(settingsRows);
  const slides = coerceSlides(slideRows);
  if (slides.length === 0) {
    // No slides in the sheet yet — fall back to bundled so the public page
    // never shows an empty hero. Admins can still edit/delete them later.
    return { settings, slides: getDefaultHeroContent().slides };
  }
  return { settings, slides };
}

export async function getHeroContent(): Promise<HeroContent> {
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) return getDefaultHeroContent();

  const cacheKey = `${HERO_CONTENT_CACHE_KEY}:${spreadsheetId}`;
  const cached = getHeroContentCacheStore().get(cacheKey);
  if (cached) return cached;

  try {
    const content = await fetchHeroContentFromSheet(spreadsheetId);
    getHeroContentCacheStore().set(cacheKey, content);
    return content;
  } catch (error) {
    console.error('Failed to read hero content, falling back to defaults:', error);
    return getDefaultHeroContent();
  }
}

/**
 * Used by the admin editor — always reads the sheet even when no rows exist,
 * returning the seeded default settings + empty slides list so the editor can
 * populate the form on first visit.
 */
export async function getHeroContentForAdmin(): Promise<HeroContent> {
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) return getDefaultHeroContent();

  try {
    const [settingsRows, slideRows] = await Promise.all([
      listRowsBySheet(spreadsheetId, SETTINGS_SHEET),
      listRowsBySheet(spreadsheetId, SLIDES_SHEET),
    ]);
    return {
      settings: coerceSettings(settingsRows),
      slides: coerceSlides(slideRows),
    };
  } catch (error) {
    console.error('Failed to read hero content for admin:', error);
    return getDefaultHeroContent();
  }
}

export { SETTINGS_SHEET, SLIDES_SHEET, SETTINGS_ROW_ID };
export type { HeroContent, HeroSettings, HeroSlideData };
export { HERO_SETTINGS_HEADERS, HERO_SLIDE_HEADERS };

// Re-exported helpers so admin route stays thin.
export async function ensureHeroSheets(spreadsheetId: string) {
  await Promise.all([
    ensureSheetWithHeaders(spreadsheetId, SETTINGS_SHEET, [...HERO_SETTINGS_HEADERS]),
    ensureSheetWithHeaders(spreadsheetId, SLIDES_SHEET, [...HERO_SLIDE_HEADERS]),
  ]);
}

export async function getSettingsRowId(spreadsheetId: string): Promise<string | null> {
  try {
    const rows = await listRowsBySheet(spreadsheetId, SETTINGS_SHEET);
    const found = rows.some(
      (r) => String(r.id ?? '').trim() === SETTINGS_ROW_ID,
    );
    return found ? SETTINGS_ROW_ID : null;
  } catch {
    return null;
  }
}
