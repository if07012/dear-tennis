// ============================================
// WHY JOIN (BENEFITS) DATA STORE
// ============================================
// Reads/writes the "Why Join" section (settings + benefit cards) from a
// Google Sheet. Reuses the existing helpers in app/lib/googleSheets.ts.
//
// Sheet schema (created on first save):
//   why_join_settings: id,tag,title,subtitle,updatedAt
//   why_join_benefits: id,title,description,icon,order,createdAt

import {
  ensureSheetWithHeaders,
  getGoogleSheet,
  listRowsBySheet,
} from '@/app/lib/googleSheets';
import { benefits as fallbackBenefits } from '@/data/benefits';
import {
  WHY_JOIN_SETTINGS_HEADERS,
  WHY_JOIN_BENEFIT_HEADERS,
  type BenefitIconKey,
  type BenefitItem,
  type WhyJoinContent,
  type WhyJoinSettings,
} from '@/data/why-join-types';

const SETTINGS_SHEET = 'why_join_settings';
const BENEFITS_SHEET = 'why_join_benefits';
const SETTINGS_ROW_ID = 'current';

const ALL_ICON_KEYS: BenefitIconKey[] = [
  'users',
  'lightning',
  'calendar',
  'layers',
  'clock',
  'heart',
  'trophy',
  'star',
  'target',
  'sparkles',
];

function isValidIcon(value: string): value is BenefitIconKey {
  return (ALL_ICON_KEYS as string[]).includes(value);
}

const WHY_JOIN_CACHE_KEY = 'why-join:content';

function getCacheStore() {
  const g = globalThis as unknown as {
    __why_join_cache__?: Map<string, WhyJoinContent>;
  };
  if (!g.__why_join_cache__) {
    g.__why_join_cache__ = new Map<string, WhyJoinContent>();
  }
  return g.__why_join_cache__;
}

export function clearWhyJoinContentCache() {
  getCacheStore().clear();
}

function getSpreadsheetId(): string | null {
  const id = process.env.HERO_SPREADSHEET_ID;
  return id && id.trim().length > 0 ? id : null;
}

export function isAdminEmail(email: string | null | undefined): boolean {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!adminEmail || !email) return false;
  return email.trim().toLowerCase() === adminEmail;
}

export function getDefaultWhyJoinContent(): WhyJoinContent {
  const now = new Date().toISOString();
  return {
    settings: {
      id: SETTINGS_ROW_ID,
      tag: 'Benefits',
      title: 'Why Choose Dear Tennis?',
      subtitle: 'More than just a tennis club – we are a family',
      updatedAt: now,
    },
    benefits: fallbackBenefits.map((b, idx) => ({
      id: b.id,
      title: b.title,
      description: b.description,
      icon: isValidIcon(b.icon) ? (b.icon as BenefitIconKey) : 'users',
      order: idx,
    })),
  };
}

function coerceSettings(rows: Record<string, unknown>[]): WhyJoinSettings {
  const found = rows.find(
    (r) => String(r.id ?? '').trim() === SETTINGS_ROW_ID,
  );
  const defaults = getDefaultWhyJoinContent().settings;
  if (!found) return defaults;
  return {
    id: SETTINGS_ROW_ID,
    tag: String(found.tag ?? defaults.tag),
    title: String(found.title ?? defaults.title),
    subtitle: String(found.subtitle ?? defaults.subtitle),
    updatedAt: String(found.updatedAt ?? new Date().toISOString()),
  };
}

function coerceBenefits(rows: Record<string, unknown>[]): BenefitItem[] {
  const out = rows
    .filter((r) => String(r.title ?? '').trim().length > 0)
    .map((r, idx) => {
      const iconRaw = String(r.icon ?? 'users');
      return {
        id: String(r.id ?? '').trim() || `fallback-${idx}`,
        title: String(r.title ?? ''),
        description: String(r.description ?? ''),
        icon: isValidIcon(iconRaw) ? iconRaw : 'users',
        order: Number(r.order ?? idx),
        createdAt: r.createdAt ? String(r.createdAt) : undefined,
      };
    });
  return out.sort((a, b) => a.order - b.order);
}

async function fetchFromSheet(spreadsheetId: string): Promise<WhyJoinContent> {
  const [settingsRows, benefitRows] = await Promise.all([
    listRowsBySheet(spreadsheetId, SETTINGS_SHEET),
    listRowsBySheet(spreadsheetId, BENEFITS_SHEET),
  ]);
  const settings = coerceSettings(settingsRows);
  const benefits = coerceBenefits(benefitRows);
  if (benefits.length === 0) {
    return { settings, benefits: getDefaultWhyJoinContent().benefits };
  }
  return { settings, benefits };
}

export async function getWhyJoinContent(): Promise<WhyJoinContent> {
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) return getDefaultWhyJoinContent();

  const cacheKey = `${WHY_JOIN_CACHE_KEY}:${spreadsheetId}`;
  const cached = getCacheStore().get(cacheKey);
  if (cached) return cached;

  try {
    const content = await fetchFromSheet(spreadsheetId);
    getCacheStore().set(cacheKey, content);
    return content;
  } catch (error) {
    console.error('Failed to read why-join content, falling back to defaults:', error);
    return getDefaultWhyJoinContent();
  }
}

export async function getWhyJoinContentForAdmin(): Promise<WhyJoinContent> {
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) return getDefaultWhyJoinContent();
  try {
    return await fetchFromSheet(spreadsheetId);
  } catch (error) {
    console.error('Failed to read why-join content for admin:', error);
    return getDefaultWhyJoinContent();
  }
}

export async function ensureWhyJoinSheets(spreadsheetId: string) {
  await Promise.all([
    ensureSheetWithHeaders(spreadsheetId, SETTINGS_SHEET, [...WHY_JOIN_SETTINGS_HEADERS]),
    ensureSheetWithHeaders(spreadsheetId, BENEFITS_SHEET, [...WHY_JOIN_BENEFIT_HEADERS]),
  ]);
}

export async function getWhyJoinSettingsRowId(
  spreadsheetId: string,
): Promise<string | null> {
  const doc = await getGoogleSheet(spreadsheetId);
  const sheet = doc.sheetsByTitle[SETTINGS_SHEET];
  if (!sheet) return null;
  const rows = await sheet.getRows();
  const found = rows.find(
    (r) => String(r.toObject().id ?? '').trim() === SETTINGS_ROW_ID,
  );
  return found ? SETTINGS_ROW_ID : null;
}

export {
  SETTINGS_SHEET as WHY_JOIN_SHEET,
  BENEFITS_SHEET as WHY_JOIN_BENEFITS_SHEET,
  SETTINGS_ROW_ID,
  ALL_ICON_KEYS,
};
export type { WhyJoinContent, WhyJoinSettings, BenefitItem, BenefitIconKey };
export { WHY_JOIN_SETTINGS_HEADERS, WHY_JOIN_BENEFIT_HEADERS };
