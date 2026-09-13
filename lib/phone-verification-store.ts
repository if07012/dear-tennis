// ============================================
// PHONE OTP VERIFICATION STORE
// ============================================
// Backs the profile-page phone verification flow. A member requests a code
// (sent over WhatsApp via WAHA), then submits it; on success the canonical
// WhatsApp chat id is stamped onto the users row (users.waChatId) so the
// bot matches members by exact chat id — phone-format comparison caused
// false negatives (e.g. "+62 812-…" stored vs "62812…" chat).
//
// Codes are 6 digits, valid 10 minutes, max 5 wrong attempts per row.

import {
  getSpreadsheetId,
  listRowsBySheet,
  createRowWithId,
  readRowById,
  updateRowById,
  deleteRowById,
} from '@/app/lib/supabase';

const VERIFICATIONS_SHEET = 'phone_verifications';
const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

/** Digits only; leading "0…" → "62…" (Indonesian local → country code). */
export function normalisePhoneDigits(raw: string): string {
  let p = raw.replace(/\D/g, '');
  if (p.startsWith('0')) p = `62${p.slice(1)}`;
  return p;
}

/** Canonical chat id for a normalised phone: "62812…" → "62812…@c.us". */
export function chatIdForPhone(raw: string): string {
  return `${normalisePhoneDigits(raw)}@c.us`;
}

export type RequestCodeResult =
  | { ok: true }
  | { ok: false; error: string };

/** Create (or replace) the pending code row for a user and return the code. */
export async function createPhoneVerification(
  userEmail: string,
  phone: string,
): Promise<RequestCodeResult & { code?: string }> {
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) return { ok: false, error: 'Server belum terkonfigurasi' };
  const email = userEmail.trim().toLowerCase();
  const digits = normalisePhoneDigits(phone);
  if (!digits) return { ok: false, error: 'Nomor telepon tidak valid' };

  // Replace any previous pending row for this user (id = email keeps one
  // pending verification per user; updateRowById touches nothing if absent).
  const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, '0');
  const row = {
    id: email,
    userEmail:email,
    phone: digits,
    waChatId: `${digits}@c.us`,
    code,
    attempts: 0,
    expiresAt: new Date(Date.now() + CODE_TTL_MS).toISOString(),
    createdAt: new Date().toISOString(),
  };
  // createRowWithId would throw on a duplicate id; upsert by update-first.
  const existing = await readRowById(spreadsheetId, VERIFICATIONS_SHEET, email);
  if (existing) {
    await updateRowById(spreadsheetId, VERIFICATIONS_SHEET, email, row);
  } else {
    await createRowWithId(spreadsheetId, VERIFICATIONS_SHEET, row);
  }
  return { ok: true, code };
}

export type VerifyResult =
  | { ok: true }
  | { ok: false; error: string; expired?: boolean };

/**
 * Check a submitted code. On success: clear users.phone's raw format is kept,
 * but users.waChatId is stamped with the canonical chat id so the bot
 * resolves the member exactly. The pending row is deleted either way on
 * success; on mismatch the attempt counter increments (row deleted at
 * MAX_ATTEMPTS).
 */
export async function verifyPhoneCode(
  spreadsheetId: string,
  userEmail: string,
  submitted: string,
): Promise<VerifyResult> {
  const email = userEmail.trim().toLowerCase();
  const row = await readRowById(spreadsheetId, VERIFICATIONS_SHEET, email);
  if (!row) return { ok: false, error: 'Tidak ada kode verifikasi. Minta kode baru.' };

  const attempts = Number(row.attempts ?? 0);
  if (attempts >= MAX_ATTEMPTS) {
    return { ok: false, error: 'Terlalu banyak percobaan. Minta kode baru.' };
  }
  if (Date.now() > Date.parse(String(row.expiresAt ?? ''))) {
    return { ok: false, error: 'Kode kedaluwarsa. Minta kode baru.', expired: true };
  }
  if (String(row.code ?? '') !== submitted.trim()) {
    await updateRowById(spreadsheetId, VERIFICATIONS_SHEET, email, {
      attempts: attempts + 1,
    });
    const left = MAX_ATTEMPTS - attempts - 1;
    return {
      ok: false,
      error: left > 0 ? `Kode salah. Sisa percobaan: ${left}.` : 'Kode salah. Minta kode baru.',
    };
  }

  // Stamp the verified chat id onto the users row.
  const users = await listRowsBySheet(spreadsheetId, 'users');
  const me = users.find(
    (r) => String(r.email ?? '').trim().toLowerCase() === email,
  );
  const userId = String(me?.id ?? '').trim();
  if (!userId) return { ok: false, error: 'User tidak ditemukan' };
  await updateRowById(spreadsheetId, 'users', userId, {
    waChatId: String(row.waChatId ?? ''),
  });
  await deleteRowById(spreadsheetId, VERIFICATIONS_SHEET, email);
  return { ok: true };
}
