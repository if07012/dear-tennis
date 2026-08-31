// ============================================
// /api/activity-signups/mine — current user's signup status map
// ============================================
//
// GET → { signups: Array<{ activityId, status, requestedAt, decidedAt }> }
//
// Used by the home Activities section to render the right Join button
// state per card without firing N requests.

import { NextResponse } from 'next/server';
import { listRowsBySheet } from '@/app/lib/googleSheets';
import { isSignupStatus } from '@/data/activity-signups-types';

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

function getSpreadsheetId(): string | null {
  const id = process.env.HERO_SPREADSHEET_ID?.trim();
  return id && id.length > 0 ? id : null;
}

export async function GET(request: Request) {
  const email = getRequesterEmail(request);
  if (!email) return unauthorized();

  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) return serverError('HERO_SPREADSHEET_ID is not set');

  try {
    const rows = await listRowsBySheet(spreadsheetId, 'activity_signups');
    const lower = email.trim().toLowerCase();
    const items = rows
      .filter(
        (r) =>
          String((r as unknown as { userEmail?: unknown }).userEmail ?? '')
            .trim()
            .toLowerCase() === lower,
      )
      .map((r) => {
        const obj = r as unknown as Record<string, unknown>;
        const statusRaw = String(obj.status ?? '');
        const status = isSignupStatus(statusRaw) ? statusRaw : 'pending';
        return {
          activityId: String(obj.activityId ?? '').trim(),
          status,
          requestedAt: String(obj.requestedAt ?? ''),
          decidedAt: obj.decidedAt ? String(obj.decidedAt) : undefined,
        };
      })
      .filter((s) => s.activityId.length > 0);
    return NextResponse.json({ signups: items });
  } catch (error) {
    console.error('Error in GET /api/activity-signups/mine:', error);
    return serverError('Failed to load signups');
  }
}
