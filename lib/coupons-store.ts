// ============================================
// COUPONS DATA STORE
// ============================================
// Admin CRUD for discount codes + per-user claim records, on Supabase
// via the same row helpers the other stores use.

import {
  createRowWithId,
  deleteRowById,
  getSpreadsheetId,
  listRowsBySheet,
  readRowById,
  updateRowById,
} from '@/app/lib/supabase';
import type { Coupon, CouponClaim } from '@/data/coupons-types';

const COUPONS_SHEET = 'coupons';
const CLAIMS_SHEET = 'coupon_claims';

function isAdminEmail(email: string | null | undefined): boolean {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!adminEmail || !email) return false;
  return email.trim().toLowerCase() === adminEmail;
}

function toBool(raw: unknown) {
  return raw === true || raw === 'TRUE' || raw === 'true' || raw === 1 || raw === '1';
}

function clampPct(raw: unknown): number {
  const n = Math.round(Number(raw));
  return Number.isFinite(n) ? Math.min(100, Math.max(1, n)) : 0;
}

function coerceCoupon(r: Record<string, unknown>, idx: number): Coupon {
  return {
    id: String(r.id ?? '').trim() || `fallback-${idx}`,
    code: String(r.code ?? '').trim(),
    discountPct: clampPct(r.discountPct),
    activityId: String(r.activityId ?? '').trim(),
    userEmail: String(r.userEmail ?? '').trim().toLowerCase(),
    active: toBool(r.active),
    expiresAt: String(r.expiresAt ?? '').trim(),
    createdAt: String(r.createdAt ?? ''),
  };
}

function coerceClaim(r: Record<string, unknown>, idx: number): CouponClaim {
  return {
    id: String(r.id ?? '').trim() || `fallback-${idx}`,
    couponId: String(r.couponId ?? '').trim(),
    code: String(r.code ?? '').trim(),
    userEmail: String(r.userEmail ?? '').trim().toLowerCase(),
    activityId: String(r.activityId ?? '').trim(),
    discountPct: clampPct(r.discountPct),
    claimedAt: String(r.claimedAt ?? ''),
  };
}

async function requireDb(): Promise<string> {
  const id = getSpreadsheetId();
  if (!id) throw new Error('Supabase is not configured');
  return id;
}

