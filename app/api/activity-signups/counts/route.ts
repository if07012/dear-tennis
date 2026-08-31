// ============================================
// /api/activity-signups/counts — public
// ============================================
//
// GET → { counts: { [activityId]: number } } of approved signups per
// activity. Used by the home page cards and the admin list to show
// "X members joined" without leaking the underlying user records.

import { NextResponse } from 'next/server';
import { getSignupCountsByActivity } from '@/lib/activity-signups-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  const counts = await getSignupCountsByActivity();
  const out: Record<string, number> = {};
  for (const [id, n] of counts) out[id] = n;
  return NextResponse.json({ counts: out });
}
