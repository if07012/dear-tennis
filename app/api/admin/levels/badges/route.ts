// ============================================
// /api/admin/levels/badges — level-badge requirements
// ============================================
//
// GET ?levelId=<id>    → get required badge keys for a level
// POST { levelId, badgeKey } → add requirement
// POST { levelId, badgeKeys: string[] } → set all requirements (bulk)
// DELETE { levelId, badgeKey } → remove requirement

import { NextResponse } from 'next/server';
import { isAdminEmail } from '@/lib/admin';
import {
  getRequiredBadgesForLevel,
  upsertLevelBadge,
  deleteLevelBadge,
  setLevelBadges,
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

export async function GET(request: Request) {
  const email = getRequesterEmail(request);
  if (!isAdminEmail(email)) return unauthorized();

  const { searchParams } = new URL(request.url);
  const levelId = searchParams.get('levelId')?.trim() || '';
  if (!levelId) return badRequest('levelId is required');

  try {
    const badgeKeys = await getRequiredBadgesForLevel(levelId);
    return NextResponse.json({ badgeKeys });
  } catch (error) {
    console.error('Error in GET /api/admin/levels/badges:', error);
    return serverError('Failed to load level badges');
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

  const levelId = String(body.levelId ?? '').trim();
  if (!levelId) return badRequest('levelId is required');

  // Bulk set
  if (Array.isArray(body.badgeKeys)) {
    try {
      await setLevelBadges(levelId, body.badgeKeys.map((k) => String(k).trim().toLowerCase()));
      return NextResponse.json({ ok: true });
    } catch (error) {
      console.error('Error in POST /api/admin/levels/badges (bulk):', error);
      return serverError('Failed to set level badges');
    }
  }

  // Single add
  const badgeKey = String(body.badgeKey ?? '').trim().toLowerCase();
  if (!badgeKey) return badRequest('badgeKey is required');

  try {
    const lb = await upsertLevelBadge(levelId, badgeKey);
    return NextResponse.json({ ok: true, levelBadge: lb });
  } catch (error) {
    console.error('Error in POST /api/admin/levels/badges:', error);
    return serverError(
      error instanceof Error ? error.message : 'Failed to add level badge',
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

  const levelId = String(body.levelId ?? '').trim();
  const badgeKey = String(body.badgeKey ?? '').trim().toLowerCase();
  if (!levelId || !badgeKey) return badRequest('levelId and badgeKey are required');

  try {
    const ok = await deleteLevelBadge(levelId, badgeKey);
    if (!ok) return badRequest('Level badge not found');
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error in DELETE /api/admin/levels/badges:', error);
    return serverError(
      error instanceof Error ? error.message : 'Failed to delete level badge',
    );
  }
}