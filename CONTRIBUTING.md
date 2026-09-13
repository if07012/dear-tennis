# Contributing

Dear Tennis — Next.js 16 App Router + TypeScript + Tailwind CSS 4 + Supabase (Postgres). Read `ARCHITECTURE.md` first; PRD files (`PRD.md`, `profile.md`) are intent, code is truth.

## Workflow

1. Branch from `master`. `master` is the PR target; feature branches only.
2. Before pushing: `npm run typecheck` (there are **no tests** — typecheck is the gate) and `npm run lint`. Both must pass.
3. Keep PRs small and single-purpose. One feature or one fix per PR.
4. Don't commit `tsconfig.tsbuildinfo` deliberately (changes on every typecheck; only alongside real changes). Never commit `.env` — Supabase service role key lives there.

## Where things go

- `app/api/**/route.ts` — API routes. Must export **only** HTTP method handlers (Next requirement).
- `lib/*-store.ts` — one file per data domain. Follow the existing pattern: read/write helpers, `globalThis` cache with TTL, `clear*Cache()` after admin writes, fallback to bundled `data/` defaults.
- `data/*-types.ts` — shared types + bundled fallback content. Stores and components import from here; types are the contract.
- `components/sections/` public landing · `components/ui/` primitives · `components/layout/` Navbar/Footer · `components/admin/` admin-only shared · `components/profile/` dashboard.
- New table → add to `TABLES` set in `app/lib/supabase.ts` **and** `supabase/schema.sql` (append-only migration style: `CREATE TABLE IF NOT EXISTS`, optional columns nullable).

## Patterns to follow

- **Mutations**: one POST route per domain, dispatched by `kind` in the JSON body (see `app/api/hero/route.ts`). Admin check via `isAdminEmail` comparing `x-auth-email` header to `ADMIN_EMAIL` — no session system.
- **Reuse over new**: shared modal/confirm patterns exist (`components/ui/JoinConfirmDialog.tsx`) — don't build new dialogs for the same job. Stdlib first (`lib/auth.ts` uses Node `crypto` scrypt, not a dependency).
- **Styling**: brand palette tokens — paprika `#E85D04` accent, hunter-green `#2C5F4B` primary. Card idiom `rounded-2xl border border-light-gray bg-white`. No inline hex when a token exists.
- **Imagery**: Unsplash URLs via `next/image`. No local assets.
- **Language**: admin UI copy is Indonesian ("Simpan", "Batal", "Hapus"); public copy mixes English/Indonesian — match the surrounding page.
- Comments in the style of existing files: block header naming the module and its schema.

## Gotchas

- Windows PowerShell: paths with `[id]`/`[slug]` are wildcards — always `Move-Item -LiteralPath` for bracketed paths.
- `npm run dev` uses webpack (turbopack is `dev:turbo`); don't switch the default without checking.
- This Next.js has breaking changes vs. older training data — check `node_modules/next/dist/docs/` before using unfamiliar APIs.
- Legacy static HTML (`index.html`, `login.html`, `profile.html`) is dead — edit `app/`, never those.
- `@gsap/react`, `lenis`, `framer-motion` are declared but largely unused; don't assume imports resolve to used code.

## Commit messages

Short imperative subject line. Reference the feature area (`admin/coupons: …`, `api: …`) when it's not obvious from the diff.
