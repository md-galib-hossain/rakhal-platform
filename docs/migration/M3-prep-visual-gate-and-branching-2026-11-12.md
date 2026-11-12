# M3 prep: visual-regression gate design and branching (proposal, nothing built)

Written 2026-11-12 on `migrate/m3-prep`. Companion to `M3-wave1-diff-2026-11-12.md`. Two questions from the
owner session: how to build the fixed-route screenshot gate that `03-shared-ui-dedupe.md` requires, and what base
M3 PRs should use. Both are **proposals for an owner decision**; nothing here was built or pushed.

## 1. The gap

`03` says the visual baseline is "set up once in M2 so the baseline exists before M3 starts". M2 did not add it
(only `web.yml` and the route-parity script). Until it exists, no dedupe PR can honestly pass the gate.

## 2. What the app lets us do (verified in the code)

- The browser never talks to the backend. Client calls go to the app's own BFF (`app/api/backend/[...path]`),
  and server code reads a **single env var, `API_BASE_URL`** (`apps/web/lib/env.ts`, default
  `http://localhost:3005/api/v1`; `lib/auth/session.ts` and `lib/auth/refresh-core.ts` use it for login, CSRF and
  refresh). So any HTTP server that speaks the same envelope can stand in for the backend, including for
  server-side fetches, which Playwright's `page.route()` cannot intercept.
- The dashboard alone calls 12 endpoints (`features/dashboard/api.ts`: priorities, kpis, production-summary,
  calving-forecast, herd-status, livestock-state, financial-snapshot, financial-performance,
  production-vs-feedcost, conception-rate, feed-stock-alerts, upcoming-tasks), all through `apiFetch`.
- Theme is `next-themes` with `attribute="class"` and `defaultTheme="system"`, so Playwright's
  `colorScheme: "light" | "dark"` switches it without touching app code.
- Existing Playwright suite: `apps/web/tests/e2e` (auth, notifications-sheet, sales, axe helper). It logs in
  through the real UI against the real backend and `pnpm seed` data (`loginViaUi`, `DEMO_OWNER`), so **none of it
  runs in CI today**; the repo's own Lighthouse job audits only public routes for exactly this reason (no
  backend, Postgres or Redis in CI). `playwright.config.ts` is `workers: 1`, `chromium` only, starts `pnpm dev`
  on port 3005.
- Not present: any component gallery or `/dev` route, any committed screenshot, any mock server.

## 3. What can run where

| Surface | CI, no backend | Local only (real backend + seed) |
|---|---|---|
| `/login`, `/register`, `/forgot-password`, landing | yes, real app, no data | yes |
| Authenticated shell, dashboard, animals list, form sheet, confirm dialog | **only with a mock API** (below) | yes, but data/time are not deterministic, so needs masking |
| Mobile 375 px, light and dark | yes (viewport and `colorScheme` options) | yes |

## 4. Proposed design

**Tooling (nothing new to download in the repo):** reuse the `@playwright/test` already in `apps/web`
(`expect(page).toHaveScreenshot`, `maxDiffPixelRatio`, `animations: "disabled"`, `page.clock` to freeze time,
`reducedMotion`). CI must install the Chromium browser binary (`playwright install chromium`), as the original
repo's CI would; that is a CI step, not something I added or ran.

**A. Public routes, real app (smallest, cheapest, do first).** `/login` (and the two other auth pages) x
{light, dark} x {desktop, 375 px}. No mock needed. Covers tokens, buttons, inputs, labels, checkbox and fonts.
Already runnable in CI.

**B. Authenticated routes against a stdlib mock API (covers the rest).** A small Node `http` server (no
dependencies, so no new download) listening on a fixed port, started by Playwright's `webServer` next to the
app, with `API_BASE_URL` pointed at it. It serves static JSON fixtures for: `POST /auth/login`, `/auth/csrf`,
`/auth/refresh`, the farm picker, the 12 dashboard endpoints, `GET /cattle` (a fixed list of about 20 animals)
and the endpoints one form sheet and one confirm dialog need. Rough size: 20 to 30 endpoints of static JSON, not
a re-implementation of the backend (an estimate; count them when building). Fixture shapes should come from the
generated OpenAPI types (`@rakhal/api-client` and the response schemas typed under RD-140, now 224 operations),
so a backend change shows up as a type error instead of a stale fixture. Route set for the gate: login,
dashboard, animals list, the "add animal" form sheet open, a confirm dialog open (archive or delete), each at
desktop and 375 px, light and dark: 5 routes x 2 sizes x 2 themes = 20 screenshots.

