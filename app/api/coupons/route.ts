// ============================================
// /api/coupons — Coupon management + member claims
// ============================================
// GET    → public. { coupons } (active only, no internal ids).
// PUT    → admin. { kind: 'coupon', coupon: { id?, code, discountPct,
//           activityId, active } }
// DELETE → admin. { id }
// POST   → member claim. { code, activityId } with x-auth-email header;
//          records the discount the user got.

import { NextResponse } from 'next/server';
import {
  claimCoupon,
  deleteCoupon,
  isAdminEmail,
  isExpired,
  listCoupons,
  upsertCoupon,
} from '@/lib/coupons-store';

export const dynamic = 'force-dynamic';

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

function serverError(message: string) {
  return NextResponse.json({ error: message }, { status: 500 });
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function getRequesterEmail(request: Request): string | null {
  const header = request.headers.get('x-auth-email');
  return header && header.trim().length > 0 ? header.trim().toLowerCase() : null;
}

export async function GET() {
  try {
    const coupons = await listCoupons();
    return NextResponse.json({
      coupons: coupons
        .filter((c) => c.active && !isExpired(c) && !c.userEmail)
        .map(({ code, discountPct, activityId }) => ({ code, discountPct, activityId })),
    });
  } catch (error) {
    console.error('Error in GET /api/coupons:', error);
    return serverError('Failed to load coupons');
  }
}

type UpsertBody = {
  kind: 'coupon';
  coupon: {
    id?: string;
    code: string;
    discountPct: number;
    activityId: string;
    userEmail?: string;
    active: boolean;
    expiresAt?: string;
  };
};

type DeleteBody = { kind?: 'delete'; id: string };

export async function PUT(request: Request) {
  const email = getRequesterEmail(request);
  if (!isAdminEmail(email)) return unauthorized();

  let body: UpsertBody | DeleteBody;
  try {
    body = (await request.json()) as UpsertBody | DeleteBody;
  } catch {
    return badRequest('Invalid JSON');
  }

  try {
    if (body.kind === 'coupon') {
      const { coupon } = body as UpsertBody;
      if (!coupon || typeof coupon.code !== 'string' || !coupon.code.trim()) {
        return badRequest('code is required');
      }
      const saved = await upsertCoupon({
        id: coupon.id,
        code: coupon.code,
        discountPct: Number(coupon.discountPct ?? 0),
        activityId: String(coupon.activityId ?? ''),
        userEmail: String(coupon.userEmail ?? ''),
        active: coupon.active === true,
        expiresAt: String(coupon.expiresAt ?? ''),
      });
      return NextResponse.json({ ok: true, coupon: saved });
    }
    const { id } = body as DeleteBody;
    if (!id) return badRequest('id is required');
    await deleteCoupon(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error in PUT /api/coupons:', error);
    return serverError(
      error instanceof Error ? error.message : 'Failed to save coupon',
    );
  }
}

export async function DELETE(request: Request) {
  const email = getRequesterEmail(request);
  if (!isAdminEmail(email)) return unauthorized();

  let body: DeleteBody;
  try {
    body = (await request.json()) as DeleteBody;
  } catch {
    return badRequest('Invalid JSON');
  }
  if (!body.id) return badRequest('id is required');

  try {
    await deleteCoupon(body.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error in DELETE /api/coupons:', error);
    return serverError('Failed to delete coupon');
  }
}

// Member claims a coupon — records the discount they get. Validation
// failures (bad code, wrong activity, already claimed) are user-facing
// → 400, not 500.
export async function POST(request: Request) {
  const email = getRequesterEmail(request);
  if (!email) return unauthorized();

  let body: { code: string; activityId: string };
  try {
    body = (await request.json()) as { code: string; activityId: string };
  } catch {
    return badRequest('Invalid JSON');
  }
  if (!body.code || typeof body.code !== 'string') {
    return badRequest('code is required');
  }

  try {
    const claim = await claimCoupon(body.code, email, String(body.activityId ?? ''));
    return NextResponse.json({ ok: true, claim });
  } catch (error) {
    return badRequest(
      error instanceof Error ? error.message : 'Failed to claim coupon',
    );
  }
}
