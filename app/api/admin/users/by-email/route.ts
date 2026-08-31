// ============================================
// /api/admin/users/by-email
// ============================================
//
// GET ?email=<email> → { user: UserRecord | null }
//
// Returns a single user record by email so the admin's "view as" picker
// can resolve the viewed user's name/photo/rank without making N+1 calls.
// Admin-gated.

import { NextResponse } from 'next/server';
import { isAdminEmail } from '@/lib/admin';
import { listAllUsersForAdmin } from '@/lib/users-store';

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function getRequesterEmail(request: Request): string | null {
  const header = request.headers.get('x-auth-email');
  return header && header.trim().length > 0 ? header.trim().toLowerCase() : null;
}

export async function GET(request: Request) {
  const email = getRequesterEmail(request);
  if (!isAdminEmail(email)) return unauthorized();

  const url = new URL(request.url);
  const target = url.searchParams.get('email')?.trim().toLowerCase();
  if (!target) return badRequest('email query param is required');

  try {
    const users = await listAllUsersForAdmin();
    const found = users.find((u) => u.email.toLowerCase() === target) ?? null;
    return NextResponse.json({ user: found });
  } catch (e) {
    console.error('Error in GET /api/admin/users/by-email:', e);
    return NextResponse.json(
      { error: 'Failed to load user' },
      { status: 500 },
    );
  }
}
