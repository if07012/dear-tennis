// ============================================
// /api/admin/activity-signups — admin queue
// ============================================
//
// GET   ?page=&pageSize=&status=   → paged signup list, admin-gated
// PATCH { id, status }             → approve or reject, admin-gated
// DELETE { id }                    → remove a signup row, admin-gated

import { NextResponse } from 'next/server';
import {
  decideSignup,
  getActivityTitles,
  listSignupsForAdmin,
  removeSignup,
} from '@/lib/activity-signups-store';
import { isSignupStatus, type SignupStatus } from '@/data/activity-signups-types';
import { isAdminEmail } from '@/lib/admin';

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function serverError(message: string) {
  return NextResponse.json({ error: message }, { status: 500 });
}

function getRequesterEmail(request: Request): string | null {
  const header = request.headers.get('x-auth-email');
  return header && header.trim().length > 0 ? header.trim().toLowerCase() : null;
}

function getSpreadsheetId(): string | null {
  const id = process.env.HERO_SPREADSHEET_ID?.trim();
  return id && id.length > 0 ? id : null;
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
  const statusRaw = url.searchParams.get('status');
  const status =
    statusRaw && (statusRaw === 'all' || isSignupStatus(statusRaw))
      ? (statusRaw as SignupStatus | 'all')
      : 'all';
  const activityId = url.searchParams.get('activity')?.trim() || undefined;

  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) return serverError('HERO_SPREADSHEET_ID is not set');

  try {
    const [paged, titles] = await Promise.all([
      listSignupsForAdmin({ page, pageSize, status, activityId }),
      getActivityTitles(spreadsheetId),
    ]);
    const items = paged.items.map((s) => ({
      ...s,
      activityTitle: titles.get(s.activityId) ?? s.activityId,
    }));
    return NextResponse.json({ ...paged, items });
  } catch (error) {
    console.error('Error in GET /api/admin/activity-signups:', error);
    return serverError('Failed to list signups');
  }
}

type PatchBody = { id: string; status: SignupStatus };
type DeleteBody = { id: string };

export async function PATCH(request: Request) {
  const email = getRequesterEmail(request);
  if (!isAdminEmail(email)) return unauthorized();

  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) return serverError('HERO_SPREADSHEET_ID is not set');

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return badRequest('Invalid JSON');
  }
  if (!body.id || typeof body.id !== 'string') return badRequest('id is required');
  if (!isSignupStatus(body.status)) {
    return badRequest('status must be one of: pending|approved|rejected');
  }

  try {
    const updated = await decideSignup(spreadsheetId, body.id, body.status, email ?? '');
    if (!updated) return badRequest('Signup not found');
    return NextResponse.json({ ok: true, signup: updated });
  } catch (error) {
    console.error('Error in PATCH /api/admin/activity-signups:', error);
    return serverError('Failed to update signup');
  }
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
  if (!body.id || typeof body.id !== 'string') return badRequest('id is required');

  try {
    const removed = await removeSignup(spreadsheetId, body.id);
    return NextResponse.json({ ok: true, removed });
  } catch (error) {
    console.error('Error in DELETE /api/admin/activity-signups:', error);
    return serverError('Failed to delete signup');
  }
}
