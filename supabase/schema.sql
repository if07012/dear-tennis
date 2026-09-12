-- Dear Tennis — Supabase schema (migrated from Google Sheets)
-- Run in Supabase SQL editor. Column names stay camelCase (quoted) to match
-- the existing store code, which reads/writes rows as objects keyed by the
-- same names the old sheets used.
--
-- Every table has:
--   "id" text PRIMARY KEY      — stores mint UUIDs; settings rows use 'current'
--   "seq" bigint identity      — preserves row arrival order (sheets returned
--                                rows in sheet order; store sorts override it)
--   RLS enabled, no policies   — deny-all for anon/authenticated; the app only
--                                connects with the service role key, which
--                                bypasses RLS.

-- ============ USERS ============
CREATE TABLE IF NOT EXISTS users (
  "id" text PRIMARY KEY,
  "email" text NOT NULL,
  "name" text NOT NULL DEFAULT '',
  "passwordHash" text NOT NULL DEFAULT '',
  "salt" text NOT NULL DEFAULT '',
  "createdAt" text NOT NULL DEFAULT '',
  "role" text NOT NULL DEFAULT 'member',
  "photo" text,
  "rank" text,
  "seq" bigint GENERATED ALWAYS AS IDENTITY
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_key ON users (lower("email"));
CREATE INDEX IF NOT EXISTS users_created_idx ON users ("createdAt");

-- ============ INVITES ============
CREATE TABLE IF NOT EXISTS invites (
  "id" text PRIMARY KEY,
  "email" text NOT NULL,
  "name" text NOT NULL DEFAULT '',
  "message" text,
  "status" text NOT NULL DEFAULT 'pending',
  "invitedAt" text NOT NULL DEFAULT '',
  "createdBy" text NOT NULL DEFAULT '',
  "token" text NOT NULL UNIQUE,
  "seq" bigint GENERATED ALWAYS AS IDENTITY
);
CREATE INDEX IF NOT EXISTS invites_email_idx ON invites ("email");

-- ============ HERO ============
CREATE TABLE IF NOT EXISTS hero_settings (
  "id" text PRIMARY KEY,
  "title" text NOT NULL DEFAULT '',
  "subtitle" text NOT NULL DEFAULT '',
  "description" text NOT NULL DEFAULT '',
  "ctaPrimaryLabel" text NOT NULL DEFAULT '',
  "ctaPrimaryHref" text NOT NULL DEFAULT '',
  "ctaSecondaryLabel" text NOT NULL DEFAULT '',
  "ctaSecondaryHref" text NOT NULL DEFAULT '',
  "updatedAt" text NOT NULL DEFAULT '',
  "seq" bigint GENERATED ALWAYS AS IDENTITY
);

CREATE TABLE IF NOT EXISTS hero_slides (
  "id" text PRIMARY KEY,
  "image" text NOT NULL DEFAULT '',
  "alt" text NOT NULL DEFAULT '',
  "order" integer NOT NULL DEFAULT 0,
  "createdAt" text NOT NULL DEFAULT '',
  "seq" bigint GENERATED ALWAYS AS IDENTITY
);

-- ============ ACTIVITIES ============
CREATE TABLE IF NOT EXISTS activities_settings (
  "id" text PRIMARY KEY,
  "tag" text NOT NULL DEFAULT '',
  "title" text NOT NULL DEFAULT '',
  "subtitle" text NOT NULL DEFAULT '',
  "updatedAt" text NOT NULL DEFAULT '',
  "seq" bigint GENERATED ALWAYS AS IDENTITY
);

CREATE TABLE IF NOT EXISTS activities_items (
  "id" text PRIMARY KEY,
  "category" text NOT NULL DEFAULT 'training',
  "title" text NOT NULL DEFAULT '',
  "description" text NOT NULL DEFAULT '',
  "image" text NOT NULL DEFAULT '',
  "duration" text NOT NULL DEFAULT '',
  "groupSize" text NOT NULL DEFAULT '',
  "location" text NOT NULL DEFAULT '',
  "time" text NOT NULL DEFAULT '',
  "order" integer NOT NULL DEFAULT 0,
  "createdAt" text NOT NULL DEFAULT '',
  "isFull" boolean NOT NULL DEFAULT false,
  "archived" boolean NOT NULL DEFAULT false,
  "price" text NOT NULL DEFAULT '',
  "seq" bigint GENERATED ALWAYS AS IDENTITY
);

-- ============ ACTIVITY SIGNUPS ============
CREATE TABLE IF NOT EXISTS activity_signups (
  "id" text PRIMARY KEY,
  "activityId" text NOT NULL DEFAULT '',
  "userEmail" text NOT NULL DEFAULT '',
  "userName" text NOT NULL DEFAULT '',
  "status" text NOT NULL DEFAULT 'pending',
  "message" text,
  "requestedAt" text NOT NULL DEFAULT '',
  "decidedAt" text,
  "decidedBy" text,
  "seq" bigint GENERATED ALWAYS AS IDENTITY
);
CREATE INDEX IF NOT EXISTS activity_signups_email_idx ON activity_signups ("userEmail");
CREATE INDEX IF NOT EXISTS activity_signups_activity_idx ON activity_signups ("activityId");

-- ============ ACTIVITY MATCHES ============
CREATE TABLE IF NOT EXISTS activity_matches (
  "id" text PRIMARY KEY,
  "activityId" text NOT NULL DEFAULT '',
  "matchIndex" integer NOT NULL DEFAULT 0,
  "round" text NOT NULL DEFAULT '',
  "format" text NOT NULL DEFAULT 'bo3',
  "isDoubles" boolean NOT NULL DEFAULT false,
  "sideA" text NOT NULL DEFAULT '',
  "sideB" text NOT NULL DEFAULT '',
  "set1A" integer, "set1B" integer,
  "set2A" integer, "set2B" integer,
  "set3A" integer, "set3B" integer,
  "winner" text NOT NULL DEFAULT '',
  "recordedBy" text NOT NULL DEFAULT '',
  "recordedAt" text NOT NULL DEFAULT '',
  "updatedAt" text NOT NULL DEFAULT '',
  "seq" bigint GENERATED ALWAYS AS IDENTITY
);
CREATE INDEX IF NOT EXISTS activity_matches_activity_idx ON activity_matches ("activityId");

-- ============ COUPONS ============
-- Admin-managed discount codes. activityId empty = applies to any activity.
CREATE TABLE IF NOT EXISTS coupons (
  "id" text PRIMARY KEY,
  "code" text NOT NULL DEFAULT '',
  "discountPct" integer NOT NULL DEFAULT 0,
  "activityId" text NOT NULL DEFAULT '',
  "active" boolean NOT NULL DEFAULT true,
  "createdAt" text NOT NULL DEFAULT '',
  "seq" bigint GENERATED ALWAYS AS IDENTITY
);
CREATE UNIQUE INDEX IF NOT EXISTS coupons_code_key ON coupons (upper("code"));
CREATE INDEX IF NOT EXISTS coupons_activity_idx ON coupons ("activityId");
-- Migration 2026-09: coupon expiry. '' = never expires.
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS "expiresAt" text NOT NULL DEFAULT '';
-- Migration 2026-09: personal coupons. '' = anyone can claim.
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS "userEmail" text NOT NULL DEFAULT '';

-- One row per user claiming a coupon: what discount they actually got.
CREATE TABLE IF NOT EXISTS coupon_claims (
  "id" text PRIMARY KEY,
  "couponId" text NOT NULL DEFAULT '',
  "code" text NOT NULL DEFAULT '',
  "userEmail" text NOT NULL DEFAULT '',
  "activityId" text NOT NULL DEFAULT '',
  "discountPct" integer NOT NULL DEFAULT 0,
  "claimedAt" text NOT NULL DEFAULT '',
  "seq" bigint GENERATED ALWAYS AS IDENTITY
);
CREATE INDEX IF NOT EXISTS coupon_claims_email_idx ON coupon_claims ("userEmail");
CREATE INDEX IF NOT EXISTS coupon_claims_coupon_idx ON coupon_claims ("couponId");
CREATE TABLE IF NOT EXISTS badges (
  "id" text PRIMARY KEY,
  "key" text NOT NULL DEFAULT '',
  "label" text NOT NULL DEFAULT '',
  "icon" text NOT NULL DEFAULT '',
  "description" text NOT NULL DEFAULT '',
  "archived" boolean NOT NULL DEFAULT false,
  "createdAt" text NOT NULL DEFAULT '',
  "seq" bigint GENERATED ALWAYS AS IDENTITY
);
CREATE UNIQUE INDEX IF NOT EXISTS badges_key_key ON badges ("key");

CREATE TABLE IF NOT EXISTS user_badges (
  "id" text PRIMARY KEY,
  "userEmail" text NOT NULL DEFAULT '',
  "badgeKey" text NOT NULL DEFAULT '',
  "grantedAt" text NOT NULL DEFAULT '',
  "grantedBy" text NOT NULL DEFAULT '',
  "note" text,
  "seq" bigint GENERATED ALWAYS AS IDENTITY
);
CREATE INDEX IF NOT EXISTS user_badges_email_idx ON user_badges ("userEmail");
CREATE INDEX IF NOT EXISTS user_badges_key_idx ON user_badges ("badgeKey");

-- ============ SKILL POINTS ============
-- Row id is `${email}::${activityId}::${skill}` (see user-skill-points-store).
CREATE TABLE IF NOT EXISTS user_skill_points (
  "id" text PRIMARY KEY,
  "userEmail" text NOT NULL DEFAULT '',
  "activityId" text NOT NULL DEFAULT '',
  "skill" text NOT NULL DEFAULT '',
  "forehand" integer NOT NULL DEFAULT 0,
  "backhand" integer NOT NULL DEFAULT 0,
  "serve" integer NOT NULL DEFAULT 0,
  "volley" integer NOT NULL DEFAULT 0,
  "footwork" integer NOT NULL DEFAULT 0,
  "strategy" integer NOT NULL DEFAULT 0,
  "accuracy" integer NOT NULL DEFAULT 0,
  "power" integer NOT NULL DEFAULT 0,
  "consistency" integer NOT NULL DEFAULT 0,
  "speed" integer NOT NULL DEFAULT 0,
  "agility" integer NOT NULL DEFAULT 0,
  "balance" integer NOT NULL DEFAULT 0,
  "updatedAt" text NOT NULL DEFAULT '',
  "updatedBy" text NOT NULL DEFAULT '',
  "seq" bigint GENERATED ALWAYS AS IDENTITY
);
CREATE INDEX IF NOT EXISTS user_skill_points_email_idx ON user_skill_points ("userEmail");
CREATE INDEX IF NOT EXISTS user_skill_points_activity_idx ON user_skill_points ("activityId");

-- ============ PERFORMANCE POINTS ============
CREATE TABLE IF NOT EXISTS user_performance_points (
  "id" text PRIMARY KEY,
  "userEmail" text NOT NULL DEFAULT '',
  "activityId" text NOT NULL DEFAULT '',
  "skill" text NOT NULL DEFAULT '',
  "forehandTarget" integer NOT NULL DEFAULT 0,
  "backhandTarget" integer NOT NULL DEFAULT 0,
  "serveTarget" integer NOT NULL DEFAULT 0,
  "volleyTarget" integer NOT NULL DEFAULT 0,
  "footworkTarget" integer NOT NULL DEFAULT 0,
  "forehandKesalahan" integer NOT NULL DEFAULT 0,
  "backhandKesalahan" integer NOT NULL DEFAULT 0,
  "serveKesalahan" integer NOT NULL DEFAULT 0,
  "volleyKesalahan" integer NOT NULL DEFAULT 0,
  "footworkKesalahan" integer NOT NULL DEFAULT 0,
  "updatedAt" text NOT NULL DEFAULT '',
  "updatedBy" text NOT NULL DEFAULT '',
  "seq" bigint GENERATED ALWAYS AS IDENTITY
);
CREATE INDEX IF NOT EXISTS user_performance_email_idx ON user_performance_points ("userEmail");
CREATE INDEX IF NOT EXISTS user_performance_activity_idx ON user_performance_points ("activityId");

-- ============ GALLERY ============
CREATE TABLE IF NOT EXISTS gallery_settings (
  "id" text PRIMARY KEY,
  "tag" text NOT NULL DEFAULT '',
  "title" text NOT NULL DEFAULT '',
  "subtitle" text NOT NULL DEFAULT '',
  "updatedAt" text NOT NULL DEFAULT '',
  "seq" bigint GENERATED ALWAYS AS IDENTITY
);

CREATE TABLE IF NOT EXISTS gallery_items (
  "id" text PRIMARY KEY,
  "src" text NOT NULL DEFAULT '',
  "alt" text NOT NULL DEFAULT '',
  "large" text NOT NULL DEFAULT '',
  "order" integer NOT NULL DEFAULT 0,
  "createdAt" text NOT NULL DEFAULT '',
  "seq" bigint GENERATED ALWAYS AS IDENTITY
);

-- ============ FAQ ============
CREATE TABLE IF NOT EXISTS faq_settings (
  "id" text PRIMARY KEY,
  "tag" text NOT NULL DEFAULT '',
  "title" text NOT NULL DEFAULT '',
  "subtitle" text NOT NULL DEFAULT '',
  "updatedAt" text NOT NULL DEFAULT '',
  "seq" bigint GENERATED ALWAYS AS IDENTITY
);

CREATE TABLE IF NOT EXISTS faq_items (
  "id" text PRIMARY KEY,
  "question" text NOT NULL DEFAULT '',
  "answer" text NOT NULL DEFAULT '',
  "order" integer NOT NULL DEFAULT 0,
  "createdAt" text NOT NULL DEFAULT '',
  "seq" bigint GENERATED ALWAYS AS IDENTITY
);

-- ============ CALENDAR ============
CREATE TABLE IF NOT EXISTS calendar_settings (
  "id" text PRIMARY KEY,
  "tag" text NOT NULL DEFAULT '',
  "title" text NOT NULL DEFAULT '',
  "updatedAt" text NOT NULL DEFAULT '',
  "seq" bigint GENERATED ALWAYS AS IDENTITY
);

CREATE TABLE IF NOT EXISTS calendar_events (
  "id" text PRIMARY KEY,
  "day" text NOT NULL DEFAULT '',
  "month" text NOT NULL DEFAULT '',
  "title" text NOT NULL DEFAULT '',
  "description" text NOT NULL DEFAULT '',
  "location" text NOT NULL DEFAULT '',
  "time" text NOT NULL DEFAULT '',
  "ctaLabel" text NOT NULL DEFAULT '',
  "ctaHref" text NOT NULL DEFAULT '',
  "order" integer NOT NULL DEFAULT 0,
  "createdAt" text NOT NULL DEFAULT '',
  "seq" bigint GENERATED ALWAYS AS IDENTITY
);

-- ============ TESTIMONIALS ============
CREATE TABLE IF NOT EXISTS testimonials_settings (
  "id" text PRIMARY KEY,
  "tag" text NOT NULL DEFAULT '',
  "title" text NOT NULL DEFAULT '',
  "subtitle" text NOT NULL DEFAULT '',
  "updatedAt" text NOT NULL DEFAULT '',
  "seq" bigint GENERATED ALWAYS AS IDENTITY
);

CREATE TABLE IF NOT EXISTS testimonials_items (
  "id" text PRIMARY KEY,
  "quote" text NOT NULL DEFAULT '',
  "name" text NOT NULL DEFAULT '',
  "since" text NOT NULL DEFAULT '',
  "avatar" text NOT NULL DEFAULT '',
  "order" integer NOT NULL DEFAULT 0,
  "createdAt" text NOT NULL DEFAULT '',
  "seq" bigint GENERATED ALWAYS AS IDENTITY
);

-- ============ STATISTICS ============
CREATE TABLE IF NOT EXISTS statistics_items (
  "id" text PRIMARY KEY,
  "value" text NOT NULL DEFAULT '',
  "label" text NOT NULL DEFAULT '',
  "suffix" text NOT NULL DEFAULT '',
  "order" integer NOT NULL DEFAULT 0,
  "createdAt" text NOT NULL DEFAULT '',
  "seq" bigint GENERATED ALWAYS AS IDENTITY
);

-- ============ WHY JOIN ============
CREATE TABLE IF NOT EXISTS why_join_settings (
  "id" text PRIMARY KEY,
  "tag" text NOT NULL DEFAULT '',
  "title" text NOT NULL DEFAULT '',
  "subtitle" text NOT NULL DEFAULT '',
  "updatedAt" text NOT NULL DEFAULT '',
  "seq" bigint GENERATED ALWAYS AS IDENTITY
);

CREATE TABLE IF NOT EXISTS why_join_benefits (
  "id" text PRIMARY KEY,
  "title" text NOT NULL DEFAULT '',
  "description" text NOT NULL DEFAULT '',
  "icon" text NOT NULL DEFAULT '',
  "order" integer NOT NULL DEFAULT 0,
  "createdAt" text NOT NULL DEFAULT '',
  "seq" bigint GENERATED ALWAYS AS IDENTITY
);

-- ============ OUR STORY ============
CREATE TABLE IF NOT EXISTS our_story_settings (
  "id" text PRIMARY KEY,
  "tag" text NOT NULL DEFAULT '',
  "title" text NOT NULL DEFAULT '',
  "subtitle" text NOT NULL DEFAULT '',
  "lead" text NOT NULL DEFAULT '',
  "body" text NOT NULL DEFAULT '',
  "closing" text NOT NULL DEFAULT '',
  "image" text NOT NULL DEFAULT '',
  "imageAlt" text NOT NULL DEFAULT '',
  "updatedAt" text NOT NULL DEFAULT '',
  "seq" bigint GENERATED ALWAYS AS IDENTITY
);

-- ============ REGISTRATION PAYMENT FLOW (2026-09) ============
-- Migration 2026-09 (PRD: activity-registration-payment-coupon-prd.md).
-- activity_signups gains coupon + payment columns; the old status values
-- (pending/approved/rejected) are read as pending_approval/joined/rejected
-- by the store's coerceStatus, so no data rewrite is needed.
ALTER TABLE activity_signups ADD COLUMN IF NOT EXISTS "couponCode" text NOT NULL DEFAULT '';
ALTER TABLE activity_signups ADD COLUMN IF NOT EXISTS "discountPct" integer NOT NULL DEFAULT 0;
ALTER TABLE activity_signups ADD COLUMN IF NOT EXISTS "originalAmount" bigint NOT NULL DEFAULT 0;
ALTER TABLE activity_signups ADD COLUMN IF NOT EXISTS "finalAmount" bigint NOT NULL DEFAULT 0;
ALTER TABLE activity_signups ADD COLUMN IF NOT EXISTS "paymentProofUrl" text;
ALTER TABLE activity_signups ADD COLUMN IF NOT EXISTS "paymentNote" text;
ALTER TABLE activity_signups ADD COLUMN IF NOT EXISTS "uploadedAt" text;
ALTER TABLE activity_signups ADD COLUMN IF NOT EXISTS "paymentReviewedAt" text;
ALTER TABLE activity_signups ADD COLUMN IF NOT EXISTS "paymentReviewedBy" text;
ALTER TABLE activity_signups ADD COLUMN IF NOT EXISTS "rejectionReason" text;
ALTER TABLE activity_signups ADD COLUMN IF NOT EXISTS "joinedAt" text;
ALTER TABLE activity_signups ADD COLUMN IF NOT EXISTS "expiresAt" text;
-- Optional per-activity payment deadline: hours after registration approval
-- ('' = no deadline). P1 in the PRD.
ALTER TABLE activities_items ADD COLUMN IF NOT EXISTS "paymentDeadlineHours" integer NOT NULL DEFAULT 0;

-- Optional payment-approval flow per activity: when true, admin approving a
-- registration lands it in waiting_payment instead of joined directly.
ALTER TABLE activities_items ADD COLUMN IF NOT EXISTS "paymentRequired" boolean NOT NULL DEFAULT true;

-- ============ RLS (deny-all; service role bypasses) ============
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- ============ CLICK TRACKING (2026-09) ============
-- Migration 2026-09 (PRD: add-new-feature-for-tracking-user-export.md).
-- PRD §12: click data is non-personal; anonymous visitors get IP only (plain
-- text, no hashing). clickedAt is a UTC ISO string so lexicographic text
-- sort matches chronological order.
CREATE TABLE IF NOT EXISTS click_events (
  "id" text PRIMARY KEY,
  "buttonText" text NOT NULL DEFAULT '',
  "elementType" text NOT NULL DEFAULT '',
  "targetUrl" text NOT NULL DEFAULT '',
  "pageUrl" text NOT NULL DEFAULT '',
  "activityTitle" text NOT NULL DEFAULT '',
  "clickedAt" text NOT NULL DEFAULT '',
  "timezone" text NOT NULL DEFAULT '',
  "referrerUrl" text NOT NULL DEFAULT '',
  "userName" text NOT NULL DEFAULT '',
  "userEmail" text NOT NULL DEFAULT '',
  "ip" text NOT NULL DEFAULT '',
  "browser" text NOT NULL DEFAULT '',
  "deviceType" text NOT NULL DEFAULT '',
  "seq" bigint GENERATED ALWAYS AS IDENTITY
);
CREATE INDEX IF NOT EXISTS idx_click_events_clicked_at ON click_events ("clickedAt");
CREATE INDEX IF NOT EXISTS idx_click_events_button_text ON click_events ("buttonText");
CREATE INDEX IF NOT EXISTS idx_click_events_ip ON click_events ("ip");
-- The RLS DO-block earlier in this file ran before this table existed, so
-- this table needs its own enable.
ALTER TABLE click_events ENABLE ROW LEVEL SECURITY;
-- Migration 2026-09: tracking is now activity-detail-only; store its title.
ALTER TABLE click_events ADD COLUMN IF NOT EXISTS "activityTitle" text NOT NULL DEFAULT '';

-- Migration 2026-09: optional phone number on users (set at registration,
-- editable from the profile page).
ALTER TABLE users ADD COLUMN IF NOT EXISTS "phone" text;
