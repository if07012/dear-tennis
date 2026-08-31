// ============================================
// /api/profile — current-user updates
// ============================================
//
// PATCH { photo?: string|null, name?: string, rank?: string|null } →
// update the current user's row. The requester is identified by the
// `x-auth-email` header (same pattern as the rest of the public signup
// endpoints).
//
// Photo is stored as a base64 data URL in the users sheet's `photo`
// column. The client compresses the image before sending; this route
// enforces a hard size cap to keep the sheet cell bounded. Name + rank
// are plain strings (rank optional / clearable).

import { NextResponse } from 'next/server';
import { listRowsBySheet, updateRowById } from '@/app/lib/googleSheets';
import { isAdminEmail } from '@/lib/activities-store';
import { USERS_HEADERS } from '@/lib/users-store';

const MAX_PHOTO_BYTES = 200 * 1024; // 200 KB cap on the base64 string
const MAX_NAME_LEN = 80;
const MAX_RANK_LEN = 60;

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}
function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
function serverError(message: string) {
  return NextResponse.json({ error: message }, { status: 500 });
}

function getSpreadsheetId(): string | null {
  return (
    process.env.USERS_SPREADSHEET_ID ||
    process.env.GOOGLE_SPREADSHEET_ID ||
    null
  );
}

function getRequesterEmail(request: Request): string | null {
  const header = request.headers.get('x-auth-email');
  return header && header.trim().length > 0
    ? header.trim().toLowerCase()
    : null;
}

type PatchBody = {
  photo?: string | null;
  name?: string;
  rank?: string | null;
};

export async function PATCH(request: Request) {
  const email = getRequesterEmail(request);
  if (!email) return unauthorized();
  if (isAdminEmail(email)) {
    // Admin profile is implicit; we deliberately don't mutate the admin
    // row from this endpoint to keep the seed/ADMIN_EMAIL flow simple.
    return NextResponse.json({ ok: true, skipped: true });
  }

  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) return serverError('USERS_SPREADSHEET_ID is not set');

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return badRequest('Invalid JSON');
  }

  const patch: Record<string, string> = {};
  if (body.photo !== null && body.photo !== undefined) {
    if (typeof body.photo !== 'string' || !body.photo.startsWith('data:image/')) {
      return badRequest('photo must be a data: URL or null');
    }
    if (body.photo.length > MAX_PHOTO_BYTES) {
      return badRequest('photo is too large (max 200 KB)');
    }
    patch.photo = body.photo;
  } else if (body.photo === null) {
    patch.photo = '';
  }
  if (body.name !== undefined) {
    if (typeof body.name !== 'string') {
      return badRequest('name must be a string');
    }
    const trimmed = body.name.trim();
    if (trimmed.length === 0) {
      return badRequest('name cannot be empty');
    }
    if (trimmed.length > MAX_NAME_LEN) {
      return badRequest(`name must be ${MAX_NAME_LEN} characters or fewer`);
    }
    patch.name = trimmed;
  }
  if (body.rank !== null && body.rank !== undefined) {
    if (typeof body.rank !== 'string') {
      return badRequest('rank must be a string');
    }
    const trimmed = body.rank.trim();
    if (trimmed.length > MAX_RANK_LEN) {
      return badRequest(`rank must be ${MAX_RANK_LEN} characters or fewer`);
    }
    patch.rank = trimmed;
  } else if (body.rank === null) {
    patch.rank = '';
  }

  if (Object.keys(patch).length === 0) {
    return badRequest('No fields to update');
  }

  try {
    const rows = await listRowsBySheet(spreadsheetId, 'users');
    const found = rows.find(
      (r) =>
        String((r as unknown as { email?: unknown }).email ?? '')
          .trim()
          .toLowerCase() === email,
    );
    if (!found) return unauthorized();
    const userId = String((found as unknown as { id?: unknown }).id ?? '').trim();
    if (!userId) return badRequest('User row is missing an id');

    // Make sure the sheet has the new columns before writing — older sheets
    // won't have them and `updateRowById` silently drops unknown keys.
    const { ensureSheetWithHeaders } = await import('@/app/lib/googleSheets');
    await ensureSheetWithHeaders(spreadsheetId, 'users', [...USERS_HEADERS]);

    await updateRowById(spreadsheetId, 'users', userId, patch);
    return NextResponse.json({ ok: true, user: { name: patch.name, rank: patch.rank } });
  } catch (error) {
    console.error('Error in PATCH /api/profile:', error);
    return serverError('Failed to update profile');
  }
}

