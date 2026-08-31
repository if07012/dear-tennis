// ============================================
// /api/admin/users — admin user management
// ============================================
//
// GET   ?page=&pageSize=  → paginated list, admin-gated
// PATCH { id, role }      → update a user's role, admin-gated
// DELETE { id }           → delete a user, admin-gated
//
// All endpoints require `x-auth-email` matching ADMIN_EMAIL.

import { NextResponse } from 'next/server';
import {
  deleteUserForAdmin,
  getUsersContentForAdmin,
  updateUserRole,
  type UserRole,
} from '@/lib/users-store';
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
  const id =
    process.env.USERS_SPREADSHEET_ID || process.env.GOOGLE_SPREADSHEET_ID || null;
  return id && id.trim().length > 0 ? id.trim() : null;
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

  const content = await getUsersContentForAdmin({ page, pageSize });
  return NextResponse.json(content);
}

type PatchBody = {
  id: string;
  role: UserRole;
};

type DeleteBody = {
  id: string;
};

function isUserRole(value: unknown): value is UserRole {
  return value === 'admin' || value === 'member';
}

export async function PATCH(request: Request) {
  const email = getRequesterEmail(request);
  if (!isAdminEmail(email)) return unauthorized();

  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) return serverError('USERS_SPREADSHEET_ID is not set');

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return badRequest('Invalid JSON');
  }

  if (!body || typeof body.id !== 'string' || !body.id.trim()) {
    return badRequest('id is required');
  }
  if (!isUserRole(body.role)) {
    return badRequest('role must be "admin" or "member"');
  }

  // Guard: never let the last admin (the one configured in env) be demoted
  // to member — otherwise /admin/* becomes unreachable.
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase() || '';
  if (adminEmail && body.role === 'member') {
    try {
      const all = await getUsersContentForAdmin({ page: 1, pageSize: 100 });
      const target = all.users.find((u) => u.id === body.id);
      if (target && target.email.toLowerCase() === adminEmail) {
        return badRequest('Tidak bisa menurunkan role admin utama');
      }
    } catch {
      // If we can't read the sheet, fall through — the update will surface
      // the error.
    }
  }

  try {
    const updated = await updateUserRole(spreadsheetId, body.id, body.role);
    return NextResponse.json({ ok: true, user: updated });
  } catch (error) {
    console.error('Error in PATCH /api/admin/users:', error);
    return serverError('Failed to update user');
  }
}

export async function DELETE(request: Request) {
  const email = getRequesterEmail(request);
  if (!isAdminEmail(email)) return unauthorized();

  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) return serverError('USERS_SPREADSHEET_ID is not set');

  let body: DeleteBody;
  try {
    body = (await request.json()) as DeleteBody;
  } catch {
    return badRequest('Invalid JSON');
  }

  if (!body || typeof body.id !== 'string' || !body.id.trim()) {
    return badRequest('id is required');
  }

  // Guard: never delete the row that maps to ADMIN_EMAIL — losing it would
  // break every other admin-protected route on next login.
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase() || '';
  if (adminEmail && email === adminEmail) {
    // Only check when we can cheaply resolve the row.
    try {
      const paged = await getUsersContentForAdmin({ page: 1, pageSize: 100 });
      const target = paged.users.find((u) => u.id === body.id);
      if (target && target.email.toLowerCase() === adminEmail) {
        return badRequest('Tidak bisa menghapus akun admin utama');
      }
    } catch {
      // ignore — delete will surface its own error
    }
  }

  try {
    const result = await deleteUserForAdmin(spreadsheetId, body.id);
    return NextResponse.json({ ok: true, deletedEmail: result.deletedEmail });
  } catch (error) {
    console.error('Error in DELETE /api/admin/users:', error);
    return serverError('Failed to delete user');
  }
}
