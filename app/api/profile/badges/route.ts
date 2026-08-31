// ============================================
// /api/profile/badges
// ============================================
//
// GET ?user=<email> → { badges: GrantedBadge[] }
//                     (omit ?user= for the signed-in user; admins may
//                     request another user to drive the view-as panel.)
//
// Returns the catalog entries the target user has been granted. Used by
// the profile Achievements panel and the sidebar Badges count.

import { NextResponse } from 'next/server';
import { isAdminEmail } from '@/lib/admin';
import {
  countGrantedBadgesForUser,
  listGrantedBadgesForUser,
} from '@/lib/achievements-store';

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

export async function GET(request: Request) {
  const email = getRequesterEmail(request);
  if (!email) return unauthorized();

  const { searchParams } = new URL(request.url);
  const requestedUser = searchParams.get('user')?.trim().toLowerCase() || null;
  const targetEmail = requestedUser && isAdminEmail(email) ? requestedUser : email;
  const wantCount = searchParams.get('count') === '1';

  try {
    if (wantCount) {
      const count = await countGrantedBadgesForUser(targetEmail);
      return NextResponse.json({ count });
    }
    const badges = await listGrantedBadgesForUser(targetEmail);
    return NextResponse.json({ badges });
  } catch (error) {
    console.error('Error in GET /api/profile/badges:', error);
    return serverError('Failed to load badges');
  }
}