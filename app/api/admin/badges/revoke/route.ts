// ============================================
// /api/admin/badges/revoke — revoke badge from user
// ============================================
//
// POST { userEmail, badgeKey, note? } → revoke active badge grant
//
// Requires admin auth. Triggers level recalculation for skill badges.

import { NextResponse } from 'next/server';
import { isAdminEmail } from '@/lib/admin';
import {
  revokeBadge,
  computePlayerLevel,
  getBadgeByKey,
} from '@/lib/tennis-level-store';

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

export async function POST(request: Request) {
  const email = getRequesterEmail(request);
  if (!email || !isAdminEmail(email)) return unauthorized();

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

  // Verify badge exists
  const badge = await getBadgeByKey(badgeKey);
  if (!badge) return badRequest('Badge not found');

  try {
    const ok = await revokeBadge({
      userEmail,
      badgeKey,
      revokedBy: email,
      note: body.note ? String(body.note).trim() : undefined,
    });
    if (!ok) return badRequest('No active grant found to revoke');

    // Recompute player level (handles skill badge level fallbacks)
    const levelResult = await computePlayerLevel(userEmail);

    return NextResponse.json({
      ok: true,
      level: levelResult.currentLevel?.name ?? 'Unknown',
      levelDown: levelResult.nextLevel !== null,
    });
  } catch (error) {
    console.error('Error in POST /api/admin/badges/revoke:', error);
    return serverError(
      error instanceof Error ? error.message : 'Failed to revoke badge',
    );
  }
}