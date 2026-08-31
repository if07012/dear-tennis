// ============================================
// /api/admin/badges — admin badge catalog
// ============================================
//
// GET                   → list catalog
// POST { key, label, icon?, description?, archived? }
//                      → upsert a catalog entry by key
//
// All endpoints require `x-auth-email` matching ADMIN_EMAIL.

import { NextResponse } from 'next/server';
import { isAdminEmail } from '@/lib/admin';
import { listBadgeCatalog, upsertBadge } from '@/lib/achievements-store';

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
  try {
    const badges = await listBadgeCatalog();
    return NextResponse.json({ badges });
  } catch (error) {
    console.error('Error in GET /api/admin/badges:', error);
    return serverError('Failed to load badges');
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

  const key = String(body.key ?? '').trim().toLowerCase();
  const label = String(body.label ?? '').trim();
  if (!key) return badRequest('key is required');
  if (!label) return badRequest('label is required');
  if (key.length > 60) return badRequest('key is too long');

  try {
    const badge = await upsertBadge({
      key,
      label,
      icon: String(body.icon ?? '').trim(),
      description: String(body.description ?? '').trim(),
      archived: typeof body.archived === 'boolean' ? body.archived : undefined,
    });
    return NextResponse.json({ ok: true, badge });
  } catch (error) {
    console.error('Error in POST /api/admin/badges:', error);
    return serverError(
      error instanceof Error ? error.message : 'Failed to save badge',
    );
  }
}