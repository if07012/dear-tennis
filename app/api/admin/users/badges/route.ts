// ============================================
// /api/admin/users/badges — per-user badge grants
// ============================================
//
// GET    ?user=<email>            → { grants: GrantedBadge[] }
// POST   { userEmail, badgeKey, note? } → grant a badge (idempotent)
// DELETE { userEmail, badgeKey }  → revoke a grant
//
// All endpoints require `x-auth-email` matching ADMIN_EMAIL.

import { NextResponse } from 'next/server';
import { isAdminEmail } from '@/lib/admin';
import {
  grantBadge,
  listGrantedBadgesForUser,
  revokeGrantByKey,
} from '@/lib/achievements-store';

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

export async function GET(request: Request) {
  const email = getRequesterEmail(request);
  if (!isAdminEmail(email)) return unauthorized();

  const url = new URL(request.url);
  const target = url.searchParams.get('user')?.trim().toLowerCase();
  if (!target) return badRequest('user query param is required');

  try {
    const grants = await listGrantedBadgesForUser(target);
    return NextResponse.json({ grants });
  } catch (error) {
    console.error('Error in GET /api/admin/users/badges:', error);
    return serverError('Failed to load grants');
  }
}

export async function POST(request: Request) {
  const email = getRequesterEmail(request);
  if (!isAdminEmail(email)) return unauthorized();

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return badRequest('Invalid JSON');
  }
  const userEmail = String(body.userEmail ?? '').trim().toLowerCase();
  const badgeKey = String(body.badgeKey ?? '').trim().toLowerCase();
  if (!userEmail) return badRequest('userEmail is required');
  if (!badgeKey) return badRequest('badgeKey is required');

  try {
    const grant = await grantBadge({
      userEmail,
      badgeKey,
      grantedBy: email ?? '',
      note: typeof body.note === 'string' ? body.note : undefined,
    });
    return NextResponse.json({ ok: true, grant });
  } catch (error) {
    console.error('Error in POST /api/admin/users/badges:', error);
    return serverError(
      error instanceof Error ? error.message : 'Failed to grant badge',
    );
  }
}

export async function DELETE(request: Request) {
  const email = getRequesterEmail(request);
  if (!isAdminEmail(email)) return unauthorized();

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return badRequest('Invalid JSON');
  }
  const userEmail = String(body.userEmail ?? '').trim().toLowerCase();
  const badgeKey = String(body.badgeKey ?? '').trim().toLowerCase();
  if (!userEmail) return badRequest('userEmail is required');
  if (!badgeKey) return badRequest('badgeKey is required');

  try {
    const ok = await revokeGrantByKey({ userEmail, badgeKey });
    if (!ok) return badRequest('grant not found');
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error in DELETE /api/admin/users/badges:', error);
    return serverError(
      error instanceof Error ? error.message : 'Failed to revoke badge',
    );
  }
}