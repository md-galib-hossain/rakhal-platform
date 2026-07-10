# Frontend — Current State

**Last updated:** 2026-07-10 · **Completion:** Phase 0 core done (RFE-001…007, RFE-009) + RFE-100 marketing landing done

## Testing harness (RFE-009 — done)
Playwright E2E layer built against RFE-006's real auth pages — the first pages with real logic to test.
`tests/e2e/utils.ts` (`loginViaUi()` drives the real multi-farm-picker login flow, `formLevelAlert()`,
a locale-pinning `en` fixture since the app defaults to `bn`), `tests/e2e/axe.ts`, `tests/e2e/auth.spec.ts`
(10 specs: login smoke, error mapping, register/forgot/reset/verify-email flows, protected-route redirect,
a11y). `playwright.config.ts` tuned (`workers:1`, `timeout:60_000`) after diagnosing that full parallelism
reliably timed out against `next dev`'s on-demand Turbopack compilation. **9/10 passing live against the
real dev backend**; the 10th is a genuine WCAG AA finding on `/login` (color-contrast on the `#00a86b`
brand green + missing `<main>` landmark) — left red on purpose rather than weakened, background task
spawned for the fix (owned by whoever picks up `app/globals.css`/`auth-shell.tsx` next). Gate green
(lint/typecheck/build/18 unit tests). RFE-010 (Lighthouse CI) can build on this Playwright setup.

