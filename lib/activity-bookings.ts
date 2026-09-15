// ============================================
// SHARED BOOKING PIPELINE (website + WhatsApp bot)
// ============================================
// Extracted from /api/activity-signups POST so the chatbot books through
// the exact same rules: idempotent on (user, activity), refuses archived /
// full activities, respects capacity, skips coupons (bot bookings are
// always full price — the member can rebook with a coupon from the site).
// Bookings land in pending_approval exactly like the website flow.

import { getSpreadsheetId } from '@/app/lib/supabase';
import {
  findSignup,
  requestSignup,
  getSignupCountsByActivity,
} from '@/lib/activity-signups-store';
import { notifyAdminNewSignup } from '@/lib/whatsapp-bot';
import { parsePriceToAmount } from '@/data/activity-signups-types';
import { getActivitiesContent } from '@/lib/activities-store';

export type BookingUser = { id: string; email: string; name: string };

export type BookingResult =
  | { ok: true; status: string; created: boolean }
  | { ok: false; error: string };

export async function registerUserForActivity(
  user: BookingUser,
  activityId: string,
  options?: {
    message?: string;
    /** Pre-validated coupon snapshot; the bot passes none (full price). */
    couponCode?: string;
    discountPct?: number;
  },
): Promise<BookingResult> {
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) return { ok: false, error: 'Server belum terkonfigurasi' };

  const email = user.email.trim().toLowerCase();
  const existing = await findSignup(spreadsheetId, activityId, email);
  // Idempotent: an active/joined signup returns its current status.
  if (existing && existing.status !== 'rejected' && existing.status !== 'cancelled' && existing.status !== 'expired') {
    return { ok: true, status: existing.status, created: false };
  }

  const { activities } = await getActivitiesContent();
  const activity = activities.find((a) => a.id === activityId);
  if (!activity) return { ok: false, error: 'Activity tidak ditemukan' };
  if (activity.archived === true) return { ok: false, error: 'Activity sudah tidak tersedia' };
  if (activity.isFull === true) return { ok: false, error: 'Activity sudah penuh' };

  // Capacity: waiting_payment + payment_submitted + joined occupy slots.
  const capacityMatch = (activity.groupSize ?? '').match(/\d+/);
  const capacity = capacityMatch ? Number.parseInt(capacityMatch[0], 10) : 0;
  if (capacity > 0) {
    const { occupied } = await getSignupCountsByActivity();
    if ((occupied[activityId] ?? 0) >= capacity) {
      return { ok: false, error: 'Slot activity sudah penuh' };
    }
  }

  const originalAmount = parsePriceToAmount(activity.price);
  const discountPct = options?.discountPct ?? 0;
  const result = await requestSignup(spreadsheetId, {
    activityId,
    userEmail: email,
    userName: user.name,
    message: options?.message,
    couponCode: options?.couponCode ?? '',
    discountPct,
    originalAmount,
    finalAmount: Math.round(originalAmount * (1 - discountPct / 100)),
  });
  // Fresh (or re-submitted) pending row → tell the admin with one-click links.
  console.log('registerUserForActivity: signup result', result);
  if (result.signup.status === 'pending_approval') {
    void notifyAdminNewSignup(email, activityId, result.signup.id);
  }
  return { ok: true, status: result.signup.status, created: result.created };
}
