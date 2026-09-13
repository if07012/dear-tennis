// ============================================
// /api/admin/groq-keys — Groq rotation pool
// ============================================
// GET    → masked keys in priority order
// POST   { fullKey }        → add a key (masked from here on)
// DELETE { id }              → remove a key
// PATCH  { ids: string[] }  → reorder (index = priority)
// Admin-gated via x-auth-email + isAdminEmail.

import { NextResponse } from 'next/server';
import { isAdminEmail } from '@/lib/admin';
import {
  addGroqKey,
  deleteGroqKey,
  listGroqKeys,
  reorderGroqKeys,
  validateGroqKey,
} from '@/lib/groq-store';

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
  if (!isAdminEmail(getRequesterEmail(request))) return unauthorized();
  try {
    return NextResponse.json({ keys: await listGroqKeys() });
  } catch (error) {
    console.error('Error in GET /api/admin/groq-keys:', error);
    return serverError('Failed to list keys');
  }
}

export async function POST(request: Request) {
  if (!isAdminEmail(getRequesterEmail(request))) return unauthorized();
  let body: { fullKey?: string };
  try {
    body = (await request.json()) as { fullKey?: string };
  } catch {
    return badRequest('Invalid JSON');
  }
  const error = validateGroqKey(String(body.fullKey ?? ''));
  if (error) return badRequest(error);
  try {
    const key = await addGroqKey(String(body.fullKey));
    if (!key) return serverError('Supabase is not configured');
    return NextResponse.json({ ok: true, key });
  } catch (err) {
    console.error('Error in POST /api/admin/groq-keys:', err);
    return serverError('Failed to add key');
  }
}

export async function DELETE(request: Request) {
  if (!isAdminEmail(getRequesterEmail(request))) return unauthorized();
  let body: { id?: string };
  try {
    body = (await request.json()) as { id?: string };
  } catch {
    return badRequest('Invalid JSON');
  }
  if (!body.id) return badRequest('id is required');
  try {
    const ok = await deleteGroqKey(String(body.id));
    return NextResponse.json({ ok });
  } catch (err) {
    console.error('Error in DELETE /api/admin/groq-keys:', err);
    return serverError('Failed to delete key');
  }
}

export async function PATCH(request: Request) {
  if (!isAdminEmail(getRequesterEmail(request))) return unauthorized();
  let body: { ids?: string[] };
  try {
    body = (await request.json()) as { ids?: string[] };
  } catch {
    return badRequest('Invalid JSON');
  }
  if (!Array.isArray(body.ids) || body.ids.some((id) => typeof id !== 'string')) {
    return badRequest('ids must be an array of strings');
  }
  try {
    const ok = await reorderGroqKeys(body.ids);
    return NextResponse.json({ ok });
  } catch (err) {
    console.error('Error in PATCH /api/admin/groq-keys:', err);
    return serverError('Failed to reorder keys');
  }
}