## Auth pages (RFE-006 — done)
All 5 public auth pages built against the **real backend contract** (email+password + token-link email
verification/reset — not the PRD's aspirational phone/OTP flow, same gap RFE-003 already flagged):
`/login` (redesigned with real UI primitives, farm-picker for multi-farm accounts), `/register`
(→ "check your email"), `/forgot-password` (→ always-success, no enumeration), `/reset-password`
(`?token=`), `/verify-email` (`?token=`, auto-verifies on mount). Shared `AuthShell` (split branding+form
panel, built PRD-spec since no Figma auth frames exist) + a new `components/shared/locale-toggle.tsx`.
**Verified live end-to-end** against the real backend for every flow incl. error/invalid-token/missing-
token states, dark theme, and mobile. Gate green (lint/typecheck/build/18 unit tests).
**Found + fixed two live backend bugs while verifying** (backend `IN_FLIGHT.md`/`TECH_DEBT.md` have the
full writeup — not duplicated here): a Prisma enum gap that crashed the **entire backend process** on
every forgot-password request (migration `email_template_password_reset`), and a `proxy.ts` gap where
`/verify-email` wasn't in the public-paths allowlist (fixed in this repo). Filed **RD-034** for the
underlying systemic issue (event listeners with no error boundary) and spawned a background task for it.
Playwright E2E for these flows is deferred to whichever ticket builds the harness (RFE-009, not started).

**Pixel-exact visual pass (2026-07-10)** — Figma access landed (official plugin, user OAuth'd). Rebuilt
all 5 auth pages against the real "Sign In"/"Sign Up"/"Reset Password"/"Set New Password" Figma frames
(file `SCfMPdxP6vgW1uTxfqCtz7`): `AuthShell` form panel moved to the **left** (Figma order — was right),
exact 453px card chrome, new `components/ui/floating-input.tsx` (floating-label inputs), real hero
photo/wordmark downloaded to `public/auth/**` (Figma asset URLs expire in 7 days), a `confirmPassword`
field added to reset-password to match Figma's two-field layout. **Confirmed the real brand primary is
`#00A86B`/`#00774C`** — swapped app-wide in `app/globals.css` (was the RFE-002 eye-sampled `#16a34a`). No
Figma frame exists for verify-email (prototype uses OTP, this backend doesn't) — left on shared chrome
only. Full writeup: `PROJECT_PROGRESS.md` RFE-006 entry + `DESIGN_SYSTEM.md` §4. **Verified live**:
light/dark theme × bn/en locale × desktop (1280px)/mobile (375px), no console errors. Gate green
(lint/typecheck/build/18 unit tests).

## Profile & session self-service (RFE-007 — done, rescoped)
Real `/profile` page wired to the actual backend, not `Rakhal_API.md`'s aspirational shape — verified
against `auth.controller.ts` directly. **Backend gap found:** `PATCH /auth/me` (generic), `PATCH
/auth/me/on-duty`, `PATCH /auth/me/pin`, and `POST /auth/switch-organization` don't exist server-side at
all (zero matches grepping `src/`); only `PATCH /auth/me/language` is real, alongside `GET /auth/me`,
`GET /auth/sessions`, `DELETE /auth/sessions/:id`, `POST /auth/logout-all`. Built: account-info card,
a language card that persists to the backend and flips the local UI-locale cookie together, and a
sessions card (list/revoke/logout-all, current-device badge from the session's JWT `sessionId`).
Logout-all needed a new bespoke `/api/auth/logout-all` BFF route (CSRF+cookie dance, mirrors
`/api/auth/logout`) since it needs `CsrfGuard` and the generic `/api/backend` proxy doesn't attach CSRF
tokens. The shell's on-duty switch (`user-menu.tsx`) stays disabled — there is genuinely nothing to wire
it to. Gate green (lint/typecheck/build/test); **live browser smoke test not done this session** — RFE-006
held the Next.js dev-server lock on this tree throughout, so verification is still owed once that frees up.

## App shell (RFE-005 — done)
`(app)/layout.tsx` now wraps every authenticated route in a real `AppShell` (`components/layout/**`):
desktop fixed Sidebar (OrgSwitcher + 15-item module nav + Upgrade banner) that becomes a Sheet-based
mobile drawer via the topbar's hamburger button, Topbar (⌘K search palette placeholder, notification
bell placeholder, theme toggle, avatar menu with on-duty switch/profile/settings/language-toggle/logout).
All 18 module route folders got a stub `page.tsx` + `loading.tsx` + `error.tsx`; root + in-shell
`not-found.tsx`. **Verified live** against the real backend: login → farm picker → dashboard inside the
real shell → navigated into `/cattle` (stub renders) → dark theme toggle → resized to mobile, opened the
Sheet nav, closed it — no console errors anywhere. **OrgSwitcher is read-only for now** — flagged, not
guessed: the backend only returns the farm list during the login bootstrap step, there's no confirmed
"list my farms while logged in" GET endpoint (only `POST /auth/switch-organization`, which needs an id we
don't have post-login). **Local-dev gotcha found while verifying:** `rakhal-backend`'s `.env` now has
`PORT=5000`, not the `3000` every doc (including `.env.example`) still assumes — this repo's `.env`
`API_BASE_URL` was pointed at `:5000` to match; someone should reconcile the backend docs/env.

**Pixel-exact visual pass (2026-07-10)** — pulled the real Figma "Dashboard" frame's Navbar (`732:1659`)
and topbar (`732:1695`) and rebuilt `AppShell`: sidebar + topbar are now two separate floating rounded
cards on a shared page gutter (was flush full-bleed). Dark-green sidebar pixel-confirmed `#055640`
(was eye-sampled `#0b5137`), white pill `OrgSwitcher`, MENU/OTHERS nav sections (`nav-items.ts` gained a
`section` field — the Figma prototype only pictures 9 of our 15 modules, Buyers/Reproduction/Calves/
Reports slotted into MENU rather than dropped), pill active-state, white circular topbar icon buttons.
**Also fixed the RFE-009-flagged WCAG AA contrast finding**: swapped `text-primary` (3.23:1, fails) to
`text-primary-hover` (5.53:1, passes — matches Figma's own text-vs-button color split) on auth link text,
and added the missing `<main>` landmark to `AuthShell`. Verified live: full login flow, light/dark,
desktop/mobile incl. Sheet nav, route navigation with correct active-state, no console errors. Gate green.
Full writeup: `PROJECT_PROGRESS.md` RFE-005 entry + `DESIGN_SYSTEM.md` §4.

## UI primitives + shared composites (RFE-004 — done)
Full `components/ui/**` inventory built on top of the existing `button.tsx`: Input, Textarea, Label,
Select, Checkbox, RadioGroup, Switch, Dialog, Sheet, DropdownMenu, Popover, Tooltip, Tabs, Badge, Card,
Table, Avatar, Progress, Separator, Skeleton, Calendar (`react-day-picker`), Combobox, Command (`cmdk`),
and a `sonner` `Toaster` (now the single source of truth — replaced the inline `ThemedToaster` that used
to live in `providers/app-providers.tsx`, which also now wires `NuqsAdapter` since FilterBar/DataTable need
it). All semantic-token-only, no raw hex. `components/shared/**`: DataTable (TanStack Table, cursor "load
more" pagination, URL-synced single-column sort via nuqs, row selection for bulk ops, mobile
card-collapse, all 4 states), PageHeader, StatCard, ChartCard, EmptyState/ErrorState/TableSkeleton/
CardSkeleton, ConfirmDialog, FilterBar (300ms-debounced search + select filters, URL-synced), FileUpload
(drag/drop, type/size validation, image preview, upload progress), FormDialog/FormSheet (dialog/sheet
chrome only — the caller owns its own RHF+zod form), MoneyText/DateText (locale-aware, wrap
`lib/format.ts`), CattlePicker (search-select over `GET /cattle`). 11 component tests (DataTable,
FormDialog, FilterBar) all green using `nuqs/adapters/testing`. **Axe/Lighthouse checks deferred** — no
real pages or Playwright e2e harness exist yet to run them against meaningfully (RFE-005/009 build those);
flagged rather than faked. Gate green: lint (0 errors, 1 known non-blocking TanStack-Table React-Compiler
warning) / typecheck / test / build all pass.

## Auth / API / session layer (RFE-003 — done)
Full BFF auth flow **verified live in the browser against the real running backend**: login (bootstrap
farmId → farm picker, demo owner has 5 farms) → farm select → httpOnly session cookies on our own domain
(`rk_at`/`rk_rt`/`rk_user`, never the backend's tokens directly) → `/dashboard` renders real session data
+ a real backend fetch → logout → gate redirects to `/login` again. See `lib/auth/session.ts`,
`lib/auth/refresh-core.ts` (shared by `next/headers`-based Route Handlers and `proxy.ts`'s
`NextRequest`/`NextResponse` cookies — different APIs, same HTTP logic), `lib/api/client.ts` (client fetch
→ generic `/api/backend/[...path]` proxy) + `lib/api/server-fetch.ts` (RSC direct-to-backend fetch).
**Real backend contract differs from the cross-repo template docs** — flat error envelope, no per-field
validation `details[]`, cursor meta shape — all documented in `types/api.ts`'s header comment and
PROJECT_PROGRESS.md's RFE-003 entry. **Both backend gaps found here are now fixed (2026-07-10, RAKHAL-259/260,
fixed directly in `rakhal-backend` this session):** `GET /auth/me` no longer leaks `passwordHash`, and now
returns a real `permissions: string[]`. `<Can/>`/`useCan()` consume it via `/api/auth/session` →
`serverFetch('/auth/me')` — **verified live** as `["*"]` for the demo owner.

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
RFE-005 and RFE-007 are done. RFE-006 (auth pages) is in progress. Remaining Phase 0: RFE-008
(subscription context/upgrade UX), RFE-009 (testing harness + seeds), RFE-010 (CI + Lighthouse gate) —
all parallel-safe now per IN_FLIGHT.md's protocol §6. Live browser verification of RFE-007 is still owed
once the dev-server lock frees up.

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
