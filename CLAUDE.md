# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Dear Tennis — a static, client-only tennis community website. Three HTML pages (`index.html` landing, `login.html` auth, `profile.html` member dashboard with gallery/lightbox) share one stylesheet and one of two JS files. No backend, no build step, no test suite, no linter.

`profile.md` is the Product Requirements Document (PRD) for the **Tennis Training Progress Dashboard** — the eventual feature set the site is heading toward (overall score, skill radar, fault analysis, achievements, goal tracking, coach notes, export). Many PRD items are not yet implemented in code; treat the PRD as the source of truth for intended behavior when extending functionality.

## Common Commands

The repo is a hybrid: a static HTML site (`index.html`, `login.html`, `profile.html` at the root) AND a Next.js 16 app (`app/`, `components/`, `data/`, `hooks/`, `lib/`). The `package.json` is the Next.js one; the static pages don't import from it.

Run a local dev server (only meaningful for `login.html` / `profile.html` which use modules / fetch-style assets via relative paths):

```
python test-server.py    # serves the repo root at http://localhost:8080 (static only — no /api)
npm run dev              # Next.js dev server at http://localhost:3000 (static pages AND /api routes)
```

The login page's "check user" flow (`POST /api/auth/login`) only works under `npm run dev` because it needs the Next.js API routes. Under `python test-server.py` the fetch will fail and the page will show a clear error.

There is no test command. `npm run typecheck` runs `tsc --noEmit`. To work on a single static page, edit the HTML file directly and reload in a browser.

## Architecture

**Static HTML site, vanilla JS, single shared CSS.**

- `index.html` (≈661 lines) — landing page: nav, hero, about, why-join, activities, events, gallery, testimonials, FAQ, CTA, footer. Loads `js/main.js`.
- `login.html` (≈554 lines) — auth UI with GSAP-driven entry animations, particle background, and a cursor-glow effect. Loads `https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js` then `js/login.js`.
- `profile.html` (≈3130 lines) — member dashboard. Loads Chart.js from CDN and contains its JavaScript inline at the bottom of the file (gallery rendering, lightbox, event data, lightbox controls). This file mixes markup and scripts.
- `css/styles.css` (≈1888 lines) — single stylesheet shared by all three pages. Uses CSS custom properties (Inter + Playfair Display from Google Fonts). Long file; sections are delimited by banner comments (`/* ===== NAVIGATION ===== */`, etc.).
- `js/main.js` (≈622 lines) — landing-page behavior: navbar scroll state, mobile menu toggle, smooth-scroll anchors, scroll-reveal via IntersectionObserver, FAQ accordion, a `DearTennis` global with `scrollTo`, plus `debounce` / `throttle` utilities.
- `js/login.js` (≈483 lines) — login-page behavior: particle generator, cursor-glow tracker (rAF interpolation), GSAP timeline entrance, password visibility toggle, form validation, social-login buttons.

**Cross-page navigation links** between pages use relative paths (`index.html#section`, `login.html`, `profile.html`). Internal anchor links within a page assume an 80px fixed-navbar offset (see `js/main.js` smooth-scroll).

**Animation stack** — GSAP (via CDN on `login.html` only), CSS keyframes for the particle background and gradient animations, IntersectionObserver for scroll reveals. `@gsap/react`, `lenis`, and `framer-motion` are declared in `package.json` but not used anywhere in the current source.

## Conventions

- Each JS file wraps its work in a single `DOMContentLoaded` listener. Utility functions (`debounce`, `throttle`) sit outside the listener at the bottom of `js/main.js` and a small `window.DearTennis` namespace exposes `scrollTo(id)`.
- Styles use BEM-ish class names (`.nav-link`, `.btn-primary`, `.gallery-item`). Section banners in `styles.css` follow `/* ============= SECTION NAME ============= */`.
- All imagery is loaded from Unsplash CDN URLs — there is no local asset folder. When adding images, prefer the same Unsplash pattern.
- `profile.html` uses inline `<script>` with template literals to render event/gallery cards and a lightbox; event data lives at the top of the script block. Keep new dashboard logic inline unless it crosses pages.
- Brand palette appears in `styles.css` CSS variables — preserve when restyling. Primary accent is `#E85D04`, secondary `#2C5F4B`.

## Gotchas

- `dear-tennis/` subdirectory is empty — ignore it.
- `node_modules/` and `package-lock.json` are committed but unused by shipped HTML; they appear to track an unused future stack. Do not assume `import` statements will resolve.
- `login.html` loads GSAP from a CDN with a fixed version (`3.12.2`); `index.html` and `profile.html` do not load GSAP at all.
- `profile.html` is large and mixes markup with ~600 lines of inline JS — read in chunks before editing.
- There is no `.gitignore` rules file with substantive entries; `node_modules/` is committed intentionally (or overlooked).
- No README, no Cursor rules, no Copilot instructions exist in the repo.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
