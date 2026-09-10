// ============================================
// /api/gallery — Gallery content read + admin write
// ============================================
//
// GET  → public. Accepts `?page=&pageSize=` only when `x-auth-email` matches
//        ADMIN_EMAIL; otherwise returns the full gallery for the home page.
//        Paginated requests return:
//          { settings, items, total, page, pageSize, totalPages }
//        Non-paginated (public) requests keep:
//          { settings, items }
// PUT dispatches by `kind`:
//   { kind: 'settings', settings: { tag, title, subtitle } }
//   { kind: 'item',    item:  { id?, src, alt, large } }
//   { kind: 'reorder', ids: string[] }
//   { kind: 'delete',  id: string }
//
// All mutations require ADMIN_EMAIL.

import { NextResponse } from 'next/server';
import crypto from 'crypto';
import {
  createRowWithId,
  deleteRowById,
  getSpreadsheetId,
  readRowById,
  updateRowById,
} from '@/app/lib/supabase';
import {
  clearGalleryContentCache,
  ensureGallerySheets,
  getGalleryContent,
  getGalleryContentForAdmin,
  getGalleryItemCount,
  getGallerySettingsRowId,
  isAdminEmail,
  ITEMS_SHEET,
  SETTINGS_SHEET,
  SETTINGS_ROW_ID,
} from '@/lib/gallery-store';
import type {
  GalleryItem,
  GallerySettings,
} from '@/data/gallery-types';

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

function parsePositiveInt(value: string | null): number | undefined {
  if (!value) return undefined;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const page = parsePositiveInt(url.searchParams.get('page'));
  const pageSize = parsePositiveInt(url.searchParams.get('pageSize'));

  const wantsPagination = page !== undefined || pageSize !== undefined;
  if (wantsPagination) {
    const email = getRequesterEmail(request);
    if (!isAdminEmail(email)) return unauthorized();
    const content = await getGalleryContentForAdmin({ page, pageSize });
    return NextResponse.json(content);
  }

  const content = await getGalleryContent();
  return NextResponse.json(content);
}

type SettingsBody = {
  kind: 'settings';
  settings: Omit<GallerySettings, 'id' | 'updatedAt'> & { updatedAt?: string };
};

type ItemUpsertBody = {
  kind: 'item';
  item: {
    id?: string;
    src: string;
    alt: string;
    large?: boolean;
  };
};

type ReorderBody = {
  kind: 'reorder';
  ids: string[];
};

type DeleteBody = {
  kind: 'delete';
  id: string;
};

type MutateBody = SettingsBody | ItemUpsertBody | ReorderBody | DeleteBody;

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
    await ensureGallerySheets(spreadsheetId);

    switch (body.kind) {
      case 'settings': {
        const next: GallerySettings = {
          id: SETTINGS_ROW_ID,
          tag: String(body.settings.tag ?? '').trim(),
          title: String(body.settings.title ?? '').trim(),
          subtitle: String(body.settings.subtitle ?? '').trim(),
          updatedAt: body.settings.updatedAt ?? new Date().toISOString(),
        };

        const existingId = await getGallerySettingsRowId(spreadsheetId);
        if (existingId) {
          await updateRowById(spreadsheetId, SETTINGS_SHEET, SETTINGS_ROW_ID, next);
        } else {
          await createRowWithId(spreadsheetId, SETTINGS_SHEET, next);
        }
        clearGalleryContentCache();
        return NextResponse.json({ ok: true, settings: next });
      }

      case 'item': {
        const { item } = body;
        const src = String(item.src ?? '').trim();
        const alt = String(item.alt ?? '').trim();
        if (src.length === 0) return badRequest('src (image URL) is required');
        if (alt.length === 0) return badRequest('alt is required');
        const large = Boolean(item.large);

        if (item.id) {
          // Same defensive pattern as the calendar route: an item id may
          // refer to a static fallback (e.g. 'match-point') that has never
          // been persisted. Verify before updating, otherwise create with the
          // supplied id so the row order stays stable.
          const existingRow = await readRowById(
            spreadsheetId,
            ITEMS_SHEET,
            item.id,
          );
          if (existingRow) {
            const order = Number(existingRow.order ?? 0);
            await updateRowById(spreadsheetId, ITEMS_SHEET, item.id, {
              src,
              alt,
              large,
              order,
            });
            const updated: GalleryItem = { id: item.id, src, alt, large, order };
            clearGalleryContentCache();
            return NextResponse.json({ ok: true, item: updated });
          }
          const order = await getGalleryItemCount(spreadsheetId);
          await createRowWithId(spreadsheetId, ITEMS_SHEET, {
            id: item.id,
            src,
            alt,
            large,
            order,
            createdAt: new Date().toISOString(),
          });
          const created: GalleryItem = { id: item.id, src, alt, large, order };
          clearGalleryContentCache();
          return NextResponse.json({ ok: true, item: created });
        }

        const order = await getGalleryItemCount(spreadsheetId);
        const newId = crypto.randomUUID();
        await createRowWithId(spreadsheetId, ITEMS_SHEET, {
          id: newId,
          src,
          alt,
          large,
          order,
          createdAt: new Date().toISOString(),
        });
        const created: GalleryItem = { id: newId, src, alt, large, order };
        clearGalleryContentCache();
        return NextResponse.json({ ok: true, item: created });
      }

      case 'reorder': {
        if (!Array.isArray(body.ids) || body.ids.length === 0) {
          return badRequest('ids must be a non-empty array');
        }
        // Skip ids that don't resolve to a row so reorder doesn't blow up
        // when the client sends a stale or draft id.
        await Promise.all(
          body.ids.map(async (id, idx) => {
            const existing = await readRowById(spreadsheetId, ITEMS_SHEET, id);
            if (!existing) return;
            await updateRowById(spreadsheetId, ITEMS_SHEET, id, { order: idx });
          }),
        );
        clearGalleryContentCache();
        return NextResponse.json({ ok: true });
      }

      case 'delete': {
        if (!body.id || typeof body.id !== 'string') {
          return badRequest('id is required');
        }
        const existing = await readRowById(spreadsheetId, ITEMS_SHEET, body.id);
        if (existing) {
          await deleteRowById(spreadsheetId, ITEMS_SHEET, body.id);
        }
        clearGalleryContentCache();
        return NextResponse.json({ ok: true });
      }

      default:
        return badRequest('Unknown kind');
    }
  } catch (error) {
    console.error('Error in PUT /api/gallery:', error);
    return serverError('Failed to save gallery content');
  }
}

export async function POST(request: Request) {
  return PUT(request);
}

export async function DELETE(request: Request) {
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
    await ensureGallerySheets(spreadsheetId);
    const existing = await readRowById(spreadsheetId, ITEMS_SHEET, body.id);
    if (existing) {
      await deleteRowById(spreadsheetId, ITEMS_SHEET, body.id);
    }
    clearGalleryContentCache();
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error in DELETE /api/gallery:', error);
    return serverError('Failed to delete gallery item');
  }
}
