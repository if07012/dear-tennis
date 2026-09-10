// ============================================
// /api/hero — Hero content read + admin write
// ============================================
//
// GET  → public. Returns { settings, slides } from the Google Sheet (falls back
//        to bundled defaults when Supabase is unset).
//
// Mutations are dispatched by a `kind` field in the JSON body:
//
//   { kind: 'settings', settings: { title, subtitle, ... } }   → upsert the
//                                                                single settings row
//   { kind: 'slide',    slide:    { id?, image, alt } }         → create (no id)
//                                                                or update (id set)
//   { kind: 'reorder',  ids:      string[] }                    → persist slide order
//   { kind: 'delete',   id:       string }                      → delete a slide
//
// All mutating requests require the caller's email to match ADMIN_EMAIL.

import { NextResponse } from 'next/server';
import {
  createRowWithId,
  deleteRowById,
  getSpreadsheetId,
  updateRowById,
} from '@/app/lib/supabase';
import crypto from 'crypto';
import {
  clearHeroContentCache,
  ensureHeroSheets,
  getHeroContent,
  getHeroContentForAdmin,
  getSettingsRowId,
  isAdminEmail,
  SETTINGS_SHEET,
  SETTINGS_ROW_ID,
  SLIDES_SHEET,
} from '@/lib/hero-store';
import type { HeroSettings, HeroSlideData } from '@/data/hero-types';

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

function serverError(message: string) {
  return NextResponse.json({ error: message }, { status: 500 });
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

// Header used by the client editor to pass the logged-in user's email so the
// route can re-check admin without a session cookie. The client also stores
// the email in localStorage; we accept it as a custom header.
function getRequesterEmail(request: Request): string | null {
  const header = request.headers.get('x-auth-email');
  return header && header.trim().length > 0 ? header.trim().toLowerCase() : null;
}

function invalidateHeroCache() {
  clearHeroContentCache();
}

export async function GET() {
  const content = await getHeroContent();
  return NextResponse.json(content);
}

type SettingsBody = {
  kind: 'settings';
  settings: Omit<HeroSettings, 'id' | 'updatedAt'> & { updatedAt?: string };
};

type SlideUpsertBody = {
  kind: 'slide';
  slide: { id?: string; image: string; alt: string };
};

type ReorderBody = {
  kind: 'reorder';
  ids: string[];
};

type DeleteBody = {
  kind: 'delete';
  id: string;
};

type MutateBody = SettingsBody | SlideUpsertBody | ReorderBody | DeleteBody;

export async function PUT(request: Request) {
  const email = getRequesterEmail(request);
  if (!isAdminEmail(email)) return unauthorized();

  let body: MutateBody;
  try {
    body = (await request.json()) as MutateBody;
  } catch {
    return badRequest('Invalid JSON');
  }

  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) return serverError('Supabase is not configured');

  try {
    await ensureHeroSheets(spreadsheetId);

    switch (body.kind) {
      case 'settings': {
        const next: HeroSettings = {
          id: SETTINGS_ROW_ID,
          title: String(body.settings.title ?? '').trim(),
          subtitle: String(body.settings.subtitle ?? '').trim(),
          description: String(body.settings.description ?? '').trim(),
          ctaPrimaryLabel: String(body.settings.ctaPrimaryLabel ?? '').trim(),
          ctaPrimaryHref: String(body.settings.ctaPrimaryHref ?? '').trim(),
          ctaSecondaryLabel: String(body.settings.ctaSecondaryLabel ?? '').trim(),
          ctaSecondaryHref: String(body.settings.ctaSecondaryHref ?? '').trim(),
          updatedAt: body.settings.updatedAt ?? new Date().toISOString(),
        };

        const existingId = await getSettingsRowId(spreadsheetId);
        if (existingId) {
          await updateRowById(spreadsheetId, SETTINGS_SHEET, SETTINGS_ROW_ID, next);
        } else {
          await createRowWithId(spreadsheetId, SETTINGS_SHEET, next);
        }
        invalidateHeroCache();
        return NextResponse.json({ ok: true, settings: next });
      }

      case 'slide': {
        const { slide } = body;
        if (!slide || typeof slide.image !== 'string' || slide.image.trim().length === 0) {
          return badRequest('image is required');
        }
        const alt = String(slide.alt ?? '').trim();
        const image = slide.image.trim();

        if (slide.id) {
          const existing = await getHeroContentForAdmin();
          const order =
            existing.slides.find((s) => s.id === slide.id)?.order ??
            existing.slides.length;
          await updateRowById(spreadsheetId, SLIDES_SHEET, slide.id, {
            image,
            alt,
            order,
          });
          const updated: HeroSlideData = { id: slide.id, image, alt, order };
          invalidateHeroCache();
          return NextResponse.json({ ok: true, slide: updated });
        }

        // Create new slide at the end of the list.
        const existing = await getHeroContentForAdmin();
        const order = existing.slides.length;
        const newId = crypto.randomUUID();
        await createRowWithId(spreadsheetId, SLIDES_SHEET, {
          id: newId,
          image,
          alt,
          order,
          createdAt: new Date().toISOString(),
        });
        const created: HeroSlideData = { id: newId, image, alt, order };
        invalidateHeroCache();
        return NextResponse.json({ ok: true, slide: created });
      }

      case 'reorder': {
        if (!Array.isArray(body.ids) || body.ids.length === 0) {
          return badRequest('ids must be a non-empty array');
        }
        await Promise.all(
          body.ids.map((id, idx) =>
            updateRowById(spreadsheetId, SLIDES_SHEET, id, { order: idx }),
          ),
        );
        invalidateHeroCache();
        return NextResponse.json({ ok: true });
      }

      case 'delete': {
        if (!body.id || typeof body.id !== 'string') {
          return badRequest('id is required');
        }
        await deleteRowById(spreadsheetId, SLIDES_SHEET, body.id);
        invalidateHeroCache();
        return NextResponse.json({ ok: true });
      }

      default:
        return badRequest('Unknown kind');
    }
  } catch (error) {
    console.error('Error in PUT /api/hero:', error);
    return serverError('Failed to save hero content');
  }
}

// Accept POST as an alias for PUT — Next.js route handlers commonly support
// either verb for "mutation" requests. We dispatch by `kind`.
export async function POST(request: Request) {
  return PUT(request);
}

export async function DELETE(request: Request) {
  // Allow { kind: 'delete', id } in body for symmetry.
  const email = getRequesterEmail(request);
  if (!isAdminEmail(email)) return unauthorized();
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) return serverError('Supabase is not configured');

  let body: DeleteBody;
  try {
    body = (await request.json()) as DeleteBody;
  } catch {
    return badRequest('Invalid JSON');
  }
  if (!body.id) return badRequest('id is required');

  try {
    await ensureHeroSheets(spreadsheetId);
    await deleteRowById(spreadsheetId, SLIDES_SHEET, body.id);
    invalidateHeroCache();
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error in DELETE /api/hero:', error);
    return serverError('Failed to delete slide');
  }
}
