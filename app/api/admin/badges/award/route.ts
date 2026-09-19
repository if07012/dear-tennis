// ============================================
// /api/admin/badges/award — award badge to user
// ============================================
//
// POST { userEmail, badgeKey, note? } → grant badge to user
//
// Requires admin auth. Triggers level recalculation for skill badges.

import { NextResponse } from 'next/server';
import { isAdminEmail } from '@/lib/admin';
import {
  grantBadge,
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
  if (badge.archived) return badRequest('Badge is archived');

  try {
    const grant = await grantBadge({
      userEmail,
      badgeKey,
      grantedBy: email,
      note: body.note ? String(body.note).trim() : undefined,
    });

    // Recompute player level (handles skill badge level progression)
    const levelResult = await computePlayerLevel(userEmail);

    return NextResponse.json({
      ok: true,
      grant,
      level: levelResult.currentLevel?.name ?? 'Unknown',
      levelUp: levelResult.nextLevel === null,
    });
  } catch (error) {
    console.error('Error in POST /api/admin/badges/award:', error);
    return serverError(
      error instanceof Error ? error.message : 'Failed to award badge',
    );
  }
}