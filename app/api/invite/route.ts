// ============================================
// /api/invite — Member invitations (admin only)
// ============================================
//
// GET    → admin-only. Returns paginated invitations.
//            { items, total, page, pageSize, totalPages }
// POST   → admin-only. Body: { email, name?, message? }
//            Creates a new pending invite.
// PATCH  → admin-only. Body: { id, status }
//            Updates the lifecycle status of an invite.
// DELETE → admin-only. Body: { id }
//            Removes an invite permanently.
//
// All endpoints require x-auth-email === ADMIN_EMAIL.

import { NextResponse } from 'next/server';
import crypto from 'crypto';
import {
  createRowWithId,
  deleteRowById,
  readRowById,
  updateRowById,
} from '@/app/lib/googleSheets';
import {
  ensureInviteSheets,
  getInviteContentForAdmin,
  isAdminEmail,
  ITEMS_SHEET,
} from '@/lib/invite-store';
import { INVITE_STATUSES, type Invite } from '@/data/invite-types';
import { isMailerConfigured, sendInviteEmail } from '@/lib/mailer';

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
  const email = getRequesterEmail(request);
  if (!isAdminEmail(email)) return unauthorized();

  const url = new URL(request.url);
  const page = parsePositiveInt(url.searchParams.get('page'));
  const pageSize = parsePositiveInt(url.searchParams.get('pageSize'));
  const content = await getInviteContentForAdmin({ page, pageSize });
  return NextResponse.json(content);
}

type CreateBody = {
  email: string;
  name?: string;
  message?: string;
};

type UpdateStatusBody = {
  id: string;
  status: Invite['status'];
};

type DeleteBody = { id: string };

function isValidEmail(value: string) {
  // Pragmatic check — admin-typed input on an internal page. Keeps the
  // server from trying to write a row with a clearly invalid email like
  // "foo" or "a@b" (single-char domain).
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: Request) {
  const email = getRequesterEmail(request);
  if (!isAdminEmail(email)) return unauthorized();

  let body: CreateBody;
  try {
    body = (await request.json()) as CreateBody;
  } catch {
    return badRequest('Invalid JSON');
  }

  const invitedEmail = String(body.email ?? '').trim().toLowerCase();
  if (!isValidEmail(invitedEmail)) {
    return badRequest('A valid email address is required');
  }
  const name = body.name ? String(body.name).trim() || undefined : undefined;
  const message = body.message
    ? String(body.message).trim() || undefined
    : undefined;

  const spreadsheetId = process.env.HERO_SPREADSHEET_ID?.trim();
  if (!spreadsheetId) return serverError('HERO_SPREADSHEET_ID is not set');

  try {
    await ensureInviteSheets(spreadsheetId);
    const id = crypto.randomUUID();
    // 32-byte URL-safe token. Mints at create-time so the row is the single
    // source of truth — the mailer reads the same token back from the sheet.
    const token = crypto.randomBytes(32).toString('base64url');
    const invitedAt = new Date().toISOString();
    const row: Invite = {
      id,
      email: invitedEmail,
      name,
      message,
      status: 'pending',
      invitedAt,
      createdBy: email ?? '',
      token,
    };
    await createRowWithId(spreadsheetId, ITEMS_SHEET, row);

    // Try to deliver via Brevo. We always persist first so that a transient
    // SMTP failure doesn't lose the invitation — the row stays as 'pending'
    // and the admin can retry from the UI.
    if (!isMailerConfigured()) {
      console.warn(
        '[invite] Brevo SMTP not configured; invite saved as pending without sending.',
      );
      return NextResponse.json({
        ok: true,
        invite: row,
        sent: false,
        warning:
          'Brevo SMTP is not configured. Invite saved but email was not sent.',
      });
    }

    try {
      await sendInviteEmail({
        to: invitedEmail,
        name,
        message,
        inviteToken: token,
      });
      await updateRowById(spreadsheetId, ITEMS_SHEET, id, {
        status: 'sent',
      });
      const sent: Invite = { ...row, status: 'sent' };
      return NextResponse.json({ ok: true, invite: sent, sent: true });
    } catch (mailErr) {
      console.error(
        '[invite] Failed to send via Brevo; row stays pending:',
        mailErr,
      );
      return NextResponse.json({
        ok: true,
        invite: row,
        sent: false,
        warning:
          mailErr instanceof Error
            ? mailErr.message
            : 'Failed to send invitation email',
      });
    }
  } catch (e) {
    console.error('Error in POST /api/invite:', e);
    return serverError('Failed to create invite');
  }
}

export async function PATCH(request: Request) {
  const email = getRequesterEmail(request);
  if (!isAdminEmail(email)) return unauthorized();

  let body: UpdateStatusBody;
  try {
    body = (await request.json()) as UpdateStatusBody;
  } catch {
    return badRequest('Invalid JSON');
  }
  if (!body.id) return badRequest('id is required');
  if (!(INVITE_STATUSES as readonly string[]).includes(body.status)) {
    return badRequest('status must be one of: pending|sent|accepted|cancelled');
  }

  const spreadsheetId = process.env.HERO_SPREADSHEET_ID?.trim();
  if (!spreadsheetId) return serverError('HERO_SPREADSHEET_ID is not set');

  try {
    await ensureInviteSheets(spreadsheetId);
    const existing = await readRowById(spreadsheetId, ITEMS_SHEET, body.id);
    if (!existing) return badRequest('Invite not found');
    await updateRowById(spreadsheetId, ITEMS_SHEET, body.id, {
      status: body.status,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('Error in PATCH /api/invite:', e);
    return serverError('Failed to update invite');
  }
}

export async function PUT(request: Request) {
  // PUT is treated as an alias for PATCH for status updates. Keeps the
  // client API uniform with the other admin routes (which use PUT).
  return PATCH(request);
}

export async function DELETE(request: Request) {
  const email = getRequesterEmail(request);
  if (!isAdminEmail(email)) return unauthorized();

  let body: DeleteBody;
  try {
    body = (await request.json()) as DeleteBody;
  } catch {
    return badRequest('Invalid JSON');
  }
  if (!body.id) return badRequest('id is required');

  const spreadsheetId = process.env.HERO_SPREADSHEET_ID?.trim();
  if (!spreadsheetId) return serverError('HERO_SPREADSHEET_ID is not set');

  try {
    await ensureInviteSheets(spreadsheetId);
    const existing = await readRowById(spreadsheetId, ITEMS_SHEET, body.id);
    if (existing) {
      await deleteRowById(spreadsheetId, ITEMS_SHEET, body.id);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('Error in DELETE /api/invite:', e);
    return serverError('Failed to delete invite');
  }
}