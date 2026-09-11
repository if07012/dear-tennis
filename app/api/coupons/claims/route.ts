// /api/coupons/claims — admin-only listing of coupons + every claim.
import { NextResponse } from 'next/server';
import { isAdminEmail, listClaims, listCoupons } from '@/lib/coupons-store';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const header = request.headers.get('x-auth-email');
  const email = header && header.trim().length > 0 ? header.trim().toLowerCase() : null;
  if (!isAdminEmail(email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const [coupons, claims] = await Promise.all([listCoupons(), listClaims()]);
    return NextResponse.json({ coupons, claims });
  } catch (error) {
    console.error('Error in GET /api/coupons/claims:', error);
    return NextResponse.json({ error: 'Failed to load claims' }, { status: 500 });
  }
}
