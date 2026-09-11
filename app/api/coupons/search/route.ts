// ============================================
// /api/coupons/search — admin dropdown search
// ============================================
// GET ?type=activity|member&q=  → first 20 matches as { id, label }.
// Server-side so the coupon drawer never needs the full activity/user
// list client-side. Admin-gated like the other coupon endpoints.

import { NextResponse } from 'next/server';
import { isAdminEmail } from '@/lib/coupons-store';
import { getActivitiesContentForAdmin } from '@/lib/activities-store';
import { listAllUsersForAdmin } from '@/lib/users-store';

export const dynamic = 'force-dynamic';

const LIMIT = 20;

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

function serverError(message: string) {
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function GET(request: Request) {
  const header = request.headers.get('x-auth-email');
  const email = header && header.trim().length > 0 ? header.trim().toLowerCase() : null;
  if (!isAdminEmail(email)) return unauthorized();

  const url = new URL(request.url);
  const type = url.searchParams.get('type');
  const q = (url.searchParams.get('q') ?? '').trim().toLowerCase();

  try {
    let items: { id: string; label: string }[] = [];
    if (type === 'activity') {
      // "Active" activity = not archived.
      const content = await getActivitiesContentForAdmin();
      items = content.activities
        .filter((a) => a.archived !== true)
        .filter((a) => !q || a.title.toLowerCase().includes(q))
        .slice(0, LIMIT)
        .map((a) => ({ id: a.id, label: a.title }));
    } else if (type === 'member') {
      const users = await listAllUsersForAdmin();
      items = users
        .filter((u) => u.email.trim().length > 0)
        .filter(
          (u) =>
            !q ||
            u.email.toLowerCase().includes(q) ||
            u.name.toLowerCase().includes(q),
        )
        .slice(0, LIMIT)
        .map((u) => ({ id: u.email, label: u.name === u.email ? u.email : `${u.name} (${u.email})` }));
    } else {
      return NextResponse.json({ error: 'type must be "activity" or "member"' }, { status: 400 });
    }
    return NextResponse.json({ items });
  } catch (error) {
    console.error('Error in GET /api/coupons/search:', error);
    return serverError('Failed to search');
  }
}
