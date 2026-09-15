// ============================================
// ACTIVITY SIGNUPS STORE
// ============================================
// Reads/writes activity_signups rows from Supabase (single data layer — see
// app/lib/supabase.ts).
//
// Registration flow (activity-registration-payment-coupon-prd.md):
//   pending_approval → waiting_payment (admin approve; slot reserved)
//   waiting_payment → payment_submitted (member uploads proof)
//   payment_submitted → joined (admin approves payment) | waiting_payment
//   (admin rejects payment, reason recorded). waiting_payment rows whose
//   expiresAt deadline passes flip to expired (slot released).
//
// Caching: this sheet is read by the public home page on every render so we
// follow the activities/gallery pattern and cache the per-user lookup for a
// few seconds. Admin reads bypass the cache because they need to see fresh
// approvals the moment they're applied.

import {
  ensureSheetWithHeaders,
  getSpreadsheetId,
  listRowsBySheet,
  readRowById,
  updateRowById,
  deleteRowById,
  createRowWithId,
} from '@/app/lib/supabase';
import {
  SIGNUP_HEADERS,
  SLOT_OCCUPYING_STATUSES,
  ACTIVE_STATUSES,
  isSignupStatus,
  coerceLegacyStatus,
  parsePriceToAmount,
  type ActivitySignup,
  type SignupStatus,
} from '@/data/activity-signups-types';

const SHEET = 'activity_signups';

/** Hours after approval before a waiting_payment slot is released. PRD §13. */
const DEFAULT_PAYMENT_DEADLINE_HOURS = 24;

const SIGNUP_CACHE_TTL_MS = 10 * 1000;

type CacheEntry = { expiresAt: number; value: ActivitySignup[] };

function getCacheStore() {
  const g = globalThis as unknown as {
    __activity_signups_cache__?: Map<string, CacheEntry>;
  };
  if (!g.__activity_signups_cache__) {
    g.__activity_signups_cache__ = new Map();
  }
  return g.__activity_signups_cache__;
}

function cacheGet(key: string): ActivitySignup[] | null {
  const hit = getCacheStore().get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    getCacheStore().delete(key);
    return null;
  }
  return hit.value;
}

function cacheSet(key: string, value: ActivitySignup[]) {
  getCacheStore().set(key, {
    expiresAt: Date.now() + SIGNUP_CACHE_TTL_MS,
    value,
  });
}

function cacheClear() {
  getCacheStore().clear();
}

function coerceStatus(value: unknown): SignupStatus {
  const raw = String(value ?? '').trim();
  if (isSignupStatus(raw)) return raw;
  // Rows written before the payment flow used pending/approved/rejected.
  return coerceLegacyStatus(raw) ?? 'pending_approval';
}

function coerceAmount(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
}

function coerceRow(r: Record<string, unknown>, idx: number): ActivitySignup {
  return {
    id: String(r.id ?? '').trim() || `fallback-${idx}`,
    activityId: String(r.activityId ?? '').trim(),
    userEmail: String(r.userEmail ?? '').trim().toLowerCase(),
    userName: String(r.userName ?? '').trim(),
    status: coerceStatus(r.status),
    message: r.message ? String(r.message) : undefined,
    requestedAt: String(r.requestedAt ?? ''),
    decidedAt: r.decidedAt ? String(r.decidedAt) : undefined,
    decidedBy: r.decidedBy ? String(r.decidedBy) : undefined,
    couponCode: String(r.couponCode ?? '').trim(),
    discountPct: coerceAmount(r.discountPct),
    originalAmount: coerceAmount(r.originalAmount),
    finalAmount: coerceAmount(r.finalAmount),
    paymentProofUrl: r.paymentProofUrl ? String(r.paymentProofUrl) : undefined,
    paymentNote: r.paymentNote ? String(r.paymentNote) : undefined,
    uploadedAt: r.uploadedAt ? String(r.uploadedAt) : undefined,
    paymentReviewedAt: r.paymentReviewedAt ? String(r.paymentReviewedAt) : undefined,
    paymentReviewedBy: r.paymentReviewedBy ? String(r.paymentReviewedBy) : undefined,
    rejectionReason: r.rejectionReason ? String(r.rejectionReason) : undefined,
    joinedAt: r.joinedAt ? String(r.joinedAt) : undefined,
    expiresAt: r.expiresAt ? String(r.expiresAt) : undefined,
    cancelReason: r.cancelReason ? String(r.cancelReason) : undefined,
  };
}

