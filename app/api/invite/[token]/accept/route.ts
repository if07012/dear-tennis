// ============================================
// /api/invite/[token]/accept — public accept endpoint
// ============================================
//
// Body: { name, password }
// Creates the user row, marks the invite as accepted, and returns the new
// user object so the client can sign them in immediately via setAuthUser.

import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { ensureSheetWithHeaders, invalidateRowsCache, listRowsBySheet } from '@/app/lib/googleSheets';
import { hashPassword } from '@/lib/auth';
import {
  ensureInviteSheets,
  getInviteByToken,
  markInviteAccepted,
} from '@/lib/invite-store';

const USERS_HEADERS = ['id', 'email', 'name', 'passwordHash', 'salt', 'createdAt', 'role', 'photo', 'rank'];
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function conflict(message: string) {
  return NextResponse.json({ error: message }, { status: 409 });
}

function notFound() {
  return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
}

function gone(message: string) {
  return NextResponse.json({ error: message }, { status: 410 });
}

function serverError(message: string) {
  return NextResponse.json({ error: message }, { status: 500 });
}

function getSpreadsheetId(): string | null {
  return process.env.USERS_SPREADSHEET_ID || process.env.GOOGLE_SPREADSHEET_ID || null;
}

function getInviteSpreadsheetId(): string | null {
  const id = process.env.HERO_SPREADSHEET_ID?.trim();
  return id && id.length > 0 ? id : null;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!token || typeof token !== 'string' || token.trim().length < 8) {
    return badRequest('Invalid token');
  }

  const usersSheetId = getSpreadsheetId();
  if (!usersSheetId) return serverError('USERS_SPREADSHEET_ID is not set');
  const invitesSheetId = getInviteSpreadsheetId();
  if (!invitesSheetId) return serverError('HERO_SPREADSHEET_ID is not set');

  let body: { name?: string; password?: string };
  try {
    body = (await request.json()) as { name?: string; password?: string };
  } catch {
    return badRequest('Invalid JSON');
  }

  const name = String(body.name ?? '').trim();
  const password = String(body.password ?? '');
  if (!name) return badRequest('Nama wajib diisi');
  if (password.length < 6) {
    return badRequest('Password minimal 6 karakter');
  }

  try {
    await ensureInviteSheets(invitesSheetId);
    const invite = await getInviteByToken(invitesSheetId, token);
    if (!invite) return notFound();
    if (invite.status === 'cancelled') {
      return gone('Undangan ini sudah dibatalkan');
    }
    if (invite.status === 'accepted') {
      return conflict('Undangan ini sudah dipakai');
    }
    if (invite.email && !emailRegex.test(invite.email)) {
      // Defensive — should never happen because the admin route validates.
      return badRequest('Invitation email is invalid');
    }

    const sheet = await ensureSheetWithHeaders(
      usersSheetId,
      'users',
      USERS_HEADERS,
    );
    const rows = await listRowsBySheet(usersSheetId, 'users');
    const lowerEmail = invite.email.toLowerCase();
    const duplicate = rows.find((r) => {
      const obj = r as unknown as { email?: unknown };
      return String(obj.email ?? '').trim().toLowerCase() === lowerEmail;
    });
    if (duplicate) {
      // Email already registered. Mark invite accepted so the admin list
      // doesn't keep showing it as pending, and surface a clear error.
      try {
        await markInviteAccepted(invitesSheetId, invite.id);
      } catch {
        // ignore — best-effort cleanup
      }
      return conflict('Email sudah terdaftar. Silakan login.');
    }

    const { hash, salt } = await hashPassword(password);
    const id = crypto.randomUUID();
    await sheet.addRow({
      id,
      email: invite.email,
      name,
      passwordHash: hash,
      salt,
      createdAt: new Date().toISOString(),
    });
    invalidateRowsCache(usersSheetId, 'users');
    try {
      await markInviteAccepted(invitesSheetId, invite.id);
    } catch (acceptErr) {
      console.error(
        '[invite] Failed to mark invite as accepted:',
        acceptErr,
      );
      // The user row already exists; we deliberately don't roll back so the
      // user can still log in. The invite row will stay pending until the
      // admin cleans it up.
    }

    return NextResponse.json({
      success: true,
      user: { id, email: invite.email, name },
    });
  } catch (error) {
    console.error('Error in POST /api/invite/[token]/accept:', error);
    return serverError('Failed to accept invitation');
  }
}
