// ============================================
// /api/activity-signups/counts — public
// ============================================
//
// GET → { joined: { [activityId]: number }, occupied: { [activityId]: number } }
//
// `joined` counts members (for "X terdaftar" / member lists); `occupied`
// counts slot-consuming registrations (joined + waiting_payment +
// payment_submitted) so the UI can show "N slots remaining" (PRD §15)
// without leaking the underlying user records.

import { NextResponse } from 'next/server';
import { getSignupCountsByActivity } from '@/lib/activity-signups-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { occupied, joined } = await getSignupCountsByActivity();
  return NextResponse.json({ counts: joined, occupied });
}