async function fetchAllRows(spreadsheetId: string): Promise<ActivitySignup[]> {
  const rows = await listRowsBySheet(spreadsheetId, SHEET);
  return rows
    .filter((r) => String(r.userEmail ?? '').trim().length > 0)
    .map((r, idx) => coerceRow(r, idx))
    .sort((a, b) => {
      const aTime = Date.parse(a.requestedAt) || 0;
      const bTime = Date.parse(b.requestedAt) || 0;
      return bTime - aTime;
    });
}

export async function ensureSignupsSheet(spreadsheetId: string) {
  return ensureSheetWithHeaders(spreadsheetId, SHEET, [...SIGNUP_HEADERS]);
}

/**
 * Find an existing signup row for (userEmail, activityId). Returns the row
 * including its id so the caller can update or read status.
 */
export async function findSignup(
  spreadsheetId: string,
  activityId: string,
  userEmail: string,
): Promise<ActivitySignup | null> {
  const lower = userEmail.trim().toLowerCase();
  const cacheKey = `all:${spreadsheetId}`;
  const cached = cacheGet(cacheKey);
  if (cached) {
    return (
      cached.find(
        (s) => s.activityId === activityId && s.userEmail === lower,
      ) ?? null
    );
  }
  const rows = await fetchAllRows(spreadsheetId);
  cacheSet(cacheKey, rows);
  return (
    rows.find((s) => s.activityId === activityId && s.userEmail === lower) ??
    null
  );
}

export type SignupRequestInput = {
  activityId: string;
  userEmail: string;
  userName: string;
  message?: string;
  /** Coupon code claimed at join time; validated by the caller (API route). */
  couponCode?: string;
  /** Discount % snapshot from the claimed coupon. */
  discountPct?: number;
  originalAmount: number;
  finalAmount: number;
};

export async function requestSignup(
  spreadsheetId: string,
  input: SignupRequestInput,
): Promise<{ signup: ActivitySignup; created: boolean }> {
  await ensureSignupsSheet(spreadsheetId);
  const existing = await findSignup(
    spreadsheetId,
    input.activityId,
    input.userEmail,
  );
  if (existing) {
    // A previously rejected signup is treated as a fresh re-submission:
    // flip the status back to pending, clear the prior decision metadata,
    // and bump requestedAt so the admin queue + sort order pick it up. The
    // row id stays the same so we don't end up with duplicate signups.
    if (existing.status === 'rejected' || existing.status === 'cancelled' || existing.status === 'expired') {
      const requestedAt = new Date().toISOString();
      await updateRowById(spreadsheetId, SHEET, existing.id, {
        status: 'pending_approval',
        requestedAt,
        decidedAt: '',
        decidedBy: '',
        userName: input.userName,
        message: input.message ?? '',
        couponCode: input.couponCode ?? '',
        discountPct: input.discountPct ?? 0,
        originalAmount: input.originalAmount,
        finalAmount: input.finalAmount,
        paymentProofUrl: '',
        paymentNote: '',
        uploadedAt: '',
        paymentReviewedAt: '',
        paymentReviewedBy: '',
        rejectionReason: '',
        joinedAt: '',
        expiresAt: '',
      });
      cacheClear();
      const refreshed = await findSignup(
        spreadsheetId,
        input.activityId,
        input.userEmail,
      );
      return {
        signup:
          refreshed ??
          {
            ...existing,
            status: 'pending_approval',
            requestedAt,
            decidedAt: undefined,
            decidedBy: undefined,
            userName: input.userName,
            message: input.message,
            couponCode: input.couponCode ?? '',
            discountPct: input.discountPct ?? 0,
            originalAmount: input.originalAmount,
            finalAmount: input.finalAmount,
          },
        created: false,
      };
    }
    // Refresh userName/message in case the user edited their profile.
    if (
      existing.userName !== input.userName ||
      (input.message ?? '') !== (existing.message ?? '')
    ) {
      await updateRowById(spreadsheetId, SHEET, existing.id, {
        userName: input.userName,
        message: input.message ?? '',
      });
      cacheClear();
      const refreshed = await findSignup(
        spreadsheetId,
        input.activityId,
        input.userEmail,
      );
      return {
        signup: refreshed ?? { ...existing, userName: input.userName, message: input.message },
        created: false,
      };
    }
    return { signup: existing, created: false };
  }

  const id = crypto.randomUUID();
  const row: ActivitySignup = {
    id,
    activityId: input.activityId,
    userEmail: input.userEmail.trim().toLowerCase(),
    userName: input.userName,
    status: 'pending_approval',
    message: input.message,
    requestedAt: new Date().toISOString(),
    couponCode: input.couponCode ?? '',
    discountPct: input.discountPct ?? 0,
    originalAmount: input.originalAmount,
    finalAmount: input.finalAmount,
  };
  await createRowWithId(spreadsheetId, SHEET, { ...row });
  cacheClear();
  return { signup: row, created: true };
}

