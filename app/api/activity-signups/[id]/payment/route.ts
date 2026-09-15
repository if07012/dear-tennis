// ============================================
// /api/activity-signups/[id]/payment — member payment proof upload
// ============================================
//
// POST { proofUrl, note? } → attach payment proof to the signup and move
// status waiting_payment → payment_submitted (PRD §9).
//
// proofUrl is a URL or data URL (image or small PDF). Formats and the size
// limit are validated here; the client shows the same constraints.
//
// Auth: x-auth-email must match the signup row's userEmail.

import { NextResponse } from 'next/server';
import { getSpreadsheetId } from '@/app/lib/supabase';
import { submitPaymentProof } from '@/lib/activity-signups-store';
import { notifyPaymentSubmitted } from '@/lib/whatsapp-bot';

const MAX_PROOF_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED_MIME = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];

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
  return header && header.trim().length > 0 ? header.trim().toLowerCase() : null;
}

/** Validate a URL or data URL; data URLs are size+mime checked. */
function validateProofUrl(raw: string): string | null {
  const url = raw.trim();
  if (!url) return null;
  if (url.startsWith('data:')) {
    const match = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(url);
    if (!match) return null;
    const mime = match[1].toLowerCase();
    if (!ALLOWED_MIME.includes(mime)) return null;
    const payload = match[3];
    const bytes = match[2]
      ? Math.ceil((payload.length * 3) / 4)
      : payload.length;
    if (bytes > MAX_PROOF_BYTES) return null;
    return url;
  }
  if (/^https?:\/\//i.test(url)) return url;
  return null;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const email = getRequesterEmail(request);
  if (!email) return unauthorized();

  const { id } = await params;
  if (!id || typeof id !== 'string') return badRequest('id is required');

  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) return serverError('Supabase is not configured');

  let body: { proofUrl?: string; note?: string };
  try {
    body = (await request.json()) as { proofUrl?: string; note?: string };
  } catch {
    return badRequest('Invalid JSON');
  }

  const proofUrl = validateProofUrl(String(body.proofUrl ?? ''));
  if (!proofUrl) {
    return badRequest(
      'Bukti pembayaran harus URL valid atau gambar/PDF (JPG, PNG, PDF, maks 2MB)',
    );
  }
  const note = body.note ? String(body.note).trim().slice(0, 500) || undefined : undefined;

  try {
    const { signup, error } = await submitPaymentProof(
      spreadsheetId,
      id,
      email,
      proofUrl,
      note,
    );
    if (!signup) {
      return error ? badRequest(error) : badRequest('Pendaftaran tidak ditemukan');
    }
    // Fire-and-forget: tell the admin over WhatsApp, proof image attached.
    void notifyPaymentSubmitted(email, signup.activityId, proofUrl, note, signup.id);
    return NextResponse.json({ ok: true, signup });
  } catch (error) {
    console.error('Error in POST /api/activity-signups/[id]/payment:', error);
    return serverError('Failed to submit payment proof');
  }
}
