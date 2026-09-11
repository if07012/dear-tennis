// ============================================
// ACTIVITY SIGNUPS TYPES
// ============================================
// A signup is a member's request to join an activity. Members create a
// request from the home page; an admin approves it into `waiting_payment`,
// the member uploads payment proof, and an admin verifies the payment to
// reach `joined`. See activity-registration-payment-coupon-prd.md.
//
// Table schema (see supabase/schema.sql):
//   activity_signups: id, activityId, userEmail, userName, status, message,
//                     requestedAt, decidedAt, decidedBy, couponCode,
//                     discountPct, originalAmount, finalAmount,
//                     paymentProofUrl, paymentNote, uploadedAt,
//                     paymentReviewedAt, paymentReviewedBy, rejectionReason,
//                     joinedAt, expiresAt
//
// Status flow:
//   pending_approval → waiting_payment (admin approve; slot reserved)
//   waiting_payment  → payment_submitted (member uploads proof)
//   payment_submitted→ joined (admin approves payment) | waiting_payment (reject)
//   waiting_payment  → expired (deadline passed)
// Legacy rows written before the payment flow use pending/approved/rejected;
// coerceStatus maps them onto the new set.

export type SignupStatus =
  | 'pending_approval'
  | 'waiting_payment'
  | 'payment_submitted'
  | 'joined'
  | 'rejected'
  | 'cancelled'
  | 'expired';

export const SIGNUP_STATUSES: SignupStatus[] = [
  'pending_approval',
  'waiting_payment',
  'payment_submitted',
  'joined',
  'rejected',
  'cancelled',
  'expired',
];

/** Statuses that consume one of the activity's capacity slots (PRD Rule 1). */
export const SLOT_OCCUPYING_STATUSES: SignupStatus[] = [
  'waiting_payment',
  'payment_submitted',
  'joined',
];

/** Statuses that block creating a second registration (PRD Rule 5). */
export const ACTIVE_STATUSES: SignupStatus[] = [
  'pending_approval',
  'waiting_payment',
  'payment_submitted',
  'joined',
];

// Legacy Google-Sheets-era values → current equivalents.
const LEGACY_STATUS_MAP: Record<string, SignupStatus> = {
  pending: 'pending_approval',
  approved: 'joined',
  rejected: 'rejected',
};

export function coerceLegacyStatus(value: string): SignupStatus | null {
  return LEGACY_STATUS_MAP[value] ?? null;
}

export function isSignupStatus(value: string): value is SignupStatus {
  return (SIGNUP_STATUSES as string[]).includes(value);
}

export type ActivitySignup = {
  id: string;
  activityId: string;
  userEmail: string;
  userName: string;
  status: SignupStatus;
  message?: string;
  requestedAt: string;
  decidedAt?: string;
  decidedBy?: string;
  /** Coupon code claimed at join time; '' when none. */
  couponCode: string;
  /** Discount % snapshot taken when the coupon was claimed. */
  discountPct: number;
  /** Price before discount, parsed from the activity's price string. */
  originalAmount: number;
  /** Price after coupon discount; equals originalAmount without a coupon. */
  finalAmount: number;
  /** Payment proof URL/data URL, set once the member uploads it. */
  paymentProofUrl?: string;
  /** Free-form note from the member, submitted with the proof. */
  paymentNote?: string;
  /** When the member uploaded the current payment proof. */
  uploadedAt?: string;
  /** When the admin last reviewed the payment (approve or reject). */
  paymentReviewedAt?: string;
  /** Admin email that last reviewed the payment. */
  paymentReviewedBy?: string;
  /** Reason given when a payment proof was rejected. */
  rejectionReason?: string;
  /** Set when the registration reaches `joined`. */
  joinedAt?: string;
  /** Payment deadline (ISO); after it the reserved slot is released. */
  expiresAt?: string;
};

export const SIGNUP_HEADERS = [
  'id',
  'activityId',
  'userEmail',
  'userName',
  'status',
  'message',
  'requestedAt',
  'decidedAt',
  'decidedBy',
  'couponCode',
  'discountPct',
  'originalAmount',
  'finalAmount',
  'paymentProofUrl',
  'paymentNote',
  'uploadedAt',
  'paymentReviewedAt',
  'paymentReviewedBy',
  'rejectionReason',
  'joinedAt',
  'expiresAt',
] as const;

/**
 * Parse the activity's free-text price ("Rp 100.000", "100000", "$10") into
 * an integer amount. Returns 0 when there is no parseable price (free or
 * unpriced activities skip the payment amount display).
 */
export function parsePriceToAmount(price: string | undefined): number {
  if (!price) return 0;
  const digits = price.replace(/[^\d]/g, '');
  return digits ? Number.parseInt(digits, 10) : 0;
}