/**
 * Admin decision on a registration (PRD §7). approve → waiting_payment with
 * the slot immediately reserved (checked against capacity) and the payment
 * deadline stamped; reject → slot released. For activities that don't
 * require payment, approve goes straight to joined.
 */
export async function decideSignup(
  spreadsheetId: string,
  id: string,
  decision: 'approve' | 'reject',
  decidedBy: string,
  options?: { capacity?: number; paymentRequired?: boolean; deadlineHours?: number },
): Promise<{ signup: ActivitySignup | null; error?: string }> {
  await ensureSignupsSheet(spreadsheetId);
  const row = await readRowById(spreadsheetId, SHEET, id);
  if (!row) return { signup: null };
  const current = coerceRow(row, 0);
  if (current.status !== 'pending_approval') {
    return { signup: null, error: `Status saat ini ${current.status}, bukan pending_approval` };
  }

  const now = new Date().toISOString();
  const decided = { status: '', decidedAt: now, decidedBy };

  if (decision === 'reject') {
    await updateRowById(spreadsheetId, SHEET, id, {
      ...decided,
      status: 'rejected',
    });
  } else {
    // PRD Rule 1/6: waiting_payment + payment_submitted + joined occupy slots.
    if (options?.capacity !== undefined && options.capacity > 0) {
      const all = await fetchAllRows(spreadsheetId);
      const occupied = all.filter(
        (s) =>
          s.activityId === current.activityId &&
          SLOT_OCCUPYING_STATUSES.includes(s.status),
      ).length;
      if (occupied >= options.capacity) {
        return { signup: null, error: 'Slot activity sudah penuh' };
      }
    }
    if (options?.paymentRequired === false) {
      // Free/no-payment activity: approval completes the registration.
      await updateRowById(spreadsheetId, SHEET, id, {
        ...decided,
        status: 'joined',
        joinedAt: now,
      });
    } else {
      const hours =
        options?.deadlineHours && options.deadlineHours > 0
          ? options.deadlineHours
          : DEFAULT_PAYMENT_DEADLINE_HOURS;
      const expiresAt = new Date(
        Date.now() + hours * 60 * 60 * 1000,
      ).toISOString();
      await updateRowById(spreadsheetId, SHEET, id, {
        ...decided,
        status: 'waiting_payment',
        expiresAt,
      });
    }
  }

  cacheClear();
  const updated = await readRowById(spreadsheetId, SHEET, id);
  if (!updated) return { signup: null };
  return { signup: coerceRow(updated, 0) };
}

/**
 * Member uploads payment proof (PRD §9). Only valid from waiting_payment —
 * including rows an admin bounced back after rejecting a proof.
 */
export async function submitPaymentProof(
  spreadsheetId: string,
  id: string,
  userEmail: string,
  proofUrl: string,
  note?: string,
): Promise<{ signup: ActivitySignup | null; error?: string }> {
  await ensureSignupsSheet(spreadsheetId);
  const row = await readRowById(spreadsheetId, SHEET, id);
  if (!row) return { signup: null, error: 'Pendaftaran tidak ditemukan' };
  const current = coerceRow(row, 0);
  if (current.userEmail !== userEmail.trim().toLowerCase()) {
    return { signup: null, error: 'Bukan pendaftaran kamu' };
  }
  // Guard against double submission while a proof is under review (PRD §9).
  if (current.status !== 'waiting_payment') {
    return {
      signup: null,
      error: `Bukti pembayaran hanya bisa diunggah saat status waiting_payment (saat ini: ${current.status})`,
    };
  }

  const now = new Date().toISOString();
  await updateRowById(spreadsheetId, SHEET, id, {
    status: 'payment_submitted',
    paymentProofUrl: proofUrl,
    paymentNote: note ?? '',
    uploadedAt: now,
    rejectionReason: '',
  });
  cacheClear();
  const updated = await readRowById(spreadsheetId, SHEET, id);
  return { signup: updated ? coerceRow(updated, 0) : null };
}

