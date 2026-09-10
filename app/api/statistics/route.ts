// ============================================
// /api/statistics — Statistics content read + admin write
// ============================================
//
// GET  → public. Accepts `?page=&pageSize=` only when `x-auth-email` matches
//        ADMIN_EMAIL; otherwise returns the full statistics list.
//        Paginated requests return:
//          { items, total, page, pageSize, totalPages }
//        Non-paginated (public) requests keep:
//          { items }
// PUT dispatches by `kind`:
//   { kind: 'item',    item:  { id?, value, label, suffix? } }
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
  clearStatisticsContentCache,
  ensureStatisticsSheets,
  getStatisticsContent,
  getStatisticsContentForAdmin,
  getStatisticsItemCount,
  isAdminEmail,
  ITEMS_SHEET,
} from '@/lib/statistics-store';
import type { Statistic } from '@/data/statistics-types';

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
  return header && header.trim().length > 0
    ? header.trim().toLowerCase()
    : null;
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
    const content = await getStatisticsContentForAdmin({ page, pageSize });
    return NextResponse.json(content);
  }

  const content = await getStatisticsContent();
  return NextResponse.json(content);
}

type ItemUpsertBody = {
  kind: 'item';
  item: {
    id?: string;
    value: number;
    label: string;
    suffix?: string;
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

type MutateBody = ItemUpsertBody | ReorderBody | DeleteBody;

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
    await ensureStatisticsSheets(spreadsheetId);

    switch (body.kind) {
      case 'item': {
        const { item } = body;
        const label = String(item.label ?? '').trim();
        if (label.length === 0) return badRequest('label is required');
        const rawValue = Number(item.value);
        const value = Number.isFinite(rawValue) ? Math.max(0, Math.floor(rawValue)) : 0;
        if (value === 0) return badRequest('value must be greater than 0');
        const suffix = item.suffix
          ? String(item.suffix).trim() || undefined
          : undefined;
        const clean = { value, label, suffix };

        if (item.id) {
          // An item id may refer to a static fallback (e.g. 'members') that
          // has never been persisted. Verify before updating, otherwise
          // create with the supplied id so the row order stays stable.
          const existingRow = await readRowById(
            spreadsheetId,
            ITEMS_SHEET,
            item.id,
          );
          if (existingRow) {
            const order = Number(existingRow.order ?? 0);
            await updateRowById(spreadsheetId, ITEMS_SHEET, item.id, {
              ...clean,
              order,
            });
            const updated: Statistic = { id: item.id, ...clean, order };
            clearStatisticsContentCache();
            return NextResponse.json({ ok: true, item: updated });
          }
          const order = await getStatisticsItemCount(spreadsheetId);
          await createRowWithId(spreadsheetId, ITEMS_SHEET, {
            id: item.id,
            ...clean,
            order,
            createdAt: new Date().toISOString(),
          });
          const created: Statistic = { id: item.id, ...clean, order };
          clearStatisticsContentCache();
          return NextResponse.json({ ok: true, item: created });
        }

        const order = await getStatisticsItemCount(spreadsheetId);
        const newId = crypto.randomUUID();
        await createRowWithId(spreadsheetId, ITEMS_SHEET, {
          id: newId,
          ...clean,
          order,
          createdAt: new Date().toISOString(),
        });
        const created: Statistic = { id: newId, ...clean, order };
        clearStatisticsContentCache();
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
        clearStatisticsContentCache();
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
        clearStatisticsContentCache();
        return NextResponse.json({ ok: true });
      }

      default:
        return badRequest('Unknown kind');
    }
  } catch (error) {
    console.error('Error in PUT /api/statistics:', error);
    return serverError('Failed to save statistics content');
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
    await ensureStatisticsSheets(spreadsheetId);
    const existing = await readRowById(spreadsheetId, ITEMS_SHEET, body.id);
    if (existing) {
      await deleteRowById(spreadsheetId, ITEMS_SHEET, body.id);
    }
    clearStatisticsContentCache();
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error in DELETE /api/statistics:', error);
    return serverError('Failed to delete statistic');
  }
}