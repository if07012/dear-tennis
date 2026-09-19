// ============================================
// /api/admin/levels — admin level management
// ============================================
//
// GET                  → list levels
// POST { name, description, order, isActive? }  → create level
// PATCH { id, name?, description?, order?, isActive? } → update level
// DELETE { id }        → delete level

import { NextResponse } from 'next/server';
import { isAdminEmail } from '@/lib/admin';
import {
  listLevels,
  upsertLevel,
  deleteLevel,
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
  try {
    const levels = await listLevels();
    return NextResponse.json({ levels });
  } catch (error) {
    console.error('Error in GET /api/admin/levels:', error);
    return serverError('Failed to load levels');
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

  const name = String(body.name ?? '').trim();
  const description = String(body.description ?? '').trim();
  const order = Number(body.order ?? 0);
  const isActive = body.isActive !== undefined ? Boolean(body.isActive) : true;

  if (!name) return badRequest('name is required');

  try {
    const level = await upsertLevel({ name, description, order, isActive });
    return NextResponse.json({ ok: true, level });
  } catch (error) {
    console.error('Error in POST /api/admin/levels:', error);
    return serverError(
      error instanceof Error ? error.message : 'Failed to create level',
    );
  }
}

export async function PATCH(request: Request) {
  const email = getRequesterEmail(request);
  if (!email || !isAdminEmail(email)) return unauthorized();

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return badRequest('Invalid JSON');
  }

  const id = String(body.id ?? '').trim();
  if (!id) return badRequest('id is required');

  try {
    const input = {
      id,
      ...(body.name !== undefined ? { name: String(body.name).trim() } : {}),
      ...(body.description !== undefined ? { description: String(body.description).trim() } : {}),
      ...(body.order !== undefined ? { order: Number(body.order) } : {}),
      ...(body.isActive !== undefined ? { isActive: Boolean(body.isActive) } : {}),
    };

    const level = await upsertLevel(input);
    return NextResponse.json({ ok: true, level });
  } catch (error) {
    console.error('Error in PATCH /api/admin/levels:', error);
    return serverError(
      error instanceof Error ? error.message : 'Failed to update level',
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

  const id = String(body.id ?? '').trim();
  if (!id) return badRequest('id is required');

  try {
    const ok = await deleteLevel(id);
    if (!ok) return badRequest('Level not found');
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error in DELETE /api/admin/levels:', error);
    return serverError(
      error instanceof Error ? error.message : 'Failed to delete level',
    );
  }
}