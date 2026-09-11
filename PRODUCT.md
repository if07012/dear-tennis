# Product — Dear Tennis

What the product is, who it serves, and what's built vs. planned. Full PRDs: `PRD.md` (marketing site, Indonesian) and `profile.md` (member dashboard). This file is the working summary — keep it updated when shipped features change.

## Overview

Dear Tennis is a tennis community website with a member side and an admin/CMS side. Built as a marketing site + member dashboard + invite-based membership system. Single admin (email allowlist) manages all content through in-app editors — no headless CMS.

## Users / personas

- **Visitor** — browses the landing page, sees activities/events/gallery, joins via invite code.
- **Member** — logs in, gets a profile dashboard: skill points, match scorecards, achievements/badges, joined activities, event history with gallery.
- **Coach** — (future) evaluates players, assigns skill points. Today the admin effectively acts as coach: grants badges and skill points from the admin pages.
- **Admin** — one allowlisted email (`NEXT_PUBLIC_ADMIN_EMAIL`). Full CMS control, user management, invite issuing, signup approvals, coupon management.

## Feature inventory

### Shipped

**Public site**
- Landing page: hero (slider), about, why-join, activities, events/calendar, gallery, testimonials, statistics, FAQ, CTA — all editable via admin CMS.
- Activity detail pages at `/activities/[id]/[slug]` with join flow (confirmation dialog with name/date/location/price).
- Coupon system: admin-managed codes (global or per-activity scope), members claim a code for a % discount; claims snapshot the % so later coupon edits don't rewrite history.
- Login/register + invite-token signup (`/invite/[token]`).

**Member dashboard** (`/profile`)
- Skill overview + breakdown charts (Chart.js), skill progress bars.
- Match scorecards per activity, event history + gallery, achievements/badges.
- Profile editing (photo, rank), admin view of any member via `?user=<email>`.

**Admin** (`/admin/*`, grouped nav: CMS / Activity / Users)
- CMS editors: hero, our story, why-join, activities heading, calendar, gallery, testimonials, statistics, FAQ.
- Activities list: full CRUD, ordering, archive, clone, recurring duplication, price, per-activity signup counts.
- Activity signups: approve/reject/delete requests, filter by status and by activity.
- Coupons: CRUD + member claims list.
- Users: role management, badge granting, profile view.
- Invites: issue invite links.

### Planned / not built (from PRDs)

- Tennis Training Progress Dashboard (per `profile.md`): overall score, radar chart, fault analysis, weakest-skill recommendations, goal tracking, coach notes, export, training calendar. Current dashboard is a subset: skill points + matches + badges.
- Roadmap items (`PRD.md`): court booking, tournament registration, blog, merchandise, leaderboard, WhatsApp integration, Google Calendar sync.
- Future concepts: AI coach insights, video/swing analysis.

## Open product questions

From `profile.md` §24, still undecided: skill scoring scale (0–100 vs 1–10), final skill list, data source (coach input vs self-assessment vs automatic), ranking system (named ranks vs NTRP style), goal ownership, multi-coach support.

## Status

As of September 2026: marketing site + CMS + membership + activities + coupons + badges shipped; progress-dashboard features partially implemented (skill points, matches, achievements). See git history for recent work.
