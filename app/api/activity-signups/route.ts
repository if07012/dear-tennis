// ============================================
// /api/activity-signups — public signup endpoint
// ============================================
//
// POST { activityId, message?, couponCode? } → create or fetch the current
//                                  user's signup for an activity. Idempotent:
//                                  re-clicking "Join" returns the existing
//                                  row's status without creating a duplicate.
//
// Coupon: validated against the coupons table (active, not expired, right
// activity, right user, not already claimed). The discount % is snapshotted
// onto the signup row so later coupon edits don't rewrite history (PRD §6).
//
// Capacity: the join is refused when the activity's slots (groupSize) are
// fully occupied by waiting_payment + payment_submitted + joined rows
// (PRD Rule 1/6).
//
// Auth: x-auth-email must be a real user from the `users` sheet. Anonymous
// requests are rejected so the signup is always attributable.

import { NextResponse } from 'next/server';
import { getSpreadsheetId, listRowsBySheet } from '@/app/lib/supabase';
import { registerUserForActivity } from '@/lib/activity-bookings';
import {
  isExpired,
  listClaims,
  listCoupons,
} from '@/lib/coupons-store';
import { getActivitiesContent } from '@/lib/activities-store';
import { parsePriceToAmount } from '@/data/activity-signups-types';

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

  let body: { activityId?: string; message?: string; couponCode?: string };
  try {
    body = (await request.json()) as {
      activityId?: string;
      message?: string;
      couponCode?: string;
    };
  } catch {
    return badRequest('Invalid JSON');
  }

  const activityId = String(body.activityId ?? '').trim();
  if (!activityId) return badRequest('activityId is required');

  const message = body.message ? String(body.message).trim().slice(0, 500) || undefined : undefined;
  const couponCode = String(body.couponCode ?? '').trim().toUpperCase();

  try {
    const user = await resolveUser(usersSheetId, email);
    if (!user) return unauthorized();

    // Coupon eligibility (PRD §6): active, unexpired, applicable activity,
    // right user, not already claimed by this user. The discount % is
    // snapshotted onto the signup row; everything else (idempotency,
    // archived/full checks, capacity) runs in the shared pipeline.
    let couponCodeSnapshot: string | undefined;
    let discountPct = 0;
    if (couponCode) {
      const [coupons, claims] = await Promise.all([listCoupons(), listClaims()]);
      const coupon = coupons.find((c) => c.code === couponCode);
      if (!coupon) return badRequest('Kode kupon tidak ditemukan');
      if (!coupon.active) return badRequest('Kupon sudah tidak aktif');
      if (isExpired(coupon)) return badRequest('Kupon sudah kadaluarsa');
      if (coupon.activityId && coupon.activityId !== activityId) {
        return badRequest('Kupon ini bukan untuk activity tersebut');
      }
      if (coupon.userEmail && coupon.userEmail !== user.email) {
        return badRequest('Kupon ini bukan untuk akun kamu');
      }
      if (claims.some((cl) => cl.couponId === coupon.id && cl.userEmail === user.email)) {
        return badRequest('Kamu sudah klaim kupon ini');
      }
      couponCodeSnapshot = coupon.code;
      discountPct = coupon.discountPct;
    }

    const result = await registerUserForActivity(user, activityId, {
      message,
      couponCode: couponCodeSnapshot,
      discountPct,
    });
    if (!result.ok) return badRequest(result.error);
    // The shared helper returns status only; fetch the row for the response.
    const { findSignup } = await import('@/lib/activity-signups-store');
    const signup = await findSignup(activitiesSheetId, activityId, user.email);
    return NextResponse.json({
      ok: true,
      signup,
      created: result.created,
    });
  } catch (error) {
    console.error('Error in POST /api/activity-signups:', error);
    return serverError('Failed to register signup');
  }
}
