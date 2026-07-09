# Frontend — Current State

**Last updated:** 2026-07-09 · **Completion:** Phase 0 in progress (RFE-001, RFE-002 done) + RFE-100 marketing landing done

## Marketing landing page (RFE-100 — done)
`/` now serves a full cinematic landing page (`app/(landing-page)/**`): hero w/ floating glass cards,
animated counters (placeholder numbers — TODO wire to a public stats endpoint), problem/solution story,
7-feature showcase w/ sticky rail, onboarding steps, dark parallax dashboard preview, testimonials,
pricing (TODO source from `GET /plans`), native-`<details>` FAQ + FAQPage JSON-LD, final CTA, footer.
Server Components + thin `motion` client wrappers; bn/en copy complete; reduced-motion safe.
Domain plan: `rakhal.app`=landing · `farm.rakhal.app`=consumer app (host rewrites in `proxy.ts` later) ·
`admin.rakhal.app`=separate project. `/login` + `/register` are placeholders until RFE-006.

## Where things stand
- Repo bootstrapped per `ARCHITECTURE.md` §3: `features/`, `components/{ui,shared,layout}/`, `lib/`,
  `i18n/`, `providers/`, `types/`, `tests/` all created; full RFE-001 dependency set installed.
- **Design tokens + theme + fonts + i18n are live** (RFE-002 done): `app/globals.css` has the full semantic
  token set (light + derived dark), `next-themes` toggle works, `Noto_Sans_Bengali`/`Plus_Jakarta_Sans`
  fonts render correctly, `next-intl` serves `bn` (default) and `en` via a cookie (no URL routing — see
  DESIGN_SYSTEM.md §4). All 4 combinations (light/dark × bn/en) verified live via preview screenshots.
- Full plan + ticket board: [`PROJECT_PROGRESS.md`](PROJECT_PROGRESS.md) (RFE-001…093).
- Engineering rules: [`ARCHITECTURE.md`](ARCHITECTURE.md) (distilled from `D:\Projects\Templates\` docs 02+04).
- Design: [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) — 75 UI screenshots analyzed in
  `D:\Projects\Rakhal\docs\rakhal-ui-analysis.md`; token values still eye-sampled (not pixel-picked Figma).
- Backend: ready & ~64% MVP-complete at `Repos/rakhal-backend` — all pages in Phases 1–3 have live endpoints
  (Swagger `/api/docs`). Known not-built: milk quality (V1.5), report schedules (V1.5), feed mixtures, mobile sync.

## Next task
RFE-003 (API client + auth session layer) → RFE-004 (UI primitives) → RFE-005 (app shell). Single agent
through Phase 0 core; parallelize from RFE-006 onward per the dependency graph in `PROJECT_PROGRESS.md`.

## Known environment issue (this machine — not a code problem)
The shared pnpm store (`D:\.pnpm-store\v10`) has a permission-corrupted file — even `icacls`/`Remove-Item`
as the owning user get **Access Denied**, and it broke hard-linked files inside `node_modules` the same way.
**Workaround in place, do not revert:** this repo's `.npmrc` pins `store-dir=D:/.pnpm-store-rakhal-fe`, a
fresh unaffected store. The original corrupted `node_modules` was renamed (not deleted, couldn't be) to
`node_modules.broken/` — it's gitignored and excluded from `vitest.config.ts`'s test glob; leave it alone,
an admin can `takeown`/delete it later. `pnpm install`/`pnpm add` both work normally now via the new store.

## Blocked / decisions needed
- ~~Figma token extraction~~ **resolved 2026-07-09** — screenshots analyzed; token values are in
  `app/globals.css` now (approximate, pending pixel-confirmation against real Figma access).
- Hosting target (Vercel assumed for PR previews; confirm before RFE-010).
- ~~Bangla numerals vs Latin digits~~ **resolved 2026-07-09** — Latin digits in both locales, lakh money
  grouping in both locales (see DESIGN_SYSTEM.md §4, `lib/format.ts`).
- ~~Locale default/switching~~ **resolved 2026-07-09** — `bn` default, easy topbar switch to `en` (product
  decision); cookie-based (`NEXT_LOCALE`), no URL locale prefix (this is an authenticated app).
- Exact font family match to Figma unconfirmed (ui-analysis.md Q-21) — using Plus Jakarta Sans + Noto Sans
  Bengali as the closest visual match by eye; swap if Figma disagrees.

## Env
Dev backend must run for any data work: Docker Desktop → `rakhal-postgres` + `rakhal-redis` →
`pnpm start:dev` + `pnpm seed` in `Repos/rakhal-backend`. Demo: owner@demo.rakhal.test / DemoPass123,
worker@demo.rakhal.test / WorkerPass123. Swagger: http://localhost:3000/api/docs.
Frontend dev server: `pnpm dev` → `http://localhost:3001` (backend stays on 3000).
