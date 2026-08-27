// ============================================
// /api/activities — Activities content read + admin write
// ============================================
//
// GET  → public. Returns { settings, activities }.
// PUT dispatches by `kind`:
//   { kind: 'settings', settings: { tag, title, subtitle } }
//   { kind: 'activity', activity: { id?, category, title, description, image,
//                                    duration, groupSize, location, time } }
//   { kind: 'reorder',  ids: string[] }
//   { kind: 'delete',   id: string }
//
// All mutations require ADMIN_EMAIL.

import { NextResponse } from 'next/server';
import crypto from 'crypto';
import {
  createRowWithId,
  deleteRowById,
  readRowById,
  updateRowById,
} from '@/app/lib/googleSheets';
import {
  clearActivitiesContentCache,
  ensureActivitiesSheets,
  getActivitiesContent,
  getActivitiesContentForAdmin,
  getActivitiesSettingsRowId,
  isAdminEmail,
  ITEMS_SHEET,
  SETTINGS_SHEET,
  SETTINGS_ROW_ID,
} from '@/lib/activities-store';
import type {
  ActivityCategory,
  ActivityItem,
  ActivitiesSettings,
} from '@/data/activities-types';

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

function coerceCategory(raw: unknown): ActivityCategory {
  if (raw === 'training' || raw === 'social' || raw === 'competitive') return raw;
  return 'training';
}

export async function GET() {
  const content = await getActivitiesContent();
  return NextResponse.json(content);
}

type SettingsBody = {
  kind: 'settings';
  settings: Omit<ActivitiesSettings, 'id' | 'updatedAt'> & { updatedAt?: string };
};

type ActivityUpsertBody = {
  kind: 'activity';
  activity: {
    id?: string;
    category: string;
    title: string;
    description: string;
    image: string;
    duration: string;
    groupSize: string;
    location: string;
    time: string;
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

type MutateBody = SettingsBody | ActivityUpsertBody | ReorderBody | DeleteBody;

export async function PUT(request: Request) {
  const email = getRequesterEmail(request);
  if (!isAdminEmail(email)) return unauthorized();

  let body: MutateBody;
  try {
    body = (await request.json()) as MutateBody;
  } catch {
    return badRequest('Invalid JSON');
  }

  const spreadsheetId = process.env.HERO_SPREADSHEET_ID?.trim();
  if (!spreadsheetId) return serverError('HERO_SPREADSHEET_ID is not set');

  try {
    await ensureActivitiesSheets(spreadsheetId);

    switch (body.kind) {
      case 'settings': {
        const next: ActivitiesSettings = {
          id: SETTINGS_ROW_ID,
          tag: String(body.settings.tag ?? '').trim(),
          title: String(body.settings.title ?? '').trim(),
          subtitle: String(body.settings.subtitle ?? '').trim(),
          updatedAt: body.settings.updatedAt ?? new Date().toISOString(),
        };

        const existingId = await getActivitiesSettingsRowId(spreadsheetId);
        if (existingId) {
          await updateRowById(spreadsheetId, SETTINGS_SHEET, SETTINGS_ROW_ID, next);
        } else {
          await createRowWithId(spreadsheetId, SETTINGS_SHEET, next);
        }
        clearActivitiesContentCache();
        return NextResponse.json({ ok: true, settings: next });
      }

      case 'activity': {
        const { activity } = body;
        if (!activity || typeof activity.title !== 'string' || activity.title.trim().length === 0) {
          return badRequest('title is required');
        }
        const clean = {
          category: coerceCategory(activity.category),
          title: activity.title.trim(),
          description: String(activity.description ?? '').trim(),
          image: String(activity.image ?? '').trim(),
          duration: String(activity.duration ?? '').trim(),
          groupSize: String(activity.groupSize ?? '').trim(),
          location: String(activity.location ?? '').trim(),
          time: String(activity.time ?? '').trim(),
        };

        if (activity.id) {
          const existing = await getActivitiesContentForAdmin();
          const order =
            existing.activities.find((a) => a.id === activity.id)?.order ??
            existing.activities.length;
          await updateRowById(spreadsheetId, ITEMS_SHEET, activity.id, {
            ...clean,
            order,
          });
          const updated: ActivityItem = { id: activity.id, ...clean, order };
          clearActivitiesContentCache();
          return NextResponse.json({ ok: true, activity: updated });
        }

        const existing = await getActivitiesContentForAdmin();
        const order = existing.activities.length;
        const newId = crypto.randomUUID();
        await createRowWithId(spreadsheetId, ITEMS_SHEET, {
          id: newId,
          ...clean,
          order,
          createdAt: new Date().toISOString(),
        });
        const created: ActivityItem = { id: newId, ...clean, order };
        clearActivitiesContentCache();
        return NextResponse.json({ ok: true, activity: created });
      }

      case 'reorder': {
        if (!Array.isArray(body.ids) || body.ids.length === 0) {
          return badRequest('ids must be a non-empty array');
        }
        // Skip ids that don't resolve to a row — protects against the same
        // 'Row not found' crash that hit /api/calendar when the client
        // includes a draft id in the reorder batch.
        await Promise.all(
          body.ids.map(async (id, idx) => {
            const existing = await readRowById(spreadsheetId, ITEMS_SHEET, id);
            if (!existing) return;
            await updateRowById(spreadsheetId, ITEMS_SHEET, id, { order: idx });
          }),
        );
        clearActivitiesContentCache();
        return NextResponse.json({ ok: true });
      }

      case 'delete': {
        if (!body.id || typeof body.id !== 'string') {
          return badRequest('id is required');
        }
        await deleteRowById(spreadsheetId, ITEMS_SHEET, body.id);
        clearActivitiesContentCache();
        return NextResponse.json({ ok: true });
      }

      default:
        return badRequest('Unknown kind');
    }
  } catch (error) {
    console.error('Error in PUT /api/activities:', error);
    return serverError('Failed to save activities content');
  }
}

export async function POST(request: Request) {
  return PUT(request);
}

export async function DELETE(request: Request) {
  const email = getRequesterEmail(request);
  if (!isAdminEmail(email)) return unauthorized();
  const spreadsheetId = process.env.HERO_SPREADSHEET_ID?.trim();
  if (!spreadsheetId) return serverError('HERO_SPREADSHEET_ID is not set');

  let body: DeleteBody;
  try {
    body = (await request.json()) as DeleteBody;
  } catch {
    return badRequest('Invalid JSON');
  }
  if (!body.id) return badRequest('id is required');

  try {
    await ensureActivitiesSheets(spreadsheetId);
    await deleteRowById(spreadsheetId, ITEMS_SHEET, body.id);
    clearActivitiesContentCache();
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error in DELETE /api/activities:', error);
    return serverError('Failed to delete activity');
  }
}