**C. Local full-fidelity run.** The same specs, pointed at a real backend and `pnpm seed` data, for the owner
or an agent before a risky PR. Not a gate (data and clocks drift); useful for spot checks. Mask clocks, relative
dates and charts.

**D. Not recommended: a component gallery.** A `/dev/ui` page would cover primitives deterministically, but it
must live in `apps/web` to exercise web's real tokens and Tailwind source scanning (the likeliest regression is
a missing `@source` for `packages/ui`), and it would add a route to the 49-route baseline and to the route-parity
check. Tier B covers the same components in their real composition.

**Where the baseline lives.** Do not commit PNGs generated on Windows: Windows and Linux render text and
anti-aliasing differently, so a Windows baseline fails on a Linux runner. Instead the CI job builds the **base
ref** and the **PR head** on the same runner, runs the specs with `--update-snapshots` against the base, then
runs them against the head and compares. No binaries in git, and no OS drift. Cost: two builds per run
(about 6 minutes each today); path-filter it so it runs only for PRs touching `packages/ui/**`, `apps/web/**`
or `turbo.json`. Thresholds: start strict (`maxDiffPixelRatio` about 0.001) and loosen only with evidence.

**Order of work (all small):** (1) mock server and fixtures for login + dashboard, (2) the 20 specs,
(3) the compare job in `web.yml` or a sibling `visual.yml`, (4) add the axe checks the gate already asks for.
Estimate: a few days, dominated by fixtures. Tier A alone would protect `button`, `label` and `checkbox` (login
uses them) but not `badge`, `card`, `skeleton`, `switch`, `radio-group` or `textarea` in realistic use, so
**tier B is needed before wave 1 is meaningfully protected.**

## 5. Branching: where M3 PRs go (recommend, do not decide)

Facts: PR #1 (`migrate/web` -> `main`, draft) holds M1 and M2. CI on it is green (CI run 43268471969, Web run
43268472214). The original repo is still the source of truth through M5 and received about 39 commits in the
last 30 days into `apps/web`'s paths.

| Option | For | Against |
|---|---|---|
| (a) Stack M3 on `migrate/web` while PR #1 stays open | `main` stays untouched; nothing lands until the owner is ready | PR chain gets deep; two long-lived branches to rebase; `web.yml` and `ci.yml` trigger on `pull_request` (any base) and on push to `main`, so a stacked PR still gets CI, but required-check rules and the "compare against base" gate would diff against the stack, not `main` |
| (b) Merge PR #1 first, then branch M3 PRs off `main` | normal flow (PR to `main`, required checks); history is already in `main`; later re-imports merge into one place | `main` then contains a second copy of the web app that is not deployed and not authoritative; the mirror process must exist before merging (re-imports now land on `main`) |

**Recommendation: (b), conditional on deciding the mirror owner and cadence first.** Reason: the visual gate
compares a PR head against its base, and a clean `main` base keeps that comparison meaningful; (b) is also the
standard flow and keeps PRs small. The merge deploys nothing (M5 is the first deploy), so the risk is process,
not production. If the owner does not want to answer the mirror question yet, (a) is a workable fallback.

## 6. Owner decisions needed

1. Approve the gate design: tier A + B in CI, tier C local, baseline built in CI from the base ref (no PNGs in
   git). Alternative: commit Linux-generated PNGs.
2. Branching: (a) or (b) above. Note (b) is blocked on 3.
3. **Mirror owner and cadence** (still open): who re-imports original-repo commits into `apps/web`, how often,
   and whether the original is frozen during M3.
4. Whether admin may pick up web's `--font-sans` (Bengali fallback) when the token split happens.

Still open and not assumed: `tok.json` handling in the backend; the M5 staging story.
