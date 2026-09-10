import { NextResponse } from 'next/server';
import { createRowWithId, getSpreadsheetId, listRowsBySheet } from '@/app/lib/supabase';
import { hashPassword } from '@/lib/auth';

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
      console.error('Supabase is not configured');
      return NextResponse.json({ error: 'Server is not configured' }, { status: 500 });
    }

    // Reject duplicate emails.
    const rows = await listRowsBySheet(spreadsheetId, 'users');
    const existing = rows.find((r) => {
      return String(r.email ?? '').trim().toLowerCase() === email;
    });
    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
    }

    const { hash, salt } = await hashPassword(password);
    const id = crypto.randomUUID();
    await createRowWithId(spreadsheetId, 'users', {
      id,
      email,
      name,
      passwordHash: hash,
      salt,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      user: { id, email, name },
    });
  } catch (error) {
    console.error('Error in POST /api/auth/register:', error);
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 });
  }
}
