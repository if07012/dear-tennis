// ============================================
// /api/calendar — Calendar content read + admin write
// ============================================
//
// GET  → public. Accepts `?page=&pageSize=` only when `x-auth-email` matches
//        ADMIN_EMAIL; otherwise always returns the top events for the home
//        page. Paginated requests return the envelope:
//          { settings, events, total, page, pageSize, totalPages }
//        Non-paginated (public) requests keep the legacy shape:
//          { settings, events }
// PUT dispatches by `kind`:
//   { kind: 'settings', settings: { tag, title } }
//   { kind: 'event',    event: { id?, day, month, title, description,
//                                location, time, ctaLabel, ctaHref } }
//   { kind: 'reorder',  ids: string[] }
//   { kind: 'delete',   id: string }
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
  clearCalendarContentCache,
  ensureCalendarSheets,
  getCalendarContent,
  getCalendarContentForAdmin,
  getCalendarSettingsRowId,
  isAdminEmail,
  EVENTS_SHEET,
  SETTINGS_SHEET,
  SETTINGS_ROW_ID,
} from '@/lib/calendar-store';
import type {
  CalendarEvent,
  CalendarSettings,
} from '@/data/calendar-types';

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

  // Only admins may request a paginated view. Public callers always get the
  // top-of-list shape used by the home page so consumers don't need to know
  // about pagination envelopes.
  const wantsPagination = page !== undefined || pageSize !== undefined;
  if (wantsPagination) {
    const email = getRequesterEmail(request);
    if (!isAdminEmail(email)) return unauthorized();
    const content = await getCalendarContentForAdmin({ page, pageSize });
    return NextResponse.json(content);
  }

  const content = await getCalendarContent();
  return NextResponse.json(content);
}

type SettingsBody = {
  kind: 'settings';
  settings: Omit<CalendarSettings, 'id' | 'updatedAt'> & { updatedAt?: string };
};

type EventUpsertBody = {
  kind: 'event';
  event: {
    id?: string;
    day: string;
    month: string;
    title: string;
    description: string;
    location: string;
    time: string;
    ctaLabel: string;
    ctaHref: string;
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

type MutateBody = SettingsBody | EventUpsertBody | ReorderBody | DeleteBody;

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
    await ensureCalendarSheets(spreadsheetId);

    switch (body.kind) {
      case 'settings': {
        const next: CalendarSettings = {
          id: SETTINGS_ROW_ID,
          tag: String(body.settings.tag ?? '').trim(),
          title: String(body.settings.title ?? '').trim(),
          updatedAt: body.settings.updatedAt ?? new Date().toISOString(),
        };

        const existingId = await getCalendarSettingsRowId(spreadsheetId);
        if (existingId) {
          await updateRowById(spreadsheetId, SETTINGS_SHEET, SETTINGS_ROW_ID, next);
        } else {
          await createRowWithId(spreadsheetId, SETTINGS_SHEET, next);
        }
        clearCalendarContentCache();
        return NextResponse.json({ ok: true, settings: next });
      }

      case 'event': {
        const { event } = body;
        if (!event || typeof event.title !== 'string' || event.title.trim().length === 0) {
          return badRequest('title is required');
        }
        const clean = {
          day: String(event.day ?? '').trim(),
          month: String(event.month ?? '').trim(),
          title: event.title.trim(),
          description: String(event.description ?? '').trim(),
          location: String(event.location ?? '').trim(),
          time: String(event.time ?? '').trim(),
          ctaLabel: String(event.ctaLabel ?? '').trim(),
          ctaHref: String(event.ctaHref ?? '').trim(),
        };

        if (event.id) {
          const existing = await getCalendarContentForAdmin();
          // Fallback content ships with static IDs (e.g. 'new-year-kickoff')
          // that may not exist in the sheet yet. Verify the row is actually
          // there before trying to update, otherwise create a new row.
          const existingRow = await readRowById(
            spreadsheetId,
            EVENTS_SHEET,
            event.id,
          );
          if (existingRow) {
            const order =
              existing.events.find((e) => e.id === event.id)?.order ??
              existing.events.length;
            await updateRowById(spreadsheetId, EVENTS_SHEET, event.id, {
              ...clean,
              order,
            });
            const updated: CalendarEvent = { id: event.id, ...clean, order };
            clearCalendarContentCache();
            return NextResponse.json({ ok: true, event: updated });
          }
          // Fall through to create with the supplied id preserved.
          const order = existing.events.length;
          await createRowWithId(spreadsheetId, EVENTS_SHEET, {
            id: event.id,
            ...clean,
            order,
            createdAt: new Date().toISOString(),
          });
          const created: CalendarEvent = { id: event.id, ...clean, order };
          clearCalendarContentCache();
          return NextResponse.json({ ok: true, event: created });
        }

        const existing = await getCalendarContentForAdmin();
        const order = existing.events.length;
        const newId = crypto.randomUUID();
        await createRowWithId(spreadsheetId, EVENTS_SHEET, {
          id: newId,
          ...clean,
          order,
          createdAt: new Date().toISOString(),
        });
        const created: CalendarEvent = { id: newId, ...clean, order };
        clearCalendarContentCache();
        return NextResponse.json({ ok: true, event: created });
      }

      case 'reorder': {
        if (!Array.isArray(body.ids) || body.ids.length === 0) {
          return badRequest('ids must be a non-empty array');
        }
        // The client may include ids for rows that haven't been persisted yet
        // (e.g. a freshly added "draft-..." event that was created in the same
        // save batch and just received a UUID back, or — before the fix — a
        // draft id that never made it into the sheet). Skip ids that don't
        // resolve to a row so the reorder doesn't blow up the save.
        await Promise.all(
          body.ids.map(async (id, idx) => {
            const existing = await readRowById(spreadsheetId, EVENTS_SHEET, id);
            if (!existing) return;
            await updateRowById(spreadsheetId, EVENTS_SHEET, id, { order: idx });
          }),
        );
        clearCalendarContentCache();
        return NextResponse.json({ ok: true });
      }

      case 'delete': {
        if (!body.id || typeof body.id !== 'string') {
          return badRequest('id is required');
        }
        // Defensive: skip ids that don't resolve to a row so we don't crash
        // when the client sends a stale or draft id. (The client also gates
        // this with isPersistedId, but the server should not crash either.)
        const existing = await readRowById(
          spreadsheetId,
          EVENTS_SHEET,
          body.id,
        );
        if (existing) {
          await deleteRowById(spreadsheetId, EVENTS_SHEET, body.id);
        }
        clearCalendarContentCache();
        return NextResponse.json({ ok: true });
      }

      default:
        return badRequest('Unknown kind');
    }
  } catch (error) {
    console.error('Error in PUT /api/calendar:', error);
    return serverError('Failed to save calendar content');
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
    await ensureCalendarSheets(spreadsheetId);
    // Defensive: same as the PUT 'delete' branch — skip unknown ids so the
    // route doesn't crash when a stale or draft id is sent.
    const existing = await readRowById(spreadsheetId, EVENTS_SHEET, body.id);
    if (existing) {
      await deleteRowById(spreadsheetId, EVENTS_SHEET, body.id);
    }
    clearCalendarContentCache();
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error in DELETE /api/calendar:', error);
    return serverError('Failed to delete event');
  }
}
