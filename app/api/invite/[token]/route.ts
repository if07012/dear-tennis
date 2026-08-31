// ============================================
// /api/invite/[token] — public invite lookup
// ============================================
//
// Returns the public-facing view of an invitation. Used by /invite/[token]
// to decide which UI state to render (form, accepted, cancelled, missing).
//
// Deliberately omits message and admin identity — those are server-side
// only and aren't relevant to the recipient filling in the form.

import { NextResponse } from 'next/server';
import { ensureInviteSheets, getInviteByTokenForPublic } from '@/lib/invite-store';

function getSpreadsheetId(): string | null {
  const id = process.env.HERO_SPREADSHEET_ID?.trim();
  return id && id.length > 0 ? id : null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!token || typeof token !== 'string' || token.trim().length < 8) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
  }
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) {
    return NextResponse.json({ error: 'Server is not configured' }, { status: 500 });
  }

  try {
    await ensureInviteSheets(spreadsheetId);
    const invite = await getInviteByTokenForPublic(spreadsheetId, token);
    if (!invite) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(invite);
  } catch (error) {
    console.error('Error in GET /api/invite/[token]:', error);
    return NextResponse.json({ error: 'Failed to load invitation' }, { status: 500 });
  }
}
