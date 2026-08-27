// ============================================
// /api/why-join — Why Join content read + admin write
// ============================================
//
// GET  → public. Returns { settings, benefits } from the Google Sheet (falls
//        back to bundled defaults when HERO_SPREADSHEET_ID is unset).
//
// PUT dispatches by a `kind` field in the JSON body:
//   { kind: 'settings', settings: { tag, title, subtitle } }  → upsert the
//                                                                  single row
//   { kind: 'benefit',  benefit:  { id?, title, description, icon } }
//       → create (no id) or update (id set)
//   { kind: 'reorder',  ids:      string[] }                    → persist order
//   { kind: 'delete',   id:       string }                      → delete a benefit
//
// All mutating requests require the caller's email to match ADMIN_EMAIL.

import { NextResponse } from 'next/server';
import crypto from 'crypto';
import {
  createRowWithId,
  deleteRowById,
  readRowById,
  updateRowById,
} from '@/app/lib/googleSheets';
import {
  clearWhyJoinContentCache,
  ensureWhyJoinSheets,
  getWhyJoinContent,
  getWhyJoinContentForAdmin,
  getWhyJoinSettingsRowId,
  isAdminEmail,
  WHY_JOIN_SHEET,
  WHY_JOIN_BENEFITS_SHEET,
  SETTINGS_ROW_ID,
} from '@/lib/why-join-store';
import type {
  BenefitIconKey,
  BenefitItem,
  WhyJoinSettings,
} from '@/data/why-join-types';

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

function invalidateCache() {
  clearWhyJoinContentCache();
}

export async function GET() {
  const content = await getWhyJoinContent();
  return NextResponse.json(content);
}

type SettingsBody = {
  kind: 'settings';
  settings: Omit<WhyJoinSettings, 'id' | 'updatedAt'> & { updatedAt?: string };
};

type BenefitUpsertBody = {
  kind: 'benefit';
  benefit: { id?: string; title: string; description: string; icon: string };
};

type ReorderBody = {
  kind: 'reorder';
  ids: string[];
};

type DeleteBody = {
  kind: 'delete';
  id: string;
};

type MutateBody = SettingsBody | BenefitUpsertBody | ReorderBody | DeleteBody;

const ALLOWED_ICONS: BenefitIconKey[] = [
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

function coerceIcon(raw: unknown): BenefitIconKey {
  if (typeof raw === 'string' && (ALLOWED_ICONS as string[]).includes(raw)) {
    return raw as BenefitIconKey;
  }
  return 'users';
}

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
  if (!spreadsheetId) return serverError('HERO_SPREADSHEET_ID is not set');

  try {
    await ensureWhyJoinSheets(spreadsheetId);

    switch (body.kind) {
      case 'settings': {
        const next: WhyJoinSettings = {
          id: SETTINGS_ROW_ID,
          tag: String(body.settings.tag ?? '').trim(),
          title: String(body.settings.title ?? '').trim(),
          subtitle: String(body.settings.subtitle ?? '').trim(),
          updatedAt: body.settings.updatedAt ?? new Date().toISOString(),
        };

        const existingId = await getWhyJoinSettingsRowId(spreadsheetId);
        if (existingId) {
          await updateRowById(spreadsheetId, WHY_JOIN_SHEET, SETTINGS_ROW_ID, next);
        } else {
          await createRowWithId(spreadsheetId, WHY_JOIN_SHEET, next);
        }
        invalidateCache();
        return NextResponse.json({ ok: true, settings: next });
      }

      case 'benefit': {
        const { benefit } = body;
        if (!benefit || typeof benefit.title !== 'string' || benefit.title.trim().length === 0) {
          return badRequest('title is required');
        }
        const title = benefit.title.trim();
        const description = String(benefit.description ?? '').trim();
        const icon = coerceIcon(benefit.icon);

        if (benefit.id) {
          const existing = await getWhyJoinContentForAdmin();
          const order =
            existing.benefits.find((b) => b.id === benefit.id)?.order ??
            existing.benefits.length;
          await updateRowById(spreadsheetId, WHY_JOIN_BENEFITS_SHEET, benefit.id, {
            title,
            description,
            icon,
            order,
          });
          const updated: BenefitItem = {
            id: benefit.id,
            title,
            description,
            icon,
            order,
          };
          invalidateCache();
          return NextResponse.json({ ok: true, benefit: updated });
        }

        const existing = await getWhyJoinContentForAdmin();
        const order = existing.benefits.length;
        const newId = crypto.randomUUID();
        await createRowWithId(spreadsheetId, WHY_JOIN_BENEFITS_SHEET, {
          id: newId,
          title,
          description,
          icon,
          order,
          createdAt: new Date().toISOString(),
        });
        const created: BenefitItem = {
          id: newId,
          title,
          description,
          icon,
          order,
        };
        invalidateCache();
        return NextResponse.json({ ok: true, benefit: created });
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
            const existing = await readRowById(
              spreadsheetId,
              WHY_JOIN_BENEFITS_SHEET,
              id,
            );
            if (!existing) return;
            await updateRowById(spreadsheetId, WHY_JOIN_BENEFITS_SHEET, id, {
              order: idx,
            });
          }),
        );
        invalidateCache();
        return NextResponse.json({ ok: true });
      }

      case 'delete': {
        if (!body.id || typeof body.id !== 'string') {
          return badRequest('id is required');
        }
        await deleteRowById(spreadsheetId, WHY_JOIN_BENEFITS_SHEET, body.id);
        invalidateCache();
        return NextResponse.json({ ok: true });
      }

      default:
        return badRequest('Unknown kind');
    }
  } catch (error) {
    console.error('Error in PUT /api/why-join:', error);
    return serverError('Failed to save why-join content');
  }
}

export async function POST(request: Request) {
  return PUT(request);
}

export async function DELETE(request: Request) {
  const email = getRequesterEmail(request);
  if (!isAdminEmail(email)) return unauthorized();
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) return serverError('HERO_SPREADSHEET_ID is not set');

  let body: DeleteBody;
  try {
    body = (await request.json()) as DeleteBody;
  } catch {
    return badRequest('Invalid JSON');
  }
  if (!body.id) return badRequest('id is required');

  try {
    await ensureWhyJoinSheets(spreadsheetId);
    await deleteRowById(spreadsheetId, WHY_JOIN_BENEFITS_SHEET, body.id);
    invalidateCache();
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error in DELETE /api/why-join:', error);
    return serverError('Failed to delete benefit');
  }
}
