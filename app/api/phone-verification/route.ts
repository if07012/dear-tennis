// ============================================
// /api/phone-verification — WhatsApp OTP for profile phone
// ============================================
// POST   { phone }            → send a 6-digit code over WhatsApp (WAHA)
// PUT    { phone, code }      → verify; on success stamps users.waChatId
// Identified via x-auth-email (same pattern as /api/profile).

import { NextResponse } from 'next/server';
import { getSpreadsheetId } from '@/app/lib/supabase';
import { isAdminEmail } from '@/lib/activities-store';
import { createPhoneVerification, verifyPhoneCode, chatIdForPhone } from '@/lib/phone-verification-store';
import { sendWahaText } from '@/lib/waha-client';

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}
function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
function serverError(message: string) {
  return NextResponse.json({ error: message }, { status: 500 });
}

function getRequesterEmail(request: Request): string | null {
  const header = request.headers.get('x-auth-email');
  return header && header.trim().length > 0
    ? header.trim().toLowerCase()
    : null;
}

export async function POST(request: Request) {
  const email = getRequesterEmail(request);
  if (!email) return unauthorized();
  if (isAdminEmail(email)) {
    return NextResponse.json({ ok: true, skipped: true });
  }
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) return serverError('Supabase is not configured');

  let body: { phone?: string };
  try {
    body = (await request.json()) as { phone?: string };
  } catch {
    return badRequest('Invalid JSON');
  }
  const phone = String(body.phone ?? '').trim();
  if (!phone || !/^[+\d][\d\s-]{5,}$/.test(phone) || phone.length > 20) {
    return badRequest('phone must be a valid phone number');
  }

  const result = await createPhoneVerification(email, phone);
  if (!result.ok) return badRequest(result.error);

  const sent = await sendWahaText(
    chatIdForPhone(phone),
    `Kode verifikasi Dear Tennis kamu: ${result.code} (berlaku 10 menit). Jangan bagikan ke siapa pun. 🎾`,
  ).catch(() => false);
  if (!sent) {
    return serverError('Gagal mengirim kode WhatsApp. Pastikan nomor aktif dan coba lagi.');
  }
  return NextResponse.json({ ok: true });
}

export async function PUT(request: Request) {
  const email = getRequesterEmail(request);
  if (!email) return unauthorized();
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) return serverError('Supabase is not configured');

  let body: { phone?: string; code?: string };
  try {
    body = (await request.json()) as { phone?: string; code?: string };
  } catch {
    return badRequest('Invalid JSON');
  }
  const code = String(body.code ?? '').trim();
  if (!/^\d{6}$/.test(code)) return badRequest('Kode harus 6 digit');

  const result = await verifyPhoneCode(spreadsheetId, email, code);
  if (!result.ok) return badRequest(result.error);
  return NextResponse.json({ ok: true });
}
