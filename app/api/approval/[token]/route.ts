// ============================================
// /api/approval/[token] — one-click admin approval, no login
// ============================================
// The HMAC token in the URL IS the auth (signed with ADMIN_APPROVAL_SECRET,
// sent only to the admin's WhatsApp). GET previews the signup; POST
// { action, reason? } executes the decision through the same shared helpers
// as the admin dashboard. Replay-safe: decideSignup/decidePayment reject
// rows whose status no longer matches, so an already-used link just errors.

import { NextResponse } from 'next/server';
import { getSpreadsheetId } from '@/app/lib/supabase';
import {
  decidePayment,
  decideSignupWithActivity,
  getActivityTitles,
  readSignupById,
} from '@/lib/activity-signups-store';
import { notifySignupDecision } from '@/lib/whatsapp-bot';
import { verifyApprovalToken } from '@/lib/approval-token';

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function serverError(message: string) {
  return NextResponse.json({ error: message }, { status: 500 });
}

/** Preview: what the admin is about to decide. No proofUrl leak (can be a
 * multi-MB data URL); the image itself was already sent over WhatsApp. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const payload = verifyApprovalToken(token);
  if (!payload) return badRequest('Token tidak valid');
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) return serverError('Supabase is not configured');
  try {
    const signup = await readSignupById(spreadsheetId, payload.signupId);
    if (!signup) return badRequest('Pendaftaran tidak ditemukan');
    const titles = await getActivityTitles(spreadsheetId);
    const { paymentProofUrl: _proof, ...safe } = signup;
    return NextResponse.json({
      ok: true,
      signup: { ...safe, activityTitle: titles.get(signup.activityId) ?? signup.activityId },
    });
  } catch (error) {
    console.error('Error in GET /api/approval/[token]:', error);
    return serverError('Failed to load signup');
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const payload = verifyApprovalToken(token);
  if (!payload) return badRequest('Token tidak valid');

  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) return serverError('Supabase is not configured');

  let body: { action?: string; reason?: string };
  try {
    body = (await request.json()) as { action?: string; reason?: string };
  } catch {
    return badRequest('Invalid JSON');
  }
  const action = String(body.action ?? '');
  if (
    action !== 'approve' &&
    action !== 'reject' &&
    action !== 'approve-payment' &&
    action !== 'reject-payment'
  ) {
    return badRequest('action must be approve|reject|approve-payment|reject-payment');
  }
  const reason = body.reason ? String(body.reason).trim().slice(0, 500) || undefined : undefined;

  try {
    if (action === 'approve-payment' || action === 'reject-payment') {
      const { signup, error } = await decidePayment(
        spreadsheetId,
        payload.signupId,
        action === 'approve-payment' ? 'approve' : 'reject',
        'admin (link WhatsApp)',
        reason,
      );
      if (!signup) {
        return error ? badRequest(error) : badRequest('Pendaftaran tidak ditemukan');
      }
      void notifySignupDecision(
        signup.userEmail,
        action === 'approve-payment' ? 'payment-approved' : 'payment-rejected',
        signup.activityId,
      );
      return NextResponse.json({ ok: true, signup });
    }

    const { signup, error } = await decideSignupWithActivity(
      spreadsheetId,
      payload.signupId,
      action === 'approve' ? 'approve' : 'reject',
      'admin (link WhatsApp)',
    );
    if (!signup) {
      return error ? badRequest(error) : badRequest('Pendaftaran tidak ditemukan');
    }
    void notifySignupDecision(
      signup.userEmail,
      action === 'approve' ? 'approved' : 'rejected',
      signup.activityId,
    );
    return NextResponse.json({ ok: true, signup });
  } catch (error) {
    console.error('Error in POST /api/approval/[token]:', error);
    return serverError('Failed to update signup');
  }
}
