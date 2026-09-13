# Architecture

Dear Tennis — tennis community website. **Next.js 16 App Router + TypeScript + Tailwind CSS 4 + Supabase (Postgres)**, migrated from an earlier Google Sheets + static-HTML iteration. `profile.md` (dashboard PRD), `PRD.md` (marketing PRD, Indonesian), `PRODUCT.md` (shipped vs. planned) describe intent; this file and the code are truth.

## High-level shape

```
Browser (React 19, client components)
   │  fetch /api/*, custom header x-auth-email
   ▼
Next.js server (app/api/**/route.ts)          app/ pages (server-rendered)
   │  route handlers validate admin via        │
   │  ADMIN_EMAIL match                        ▼
   ▼                                       components/{sections,ui,layout,admin,profile}
lib/*-store.ts  (per-domain data stores, in-memory cache, bundled fallbacks)
   ▼
app/lib/supabase.ts  (thin shim: same function names the old Sheets layer had)
   ▼
Supabase Postgres — service role key, tables 1:1 with old sheet names
```

## Data layer

- **`app/lib/supabase.ts`** — drop-in replacement for the retired Google Sheets client. Same signatures (`listRowsBySheet`, `createRowWithId`, `updateRowById`, …) so `lib/*-store.ts` and routes never changed. Connects with `SUPABASE_SERVICE_ROLE_KEY` (bypasses RLS); single cached client on `globalThis` to survive hot reloads/serverless. `getSpreadsheetId()` is now just an env check returning `'supabase'`.
- **`supabase/schema.sql`** — full schema. Every table: `"id"` text PK (UUID, or `'current'` for single settings rows), `seq` bigint identity preserving arrival order, camelCase quoted columns matching store object keys. RLS enabled with no policies → deny-all except service role.
- **`lib/*-store.ts`** (~20 stores: `hero`, `activities`, `coupons`, `activity-signups`, `users`, …) — each owns one domain: read/write helpers, a `globalThis` Map cache with TTL, `ensureSheetWithHeaders`-style lazy creation, and fallback to bundled defaults in `data/` when Supabase is unset. Admin writes call `clear*Cache()` after mutation.

## API layer (`app/api/**/route.ts`)

- Route files export only HTTP method handlers (Next requirement).
- **Public GETs** read through stores (`/api/hero`, `/api/activities`, `/api/faq`, …). **Mutations** are dispatched by a `kind` field in the JSON body (`settings` / `slide` / `reorder` / `delete`) — one POST endpoint per domain.
- **Admin authorization**: no session/cookie system. The client keeps the logged-in email in `localStorage` and sends it as an `x-auth-email` header; the route compares it against `ADMIN_EMAIL` (`isAdminEmail` in `lib/admin.ts` client-side mirror, per-store server-side). `/api/admin/*` additionally checks the user's `role` column.
- **Auth**: `/api/auth/register` + `/api/auth/login`. Passwords hashed with Node `scrypt` + per-user 16-byte salt (`lib/auth.ts`), stored in `users` table. Login rate-limited per-process (10/min per IP). Admin user self-seeds on first login attempt (`lib/seedAdmin.ts`).
- `/api/proxy-image` routes Unsplash images through the server (avoids client referer restrictions).

## Frontend structure

- **Public pages**: `/` (landing, section components in `components/sections/`), `/activities/[id]` and `/activities/[id]/[slug]`, `/login`, `/profile` (training dashboard, `components/profile/`), `/invite/[token]`.
- **Admin pages** `app/admin/*` (~15 editors: hero, gallery, coupons, users, activity-signups, …) — one editor per store, Indonesian UI copy, shared primitives in `components/admin/` and `components/ui/` (`Button`, `JoinConfirmDialog` modal pattern).
- **UI**: Tailwind 4 with theme tokens — paprika `#E85D04` accent, hunter-green `#2C5F4B` primary, card idiom `rounded-2xl border border-light-gray bg-white`. All imagery Unsplash URLs via `next/image`; no local assets.
- Legacy static HTML (`index.html`, `login.html`, `profile.html`) and `test-server.py` are dead; edit `app/` only.

## Env vars

`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (data layer), `ADMIN_EMAIL` (server) + `NEXT_PUBLIC_ADMIN_EMAIL` (client UI gating), plus optional `nodemailer` SMTP settings for invites.

WhatsApp chatbot (WAHA → Groq → WAHA): `WAHA_BASE_URL`, `WAHA_WEBHOOK_SECRET` (webhook `/api/webhook/waha` stays 503-closed without it), `WAHA_SESSION` (default `default`), optional `WAHA_API_KEY`, `GROQ_MODEL` (default `llama-3.3-70b-versatile`). Groq keys are admin-managed rows in the `groq_keys` table (`/admin/groq`), not env. Bot tables: `wa_messages` (chat both sides), `groq_keys`, `groq_logs` (every attempt: key, status, duration). Groq calls run through an in-process global FIFO queue with key rotation on 429 (`lib/groq-client.ts`).

## Commands

`npm run dev` (webpack), `dev:turbo`, `build`, `typecheck` (run after changes — there are **no tests**), `lint`.
