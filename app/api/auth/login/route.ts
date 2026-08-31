import { NextResponse } from 'next/server';
import { getGoogleSheet } from '@/app/lib/googleSheets';
import { verifyPassword } from '@/lib/auth';
import { ensureAdminUser } from '@/lib/seedAdmin';

// Simple per-process rate limit. Good enough for a demo; for production,
// use a shared store (Redis, Upstash) so limits span processes.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;
const attempts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || now > entry.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  entry.count += 1;
  return entry.count <= RATE_LIMIT_MAX;
}

function getSpreadsheetId(): string | null {
  return process.env.USERS_SPREADSHEET_ID || process.env.GOOGLE_SPREADSHEET_ID || null;
}

export async function POST(request: Request) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';

  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const email = String(body.email ?? '').trim().toLowerCase();
    const password = String(body.password ?? '');

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const spreadsheetId = getSpreadsheetId();
    if (!spreadsheetId) {
      console.error('USERS_SPREADSHEET_ID is not set');
      return NextResponse.json({ error: 'Server is not configured' }, { status: 500 });
    }

    // Bypass the read cache for auth — a freshly registered user must be
    // accepted immediately, not after the cache TTL.
    const doc = await getGoogleSheet(spreadsheetId);

    // Self-heal: if the request is for the configured admin email and the
    // user doesn't exist yet, seed it now. Cheap when already present.
    const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    if (adminEmail && email === adminEmail) {
      try {
        await ensureAdminUser(spreadsheetId);
      } catch (seedErr) {
        console.error('Failed to seed admin user:', seedErr);
        // fall through — the user lookup below will surface "Invalid credentials"
      }
    }

    const sheet = doc.sheetsByTitle['users'];
    if (!sheet) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }
    const rows = await sheet.getRows();
    const user = rows.find((r) => {
      const obj = r.toObject();
      return String(obj.email ?? '').trim().toLowerCase() === email;
    });

    // Always run a hash comparison to keep timing roughly constant and
    // avoid leaking whether a user exists.
    const obj = user ? user.toObject() : null;
    const ok = await verifyPassword(
      password,
      String(obj?.passwordHash ?? ''),
      String(obj?.salt ?? '')
    );
    console.log('obj', obj);
    console.log('ok', ok);
    console.log('password', password);
    console.log('passwordHash', obj?.passwordHash);
    console.log('salt', obj?.salt);
    if (!obj || !ok) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      user: {
        id: obj.id,
        email: obj.email,
        name: obj.name,
        photo: obj.photo ? String(obj.photo) : undefined,
      },
    });
  } catch (error) {
    console.error('Error in POST /api/auth/login:', error);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
