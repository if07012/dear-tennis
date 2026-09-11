// ============================================
// /api/coupons/eligible — member's claimable coupons for an activity
// ============================================
//
// GET ?activityId= with x-auth-email → { coupons: [{ code, discountPct }] }
// Public codes plus personal ones assigned to this member, minus ones they
// already claimed. Powers the coupon step in the Join dialog (PRD §5).

import { NextResponse } from 'next/server';
import { isExpired, listEligibleCoupons } from '@/lib/coupons-store';

export const dynamic = 'force-dynamic';

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
  if (!email) return unauthorized();

  const activityId = new URL(request.url).searchParams.get('activityId')?.trim() ?? '';
  if (!activityId) return badRequest('activityId is required');

  try {
    const coupons = await listEligibleCoupons(email, activityId);
    return NextResponse.json({
      coupons: coupons
        // Belt and braces: listEligibleCoupons already filters these.
        .filter((c) => c.active && !isExpired(c))
        .map(({ code, discountPct }) => ({ code, discountPct })),
    });
  } catch (error) {
    console.error('Error in GET /api/coupons/eligible:', error);
    return serverError('Failed to load coupons');
  }
}
