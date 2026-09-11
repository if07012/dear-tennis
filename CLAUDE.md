# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Dear Tennis — tennis community website. **Next.js 16 App Router + TypeScript + Tailwind CSS 4 + Supabase (Postgres)**. Legacy static HTML pages (`index.html`, `login.html`, `profile.html` at repo root) still exist from an earlier iteration and are superseded by the app pages — edit `app/`, not the HTML files, when changing behavior.

`profile.md` is the PRD for the Tennis Training Progress Dashboard (intended feature set); `PRD.md` is the older marketing-site PRD (Indonesian); `PRODUCT.md` is the working product summary (shipped vs. planned). `ARCHITECTURE.md` covers the technical architecture. Treat PRDs as intent, code as truth.

## Commands

```
npm run dev          # dev server http://localhost:3000 (webpack)
npm run dev:turbo    # dev server (turbopack)
npm run build        # production build
npm run typecheck    # tsc --noEmit  ← run this after changes; there are NO tests
npm run lint         # next lint
```

`python test-server.py` serves only the legacy static HTML — ignore unless explicitly asked.

## Architecture

See `ARCHITECTURE.md` — data layer (supabase shim, append-only migrations), store/API/auth patterns, admin/public page structure, env vars.

## Conventions

- Brand palette in Tailwind theme: paprika `#E85D04` (accent), hunter-green `#2C5F4B` (primary). Text/graphite/dark-gray hierarchy + off-white backgrounds. Follow existing `rounded-2xl border border-light-gray bg-white` card idiom.
- Admin UI copy is Indonesian ("Simpan", "Batal", "Hapus"); public copy mixes English/Indonesian — match the surrounding page.
- Shared modal/confirm patterns exist (`components/ui/JoinConfirmDialog.tsx`); reuse instead of new dialogs.
- Imagery: Unsplash URLs, no local assets. Next `<Image>` used throughout.
- Component files: `components/sections/` (public landing), `components/ui/` (primitives), `components/layout/` (Navbar/Footer), `components/admin/` (admin-only shared), `components/profile/` (dashboard).

## Gotchas

- **PowerShell**: paths with `[id]`/`[slug]` segments are wildcards — always `Move-Item -LiteralPath` / `-Path` won't work; use `-LiteralPath` for any bracketed path.
- **Next.js version quirk**: `dev` script uses `--webpack`; turbopack is `dev:turbo`. Don't switch the default without checking.
- This Next.js version has breaking changes vs. older training data — consult `node_modules/next/dist/docs/` before using unfamiliar APIs.
- Route files (`route.ts`) must not export anything besides the HTTP method handlers.
- `tsconfig.tsbuildinfo` is tracked; it changes on every typecheck — don't commit it deliberately (it's noise, commit only alongside real changes).
- `dear-tennis/` subdirectory is empty — ignore it.
- `@gsap/react`, `lenis`, `framer-motion` are declared in package.json but largely unused; don't assume imports resolve to used code.

## CodeGraph

In repositories indexed by CodeGraph (a `.codegraph/` directory exists at the repo root), reach for it BEFORE grep/find or reading files when you need to understand or locate code:

- **MCP tool** (when available): `codegraph_explore` answers most code questions in one call — the relevant symbols' verbatim source plus the call paths between them, including dynamic-dispatch hops grep can't follow. Name a file or symbol in the query to read its current line-numbered source.
- **Shell** (always works): `codegraph explore "<symbol names or question>"` prints the same output.

If there is no `.codegraph/` directory, skip CodeGraph entirely — indexing is the user's decision.
