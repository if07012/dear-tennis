// ============================================
// /api/admin/activity-signups — admin queue
// ============================================
//
// GET    ?page=&pageSize=&status=&activity= → paged signup list, admin-gated
// PATCH  { id, action, reason? }            → approve/reject registration or
//                                             payment, admin-gated
//   action=approve  : pending_approval → waiting_payment (slot reserved,
//                     capacity-checked) — or joined directly when the
//                     activity has no price / paymentRequired=false
//   action=reject   : pending_approval → rejected (slot released)
//   action=approve-payment : payment_submitted → joined
//   action=reject-payment  : payment_submitted → waiting_payment + reason
// DELETE { id } → remove a signup row, admin-gated

import { NextResponse } from 'next/server';
import {
  decidePayment,
  decideSignupWithActivity,
  getActivityTitles,
  listSignupsForAdmin,
  removeSignup,
} from '@/lib/activity-signups-store';
import { isAdminEmail } from '@/lib/admin';
import { getSpreadsheetId } from '@/app/lib/supabase';
import { notifySignupDecision } from '@/lib/whatsapp-bot';

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
  const statusParam = url.searchParams.get('status')?.trim();
  const activityId = url.searchParams.get('activity')?.trim() || undefined;

  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) return serverError('Supabase is not configured');

  try {
    // Resolve the status filter. Accept legacy values (pending/approved/
    // rejected) from old links by mapping them onto the new set.
    const { coerceLegacyStatus, isSignupStatus } = await import(
      '@/data/activity-signups-types'
    );
    let status: import('@/data/activity-signups-types').SignupStatus | 'all' = 'all';
    if (statusParam && statusParam !== 'all') {
      status = isSignupStatus(statusParam)
        ? statusParam
        : coerceLegacyStatus(statusParam) ?? 'all';
    }

    const [paged, titles] = await Promise.all([
      listSignupsForAdmin({ page, pageSize, status, activityId, withCounts: true }),
      getActivityTitles(spreadsheetId),
    ]);
    const items = paged.items.map((s) => ({
      ...s,
      activityTitle: titles.get(s.activityId) ?? s.activityId,
    }));
    return NextResponse.json({ ...paged, items });
  } catch (error) {
    console.error('Error in GET /api/admin/activity-signups:', error);
    return serverError('Failed to list signups');
  }
}

type PatchBody = {
  id: string;
  action: 'approve' | 'reject' | 'approve-payment' | 'reject-payment';
  reason?: string;
};

export async function PATCH(request: Request) {
  const email = getRequesterEmail(request);
  if (!isAdminEmail(email)) return unauthorized();

  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) return serverError('Supabase is not configured');

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return badRequest('Invalid JSON');
  }
  if (!body.id || typeof body.id !== 'string') return badRequest('id is required');
  const action = body.action;
  if (
    action !== 'approve' &&
    action !== 'reject' &&
    action !== 'approve-payment' &&
    action !== 'reject-payment'
  ) {
    return badRequest('action must be approve|reject|approve-payment|reject-payment');
  }

  try {
    if (action === 'approve-payment' || action === 'reject-payment') {
      const { signup, error } = await decidePayment(
        spreadsheetId,
        body.id,
        action === 'approve-payment' ? 'approve' : 'reject',
        email ?? '',
        body.reason,
      );
      if (!signup) {
        return error ? badRequest(error) : badRequest('Signup not found');
      }
      void notifySignupDecision(signup.userEmail, action === 'approve-payment' ? 'payment-approved' : 'payment-rejected', signup.activityId);
      return NextResponse.json({ ok: true, signup });
    }

    // Registration approve/reject — capacity + payment settings come from the
    // activity row inside the shared helper (same one the WhatsApp one-click
    // approval links go through).
    const { signup, error } = await decideSignupWithActivity(
      spreadsheetId,
      body.id,
      action === 'approve' ? 'approve' : 'reject',
      email ?? '',
    );
    if (!signup) {
      return error ? badRequest(error) : badRequest('Signup not found');
    }
    void notifySignupDecision(
      signup.userEmail,
      action === 'approve' ? 'approved' : 'rejected',
      signup.activityId,
    );
    return NextResponse.json({ ok: true, signup });
  } catch (error) {
    console.error('Error in PATCH /api/admin/activity-signups:', error);
    return serverError('Failed to update signup');
  }
}

export async function DELETE(request: Request) {
  const email = getRequesterEmail(request);
  if (!isAdminEmail(email)) return unauthorized();

  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) return serverError('Supabase is not configured');

  let body: { id: string };
  try {
    body = (await request.json()) as { id: string };
  } catch {
    return badRequest('Invalid JSON');
  }
  if (!body.id || typeof body.id !== 'string') return badRequest('id is required');

  try {
    const ok = await removeSignup(spreadsheetId, body.id);
    if (!ok) return badRequest('Signup not found');
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error in DELETE /api/admin/activity-signups:', error);
    return serverError('Failed to delete signup');
  }
}