/**
 * Admin verifies a submitted payment (PRD §10–12). approve → joined (coupon
 * consumed); reject → back to waiting_payment with the reason shown to the
 * member, the slot staying reserved so they can upload a corrected proof.
 */
export async function decidePayment(
  spreadsheetId: string,
  id: string,
  decision: 'approve' | 'reject',
  reviewedBy: string,
  rejectionReason?: string,
): Promise<{ signup: ActivitySignup | null; error?: string }> {
  await ensureSignupsSheet(spreadsheetId);
  const row = await readRowById(spreadsheetId, SHEET, id);
  if (!row) return { signup: null, error: 'Pendaftaran tidak ditemukan' };
  const current = coerceRow(row, 0);
  if (current.status !== 'payment_submitted') {
    return {
      signup: null,
      error: `Pembayaran hanya bisa diverifikasi saat status payment_submitted (saat ini: ${current.status})`,
    };
  }

  const now = new Date().toISOString();
  if (decision === 'approve') {
    await updateRowById(spreadsheetId, SHEET, id, {
      status: 'joined',
      paymentReviewedAt: now,
      paymentReviewedBy: reviewedBy,
      rejectionReason: '',
      joinedAt: now,
    });
  } else {
    const reason = (rejectionReason ?? '').trim();
    if (!reason) return { signup: null, error: 'Alasan penolakan wajib diisi' };
    await updateRowById(spreadsheetId, SHEET, id, {
      status: 'waiting_payment',
      paymentReviewedAt: now,
      paymentReviewedBy: reviewedBy,
      // Keep the proof so the admin sees what was rejected; the member's
      // next upload overwrites it.
      rejectionReason: reason,
    });
  }

  cacheClear();
  const updated = await readRowById(spreadsheetId, SHEET, id);
  return { signup: updated ? coerceRow(updated, 0) : null };
}

/**
 * Flip waiting_payment rows whose deadline passed to expired (PRD §13) —
 * releases the reserved slot. Called opportunistically before reads; bounded
 * to one pass per cache TTL so public pages don't hammer the table.
 */
export async function expireOverdueSignups(
  spreadsheetId: string,
  force = false,
): Promise<number> {
  const guard = getCacheStore();
  const g = globalThis as unknown as { __dt_signups_expire_at__?: number };
  const lastRun = g.__dt_signups_expire_at__ ?? 0;
  const due = Date.now() - lastRun > SIGNUP_CACHE_TTL_MS;
  if (!force && !due && guard.size > 0) return 0;
  g.__dt_signups_expire_at__ = Date.now();

  try {
    const rows = await fetchAllRows(spreadsheetId);
    const now = Date.now();
    const overdue = rows.filter(
      (r) =>
        (r.status === 'waiting_payment' || r.status === 'payment_submitted') &&
        r.expiresAt &&
        Date.parse(r.expiresAt) < now,
    );
    if (overdue.length === 0) return 0;
    for (const r of overdue) {
      await updateRowById(spreadsheetId, SHEET, r.id, {
        status: 'expired',
        expiresAt: r.expiresAt,
      });
    }
    cacheClear();
    return overdue.length;
  } catch (error) {
    console.error('Failed to expire overdue signups:', error);
    return 0;
  }
}

/** Read one signup row by id (no status filtering). Null when missing. */
export async function readSignupById(
  spreadsheetId: string,
  id: string,
): Promise<ActivitySignup | null> {
  const row = await readRowById(spreadsheetId, SHEET, id);
  return row ? coerceRow(row, 0) : null;
}

