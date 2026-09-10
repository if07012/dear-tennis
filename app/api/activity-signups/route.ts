// ============================================
// /api/activity-signups — public signup endpoint
// ============================================
//
// POST { activityId, message? }  → create or fetch the current user's
//                                  signup for an activity. Idempotent:
//                                  re-clicking "Join" returns the existing
//                                  row's status without creating a duplicate.
//
// Auth: x-auth-email must be a real user from the `users` sheet. Anonymous
// requests are rejected so the signup is always attributable.

import { NextResponse } from 'next/server';
import { getSpreadsheetId, listRowsBySheet } from '@/app/lib/supabase';
import { findSignup, requestSignup } from '@/lib/activity-signups-store';

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

function serverError(message: string) {
  return NextResponse.json({ error: message }, { status: 500 });
}

function getRequesterEmail(request: Request): string | null {
  const header = request.headers.get('x-auth-email');
  return header && header.trim().length > 0 ? header.trim().toLowerCase() : null;
}

async function resolveUser(
  usersSpreadsheetId: string,
  email: string,
): Promise<{ id: string; email: string; name: string } | null> {
  const rows = await listRowsBySheet(usersSpreadsheetId, 'users');
  const found = rows.find(
    (r) => String((r as unknown as { email?: unknown }).email ?? '').trim().toLowerCase() === email,
  );
  if (!found) return null;
  const obj = found as unknown as Record<string, unknown>;
  return {
    id: String(obj.id ?? ''),
    email: String(obj.email ?? '').trim().toLowerCase(),
    name: String(obj.name ?? '').trim() || email,
  };
}

export async function POST(request: Request) {
  const email = getRequesterEmail(request);
  if (!email) return unauthorized();

  const usersSheetId = getSpreadsheetId();
  if (!usersSheetId) return serverError('Supabase is not configured');
  const activitiesSheetId = usersSheetId;

  let body: { activityId?: string; message?: string };
  try {
    body = (await request.json()) as { activityId?: string; message?: string };
  } catch {
    return badRequest('Invalid JSON');
  }

  const activityId = String(body.activityId ?? '').trim();
  if (!activityId) return badRequest('activityId is required');

  const message = body.message ? String(body.message).trim().slice(0, 500) || undefined : undefined;

  try {
    const user = await resolveUser(usersSheetId, email);
    if (!user) return unauthorized();

    const existing = await findSignup(activitiesSheetId, activityId, user.email);
    if (existing && existing.status === 'approved') {
      // Already approved — short-circuit to keep the UI in sync without a
      // server-side mutation.
      return NextResponse.json({ ok: true, signup: existing, created: false });
    }

    const result = await requestSignup(activitiesSheetId, {
      activityId,
      userEmail: user.email,
      userName: user.name,
      message,
    });
    return NextResponse.json({
      ok: true,
      signup: result.signup,
      created: result.created,
    });
  } catch (error) {
    console.error('Error in POST /api/activity-signups:', error);
    return serverError('Failed to register signup');
  }
}
