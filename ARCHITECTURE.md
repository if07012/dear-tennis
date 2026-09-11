# Architecture

Dear Tennis — Next.js 16 App Router + TypeScript + Tailwind CSS 4 + Supabase (Postgres).

## Data layer (the one thing you must know)

`app/lib/supabase.ts` is a shim that replaced an old Google Sheets layer. Stores call `listRowsBySheet(spreadsheetId, sheetName, ...)` / `createRowWithId` / `updateRowById` / `deleteRowById` / `readRowById`; the spreadsheetId args are ignored. All persistence is Postgres via the **service-role key** (bypasses RLS).

- **Adding a new table**: add it to the `TABLES` set in `app/lib/supabase.ts` **and** define it in `supabase/schema.sql` (the user runs migrations manually in the Supabase SQL editor — tell them what to run). Column names are camelCase and must be quoted (`"userEmail"`). Every table needs `"seq" bigint GENERATED ALWAYS AS IDENTITY` (ordering) and `"id" text PRIMARY KEY`.
- **Migrations are append-only**: never edit an existing table definition or script block in `supabase/schema.sql` after it has been run — the user pastes scripts into the Supabase SQL editor once; a modified old block will never be re-executed. For changes to an existing table (new column, index, etc.) append a NEW idempotent script (e.g. `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...`, `CREATE TABLE IF NOT EXISTS`, `CREATE UNIQUE INDEX IF NOT EXISTS`) and tell the user to run it.
- Tables have RLS enabled with **no policies** (deny-all for anon/authenticated). All access goes through route handlers using the service key.
- `data/*-types.ts` files hold TS types + the legacy sheet-header arrays (e.g. `ACTIVITY_HEADERS`) — headers are historical, but keep them in sync when adding fields.

## Store pattern

Each domain has `lib/<domain>-store.ts` (server-only, talks to the supabase shim): `hero-store`, `activities-store`, `coupons-store`, `users-store`, `activity-signups-store`, etc. Stores read/write rows and normalize types from `data/*-types.ts`.

## API pattern

`app/api/**/route.ts` Next.js route handlers. Admin/protected routes take `x-auth-email` header and validate with `isAdminEmail` (from `lib/admin.ts`, compares against `NEXT_PUBLIC_ADMIN_EMAIL` env). Public reads are GET without auth. Member actions (join, claim coupon) POST with `x-auth-email` and validate the user exists.

## Auth

**No Supabase Auth.** Custom scheme: `useAuth` hook (`hooks/useAuth.ts`) keeps the user in `localStorage` (`authUser` key) + a `dearTennis:authChange` event for cross-tab sync. Login/register go through `/api/auth/*`, passwords hashed with Node scrypt (`lib/auth.ts`). All real authorization happens server-side in route handlers — the client email header is trusted only after validating it against the users table.

## Admin pages

`app/admin/<section>/page.tsx` (server component) loads data via a store and renders a `<section>Client.tsx` (client component, usually has localStorage draft-restore). Every admin page is wrapped in `AdminAuthGate` (`app/admin/hero/AdminAuthGate.tsx` — client redirect guard on `isAdminEmail`). Admin navigation lives in `components/layout/Navbar.tsx`: the burger opens a drawer with a grouped accordion (CMS / Activity / Users groups, `ADMIN_NAV_GROUPS` const). Adding an admin page = create the route, then add an entry to the right group in `Navbar.tsx`.

## Public pages

- `/` — landing: sections in `components/sections/*` render from store data, falling back to `data/*.ts` static content.
- `/activities/[id]/[slug]` — activity detail; `[slug]` is cosmetic, `[id]` authoritative. `/activities/[id]` redirects to the slug path. `lib/slug.ts` has `slugify`/`activityPath`.
- `/profile` — member dashboard (charts, skill points, badges, joined activities); `?user=<email>` shows another member (admin view).
- `/invite/[token]` — invite signup flow.

## Env vars

`SUPABASE_URL` (or `NEXT_PUBLIC_SUPABASE_URL`), `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_KEY`), `NEXT_PUBLIC_ADMIN_EMAIL` for admin UI gating.