export async function listCoupons(): Promise<Coupon[]> {
  const db = await requireDb();
  const rows = await listRowsBySheet(db, COUPONS_SHEET);
  return rows
    .map((r, idx) => coerceCoupon(r, idx))
    .filter((c) => c.code.length > 0)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listClaims(): Promise<CouponClaim[]> {
  const db = await requireDb();
  const rows = await listRowsBySheet(db, CLAIMS_SHEET);
  return rows
    .map((r, idx) => coerceClaim(r, idx))
    .filter((c) => c.code.length > 0)
    .sort((a, b) => b.claimedAt.localeCompare(a.claimedAt));
}

export type UpsertCouponInput = {
  id?: string;
  code: string;
  discountPct: number;
  activityId: string;
  userEmail?: string; // '' = anyone; otherwise only this member can claim
  active: boolean;
  expiresAt?: string; // ISO date; '' or undefined = never expires
};

// '' = never; otherwise the coupon stays claimable through the end of the
// expiry day (parsed as UTC midnight, so add a full day).
function isExpired(coupon: { expiresAt: string }): boolean {
  if (!coupon.expiresAt) return false;
  return new Date(coupon.expiresAt).getTime() + 24 * 60 * 60 * 1000 <= Date.now();
}

export async function upsertCoupon(input: UpsertCouponInput): Promise<Coupon> {
  const db = await requireDb();
  const code = input.code.trim().toUpperCase();
  if (!code) throw new Error('code is required');
  const pct = clampPct(input.discountPct);
  if (pct < 1) throw new Error('discountPct must be 1–100');
  const expiresAt = (input.expiresAt ?? '').trim();
  if (expiresAt && Number.isNaN(new Date(expiresAt).getTime())) {
    throw new Error('expiresAt harus tanggal valid');
  }
  const clean = {
    code,
    discountPct: pct,
    activityId: input.activityId.trim(),
    userEmail: (input.userEmail ?? '').trim().toLowerCase(),
    active: input.active === true,
    expiresAt,
    createdAt: new Date().toISOString(),
  };

  if (input.id && !input.id.startsWith('draft-')) {
    const existing = await readRowById(db, COUPONS_SHEET, input.id);
    if (!existing) throw new Error('Coupon not found');
    // Unique code check: another coupon already using this code?
    const all = await listCoupons();
    if (all.some((c) => c.id !== input.id && c.code === code)) {
      throw new Error(`Code ${code} already used by another coupon`);
    }
    const merged = { ...clean, createdAt: String(existing.createdAt ?? clean.createdAt) };
    await updateRowById(db, COUPONS_SHEET, input.id, merged);
    return { id: input.id, ...merged };
  }

  const all = await listCoupons();
  if (all.some((c) => c.code === code)) {
    throw new Error(`Code ${code} already exists`);
  }
  const newId = crypto.randomUUID();
  await createRowWithId(db, COUPONS_SHEET, { id: newId, ...clean });
  return { id: newId, ...clean };
}

export async function deleteCoupon(id: string): Promise<void> {
  const db = await requireDb();
  await deleteRowById(db, COUPONS_SHEET, id);
}

/**
 * Coupons a given member may still claim for a given activity (PRD §6):
 * active, unexpired, matching the activity (or activity-agnostic),
 * assigned to them (or unassigned), and not already claimed by them.
 * Used by the Join dialog to list choices before creating the registration.
 */
export async function listEligibleCoupons(
  userEmail: string,
  activityId: string,
): Promise<Coupon[]> {
  const email = userEmail.trim().toLowerCase();
  if (!email) return [];
  const [coupons, claims] = await Promise.all([listCoupons(), listClaims()]);
  const claimedCouponIds = new Set(
    claims.filter((cl) => cl.userEmail === email).map((cl) => cl.couponId),
  );
  return coupons.filter(
    (c) =>
      c.active &&
      !isExpired(c) &&
      !claimedCouponIds.has(c.id) &&
      (!c.activityId || c.activityId === activityId) &&
      (!c.userEmail || c.userEmail === email),
  );
}

// A member claims a code for a given activity. Records the discount they
// got (snapshot) so later coupon edits don't rewrite history. Returns the
// claimed coupon; throws with a user-facing message on any mismatch.
export async function claimCoupon(
  code: string,
  userEmail: string,
  activityId: string,
): Promise<CouponClaim> {
  const db = await requireDb();
  const normalized = code.trim().toUpperCase();
  const email = userEmail.trim().toLowerCase();
  if (!normalized) throw new Error('Kode kupon kosong');
  if (!email) throw new Error('Not logged in');

  const coupons = await listCoupons();
  const coupon = coupons.find((c) => c.code === normalized);
  if (!coupon) throw new Error('Kode kupon tidak ditemukan');
  if (!coupon.active) throw new Error('Kupon sudah tidak aktif');
  if (isExpired(coupon)) throw new Error('Kupon sudah kadaluarsa');
  if (coupon.activityId && coupon.activityId !== activityId) {
    throw new Error('Kupon ini bukan untuk activity tersebut');
  }
  if (coupon.userEmail && coupon.userEmail !== email) {
    throw new Error('Kupon ini bukan untuk akun kamu');
  }

  const claims = await listClaims();
  if (claims.some((cl) => cl.couponId === coupon.id && cl.userEmail === email)) {
    throw new Error('Kamu sudah klaim kupon ini');
  }

  const claim: CouponClaim = {
    id: crypto.randomUUID(),
    couponId: coupon.id,
    code: coupon.code,
    userEmail: email,
    activityId,
    discountPct: coupon.discountPct,
    claimedAt: new Date().toISOString(),
  };
  await createRowWithId(db, CLAIMS_SHEET, { ...claim });
  return claim;
}

export { isAdminEmail, isExpired, COUPONS_SHEET, CLAIMS_SHEET };
