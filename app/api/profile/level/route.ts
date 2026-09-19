// ============================================
// /api/profile/level — get player's current level & progress
// ============================================
//
// GET ?user=<email> → { level: PlayerLevelResult }
//                      (omit ?user= for the signed-in user; admins may
//                      request another user to drive the view-as panel.)

import { NextResponse } from 'next/server';
import { isAdminEmail } from '@/lib/admin';
import { computePlayerLevel } from '@/lib/tennis-level-store';

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

  try {
    const level = await computePlayerLevel(targetEmail);
    return NextResponse.json({ level });
  } catch (error) {
    console.error('Error in GET /api/profile/level:', error);
    return serverError('Failed to compute player level');
  }
}