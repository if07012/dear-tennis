// ============================================
// APPROVAL TOKENS — one-click admin decision links
// ============================================
// Stateless HMAC tokens for /approval/[token]: signupId + decision kind +
// issuedAt, signed with ADMIN_APPROVAL_SECRET. No DB rows, no expiry table —
// the admin PATCH endpoint's own status guard (decideSignup/decidePayment
// reject rows in the wrong status) is the replay protection: a token for an
// already-decided signup simply fails with "bukan pending_approval".

import { createHmac, timingSafeEqual } from 'crypto';

export type ApprovalKind = 'approve' | 'reject' | 'approve-payment' | 'reject-payment';

export function isApprovalKind(v: string): v is ApprovalKind {
  return v === 'approve' || v === 'reject' || v === 'approve-payment' || v === 'reject-payment';
}

function secret(): string | null {
  const s = process.env.ADMIN_APPROVAL_SECRET?.trim();
  return s ? s : null;
}

/** `signupId.kind.issuedAt.sig` (base64url signature). */
export function signApprovalToken(signupId: string, kind: ApprovalKind): string | null {
  const s = secret();
  if (!s) return null;
  const payload = `${signupId}.${kind}.${Date.now()}`;
  const sig = createHmac('sha256', s).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyApprovalToken(
  token: string,
): { signupId: string; kind: ApprovalKind } | null {
  const s = secret();
  if (!s) return null;
  const parts = token.split('.');
  if (parts.length !== 4) return null;
  const [signupId, kind, issuedAt, sig] = parts;
  if (!signupId || !isApprovalKind(kind) || !/^\d+$/.test(issuedAt)) return null;
  const expected = createHmac('sha256', s).update(`${signupId}.${kind}.${issuedAt}`).digest();
  let given: Buffer;
  try {
    given = Buffer.from(sig, 'base64url');
  } catch {
    return null;
  }
  if (given.length !== expected.length) return null;
  if (!timingSafeEqual(given, expected)) return null;
  return { signupId, kind };
}

export function approvalLink(signupId: string, kind: ApprovalKind): string | null {
  const token = signApprovalToken(signupId, kind);
  if (!token) return null;
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, '') || 'http://localhost:3000';
  return `${siteUrl}/approval/${token}`;
}
