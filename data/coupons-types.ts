// ============================================
// COUPON TYPES
// ============================================
// Admin-managed discount codes. A coupon either targets one activity
// (activityId set) or applies to any activity (empty).

export type Coupon = {
  id: string;
  code: string;
  discountPct: number; // 1–100
  activityId: string; // '' = any activity
  userEmail: string; // '' = anyone; otherwise only this member can claim
  active: boolean;
  expiresAt: string; // ISO date; '' = never expires
  createdAt: string;
};

export type CouponClaim = {
  id: string;
  couponId: string;
  code: string;
  userEmail: string;
  activityId: string;
  discountPct: number; // snapshot of what the user got at claim time
  claimedAt: string;
};

export const COUPON_HEADERS = [
  'id',
  'code',
  'discountPct',
  'activityId',
  'userEmail',
  'active',
  'expiresAt',
  'createdAt',
] as const;

export const COUPON_CLAIM_HEADERS = [
  'id',
  'couponId',
  'code',
  'userEmail',
  'activityId',
  'discountPct',
  'claimedAt',
] as const;
