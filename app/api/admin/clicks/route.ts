// ============================================
// /api/admin/clicks — click-tracking dashboard data
// ============================================
//
// GET ?page=&pageSize=&q=&from=&to=&sort=&dir=  → ClicksAdminPayload, admin-gated
//
// Requires `x-auth-email` matching ADMIN_EMAIL.

import { NextResponse } from 'next/server';
import { getClicksForAdmin, isAdminEmail } from '@/lib/click-tracking-store';

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

function parsePositiveInt(value: string | null): number | undefined {
  if (!value) return undefined;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export async function GET(request: Request): Promise<Response> {
  const email = request.headers.get('x-auth-email');
  if (!isAdminEmail(email)) return unauthorized();

  const url = new URL(request.url);
  const sort = url.searchParams.get('sort');
  const dir = url.searchParams.get('dir');
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');

  // ISO-ish strings sort lexicographically like they do chronologically;
  // anything unparseable is dropped rather than trusted.
  const validIso = (v: string | null) =>
    v && !Number.isNaN(Date.parse(v)) ? v : undefined;

  const payload = await getClicksForAdmin({
    page: parsePositiveInt(url.searchParams.get('page')),
    pageSize: parsePositiveInt(url.searchParams.get('pageSize')),
    q: url.searchParams.get('q') ?? undefined,
    from: validIso(from),
    to: validIso(to),
    sort: (sort ?? undefined) as never,
    dir: dir === 'asc' || dir === 'desc' ? dir : undefined,
  });
  return NextResponse.json(payload);
}