export async function removeSignup(
  spreadsheetId: string,
  id: string,
): Promise<boolean> {
  await ensureSignupsSheet(spreadsheetId);
  const row = await readRowById(spreadsheetId, SHEET, id);
  if (!row) return false;
  await deleteRowById(spreadsheetId, SHEET, id);
  cacheClear();
  return true;
}

/**
 * Member-initiated cancellation (WhatsApp bot). Only active statuses can be
 * cancelled; decidedAt/decidedBy record the cancellation, cancelReason keeps
 * the member's free-text reason (if any).
 */
export async function cancelSignup(
  spreadsheetId: string,
  id: string,
  userEmail: string,
  reason?: string,
): Promise<{ signup: ActivitySignup | null; error?: string }> {
  await ensureSignupsSheet(spreadsheetId);
  const row = await readRowById(spreadsheetId, SHEET, id);
  if (!row) return { signup: null, error: 'Pendaftaran tidak ditemukan' };
  const current = coerceRow(row, 0);
  if (current.userEmail !== userEmail.trim().toLowerCase()) {
    return { signup: null, error: 'Bukan pendaftaran kamu' };
  }
  if (!ACTIVE_STATUSES.includes(current.status)) {
    return {
      signup: null,
      error: `Pendaftaran dengan status ${current.status} tidak bisa dibatalkan`,
    };
  }

  await updateRowById(spreadsheetId, SHEET, id, {
    status: 'cancelled',
    decidedAt: new Date().toISOString(),
    decidedBy: 'member:wa',
    cancelReason: (reason ?? '').trim().slice(0, 500),
  });
  cacheClear();
  const updated = await readRowById(spreadsheetId, SHEET, id);
  return { signup: updated ? coerceRow(updated, 0) : null };
}

export type PagedSignups = {
  items: ActivitySignup[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

function normalizeArgs(args?: { page?: number; pageSize?: number; status?: SignupStatus | 'all' }) {
  const pageSize = Math.max(
    1,
    Math.min(100, Math.floor(args?.pageSize ?? 10) || 10),
  );
  const page = Math.max(1, Math.floor(args?.page ?? 1) || 1);
  return { page, pageSize, offset: (page - 1) * pageSize };
}

export async function listSignupsForAdmin(args?: {
  page?: number;
  pageSize?: number;
  status?: SignupStatus | 'all';
  activityId?: string;
  /** Also return per-status counts (PRD §16 admin dashboard). */
  withCounts?: boolean;
}): Promise<PagedSignups & { countsByStatus?: Record<string, number> }> {
  const { page, pageSize, offset } = normalizeArgs(args);
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) {
    return { items: [], total: 0, page, pageSize, totalPages: 1 };
  }

  try {
    await ensureSignupsSheet(spreadsheetId);
    const rows = await fetchAllRows(spreadsheetId);
    let filtered = rows;
    if (args?.activityId) {
      filtered = filtered.filter((r) => r.activityId === args.activityId);
    }
    let countsByStatus: Record<string, number> | undefined;
    if (args?.withCounts) {
      countsByStatus = {};
      for (const r of filtered) {
        countsByStatus[r.status] = (countsByStatus[r.status] ?? 0) + 1;
      }
    }
    if (args?.status && args.status !== 'all') {
      filtered = filtered.filter((r) => r.status === args.status);
    }
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    return {
      items: filtered.slice(offset, offset + pageSize),
      total,
      page,
      pageSize,
      totalPages,
      countsByStatus,
    };
  } catch (error) {
    console.error('Failed to list activity signups:', error);
    return { items: [], total: 0, page, pageSize, totalPages: 1 };
  }
}

export async function getActivityTitles(
  spreadsheetId: string,
): Promise<Map<string, string>> {
  try {
    const rows = await listRowsBySheet(spreadsheetId, 'activities_items');
    const map = new Map<string, string>();
    for (const row of rows) {
      const id = String(row.id ?? '').trim();
      const title = String(row.title ?? '').trim();
      if (id && title) map.set(id, title);
    }
    return map;
  } catch {
    return new Map();
  }
}

export type SignupCounts = {
  /** Distinct activityId → count of slot-occupying registrations. */
  occupied: Record<string, number>;
  /** Distinct activityId → count of joined members. */
  joined: Record<string, number>;
};

/**
 * Slot-occupying + joined counts per activityId. occupied backs the
 * "N slots remaining" math (PRD §15); joined backs the member list. Uses
 * the same 10s cache as the public signup lookup so the home page and admin
 * list share a single read. Returns empty maps if the sheet can't be read.
 */
export async function getSignupCountsByActivity(): Promise<SignupCounts> {
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) return { occupied: {}, joined: {} };
  try {
    const rows = await fetchAllRows(spreadsheetId);
    const occupied: Record<string, number> = {};
    const joined: Record<string, number> = {};
    for (const row of rows) {
      if (SLOT_OCCUPYING_STATUSES.includes(row.status)) {
        occupied[row.activityId] = (occupied[row.activityId] ?? 0) + 1;
      }
      if (row.status === 'joined') {
        joined[row.activityId] = (joined[row.activityId] ?? 0) + 1;
      }
    }
    return { occupied, joined };
  } catch (error) {
    console.error('Failed to count activity signups:', error);
    return { occupied: {}, joined: {} };
  }
}

