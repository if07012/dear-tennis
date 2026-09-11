// ============================================
// /api/activity-signups/mine — current user's signup status map
// ============================================
//
// GET → { signups: Array<{ activityId, status, requestedAt, decidedAt,
//           couponCode, discountPct, originalAmount, finalAmount,
//           paymentProofUrl, rejectionReason, expiresAt }> }
//
// Used by the home Activities section and the activity detail page to
// render the right Join/payment state per card without firing N requests.

import { NextResponse } from 'next/server';
import { getSpreadsheetId, listRowsBySheet } from '@/app/lib/supabase';
import {
  coerceLegacyStatus,
  isSignupStatus,
  type SignupStatus,
} from '@/data/activity-signups-types';

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

function statusOf(raw: string): SignupStatus {
  return isSignupStatus(raw) ? raw : coerceLegacyStatus(raw) ?? 'pending_approval';
}

export async function GET(request: Request) {
  const email = getRequesterEmail(request);
  if (!email) return unauthorized();

  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) return serverError('Supabase is not configured');

  try {
    const rows = await listRowsBySheet(spreadsheetId, 'activity_signups');
    const lower = email.trim().toLowerCase();
    const items = rows
      .filter(
        (r) =>
          String((r as unknown as { userEmail?: unknown }).userEmail ?? '')
            .trim()
            .toLowerCase() === lower,
      )
      .map((r) => {
        const obj = r as unknown as Record<string, unknown>;
        const status = statusOf(String(obj.status ?? ''));
        return {
          id: String(obj.id ?? '').trim(),
          activityId: String(obj.activityId ?? '').trim(),
          status,
          requestedAt: String(obj.requestedAt ?? ''),
          decidedAt: obj.decidedAt ? String(obj.decidedAt) : undefined,
          couponCode: String(obj.couponCode ?? '').trim(),
          discountPct: Number(obj.discountPct ?? 0) || 0,
          originalAmount: Number(obj.originalAmount ?? 0) || 0,
          finalAmount: Number(obj.finalAmount ?? 0) || 0,
          paymentProofUrl: obj.paymentProofUrl
            ? String(obj.paymentProofUrl)
            : undefined,
          rejectionReason: obj.rejectionReason
            ? String(obj.rejectionReason)
            : undefined,
          expiresAt: obj.expiresAt ? String(obj.expiresAt) : undefined,
        };
      })
      .filter((s) => s.activityId.length > 0 && s.id.length > 0);
    return NextResponse.json({ signups: items });
  } catch (error) {
    console.error('Error in GET /api/activity-signups/mine:', error);
    return serverError('Failed to load signups');
  }
}
