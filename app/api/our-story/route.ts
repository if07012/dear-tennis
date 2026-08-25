// ============================================
// /api/our-story — Our Story content read + admin write
// ============================================
//
// GET → public. Returns the OurStorySettings from the Google Sheet (falls back
//       to bundled defaults when HERO_SPREADSHEET_ID is unset).
// PUT → admin. Upserts the single settings row. Caller email must match
//       ADMIN_EMAIL; checked server-side from the `x-auth-email` header.

import { NextResponse } from 'next/server';
import {
  createRowWithId,
  updateRowById,
} from '@/app/lib/googleSheets';
import {
  clearOurStoryContentCache,
  ensureOurStorySheets,
  getOurStoryContent,
  getOurStorySettingsRowId,
  OUR_STORY_SHEET,
  SETTINGS_ROW_ID,
} from '@/lib/our-story-store';
import type { OurStorySettings } from '@/data/our-story-types';

function getSpreadsheetId(): string | null {
  const id = process.env.HERO_SPREADSHEET_ID;
  return id && id.trim().length > 0 ? id : null;
}

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

function serverError(message: string) {
  return NextResponse.json({ error: message }, { status: 500 });
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function getRequesterEmail(request: Request): string | null {
  const header = request.headers.get('x-auth-email');
  return header && header.trim().length > 0 ? header.trim().toLowerCase() : null;
}

function isAdminEmail(email: string | null): boolean {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!adminEmail || !email) return false;
  return email === adminEmail;
}

function invalidateCache() {
  clearOurStoryContentCache();
}

export async function GET() {
  const settings = await getOurStoryContent();
  return NextResponse.json(settings);
}

type SettingsBody = Omit<OurStorySettings, 'id' | 'updatedAt'> & {
  updatedAt?: string;
};

export async function PUT(request: Request) {
  const email = getRequesterEmail(request);
  if (!isAdminEmail(email)) return unauthorized();

  let body: SettingsBody;
  try {
    body = (await request.json()) as SettingsBody;
  } catch {
    return badRequest('Invalid JSON');
  }

  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) return serverError('HERO_SPREADSHEET_ID is not set');

  try {
    await ensureOurStorySheets(spreadsheetId);

    const next: OurStorySettings = {
      id: SETTINGS_ROW_ID,
      tag: String(body.tag ?? '').trim(),
      title: String(body.title ?? '').trim(),
      subtitle: String(body.subtitle ?? '').trim(),
      lead: String(body.lead ?? '').trim(),
      body: String(body.body ?? '').trim(),
      closing: String(body.closing ?? '').trim(),
      image: String(body.image ?? '').trim(),
      imageAlt: String(body.imageAlt ?? '').trim(),
      updatedAt: body.updatedAt ?? new Date().toISOString(),
    };

    const existingId = await getOurStorySettingsRowId(spreadsheetId);
    if (existingId) {
      await updateRowById(spreadsheetId, OUR_STORY_SHEET, SETTINGS_ROW_ID, next);
    } else {
      await createRowWithId(spreadsheetId, OUR_STORY_SHEET, next);
    }
    invalidateCache();
    return NextResponse.json({ ok: true, settings: next });
  } catch (error) {
    console.error('Error in PUT /api/our-story:', error);
    return serverError('Failed to save our-story content');
  }
}

export async function POST(request: Request) {
  return PUT(request);
}