export type ActivityMember = {
  email: string;
  name: string;
  photo?: string;
  joinedAt: string;
};

/**
 * Returns the joined members of a single activity, joined with the
 * matching user record (name + optional photo) so the home page can
 * render a member popup. Falls back to the signup row's stored userName
 * if the user has been deleted from the users sheet since the signup.
 */
export async function getActivityMembers(
  activityId: string,
): Promise<ActivityMember[]> {
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) return [];
  try {
    const [rows, { listAllUsersForAdmin }] = await Promise.all([
      fetchAllRows(spreadsheetId),
      import('@/lib/users-store').then((m) => ({ listAllUsersForAdmin: m.listAllUsersForAdmin })),
    ]);
    const users = await listAllUsersForAdmin();
    const userByEmail = new Map(users.map((u) => [u.email.toLowerCase(), u]));
    return rows
      .filter((r) => r.activityId === activityId && r.status === 'joined')
      .map<ActivityMember>((r) => {
        const u = userByEmail.get(r.userEmail);
        return {
          email: r.userEmail,
          name: u?.name || r.userName || r.userEmail,
          photo: u?.photo,
          joinedAt: r.joinedAt || r.decidedAt || r.requestedAt,
        };
      })
      .sort((a, b) => (b.joinedAt || '').localeCompare(a.joinedAt || ''));
  } catch (error) {
    console.error('Failed to load activity members:', error);
    return [];
  }
}

/**
 * Shared registration decision used by BOTH the admin dashboard PATCH and the
 * one-click /approval/[token] links: loads the signup's activity, derives its
 * capacity/payment/deadline settings, and runs decideSignup. Single place so
 * WhatsApp-link approvals follow the exact same rules as the dashboard.
 */
export async function decideSignupWithActivity(
  spreadsheetId: string,
  id: string,
  decision: 'approve' | 'reject',
  decidedBy: string,
): Promise<{ signup: ActivitySignup | null; error?: string }> {
  const row = await readRowById(spreadsheetId, SHEET, id);
  if (!row) return { signup: null, error: 'Signup not found' };
  const activityId = String(row.activityId ?? '').trim();
  let activity: Record<string, unknown> | null = null;
  try {
    const rows = await listRowsBySheet(spreadsheetId, 'activities_items');
    activity = rows.find((r) => String(r.id ?? '').trim() === activityId) ?? null;
  } catch {
    activity = null;
  }

  const groupSize = String((activity as { groupSize?: unknown } | null)?.groupSize ?? '');
  const capacityMatch = groupSize.match(/\d+/);
  const capacity = capacityMatch ? Number.parseInt(capacityMatch[0], 10) : 0;
  const price = String((activity as { price?: unknown } | null)?.price ?? '');
  const paymentRequired = parsePriceToAmount(price) > 0;
  const deadlineRaw = Number(
    (activity as { paymentDeadlineHours?: unknown } | null)?.paymentDeadlineHours ?? 0,
  );

  return decideSignup(spreadsheetId, id, decision, decidedBy, {
    capacity: capacity > 0 ? capacity : undefined,
    paymentRequired,
    deadlineHours: Number.isFinite(deadlineRaw) ? deadlineRaw : undefined,
  });
}

export {
  SHEET,
  SLOT_OCCUPYING_STATUSES,
  ACTIVE_STATUSES,
};
