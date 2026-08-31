import { NextResponse } from 'next/server';
import { ensureSheetWithHeaders, invalidateRowsCache } from '@/app/lib/googleSheets';
import { hashPassword } from '@/lib/auth';

const USERS_HEADERS = ['id', 'email', 'name', 'passwordHash', 'salt', 'createdAt'];

function getSpreadsheetId(): string | null {
  return process.env.USERS_SPREADSHEET_ID || process.env.GOOGLE_SPREADSHEET_ID || null;
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = String(body.email ?? '').trim().toLowerCase();
    const name = String(body.name ?? '').trim();
    const password = String(body.password ?? '');

    if (!email || !name || !password) {
      return NextResponse.json(
        { error: 'email, name, and password are required' },
        { status: 400 }
      );
    }
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    const spreadsheetId = getSpreadsheetId();
    if (!spreadsheetId) {
      console.error('USERS_SPREADSHEET_ID is not set');
      return NextResponse.json({ error: 'Server is not configured' }, { status: 500 });
    }

    const sheet = await ensureSheetWithHeaders(spreadsheetId, 'users', USERS_HEADERS);

    // Reject duplicate emails.
    const rows = await sheet.getRows();
    const existing = rows.find((r) => {
      const obj = r.toObject();
      return String(obj.email ?? '').trim().toLowerCase() === email;
    });
    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
    }

    const { hash, salt } = await hashPassword(password);
    const id = crypto.randomUUID();
    await sheet.addRow({
      id,
      email,
      name,
      passwordHash: hash,
      salt,
      createdAt: new Date().toISOString(),
    });
    invalidateRowsCache(spreadsheetId, 'users');

    return NextResponse.json({
      success: true,
      user: { id, email, name },
    });
  } catch (error) {
    console.error('Error in POST /api/auth/register:', error);
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 });
  }
}
