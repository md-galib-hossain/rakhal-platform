# Rakhal Consumer Frontend — Project Progress (source of truth)

> Ticket registry for the farm-facing web app. Numbering: **RFE-NNN** (never reuse a number; append-only).
> Before picking a ticket: read `docs/IN_FLIGHT.md` (claim it there), `docs/ARCHITECTURE.md` (rules),
> `docs/DESIGN_SYSTEM.md` (design input protocol). Definition of Done: `ARCHITECTURE.md` §8.
>
> **Spec refs:** `API` = section in `D:\Projects\Rakhal\docs\Rakhal_API.md` (+ its PAGE-TO-API table) ·
> `PRD` = section in `D:\Projects\Rakhal\docs\Rakhal_PRD_v3_Complete.md` · Swagger `/api/docs` overrules both.
> **Design:** `Figma` = frame needed (per DESIGN_SYSTEM.md §1 protocol) · `PRD-spec` = no design exists,
> PRD is the spec, build with established tokens/components.

**Last updated:** 2026-07-09 · **Status legend:** `TODO` · `IN-PROGRESS` (must have an IN_FLIGHT row) · `DONE` · `BLOCKED`

---

## Phase 0 — Foundation 🏗️ (mostly serial; blocks everything below)

#### RFE-001 — Repo bootstrap & tooling
- **Depends:** — · **Lane:** root config (exclusive — nothing else runs in parallel with this)
- Restructure the fresh scaffold to `ARCHITECTURE.md` §3 (create `features/`, `components/`, `lib/`, `i18n/`,
  `providers/`, `types/`, `tests/`). Add deps (latest): `@tanstack/react-query`, `@tanstack/react-table`,
  `react-hook-form`, `@hookform/resolvers`, `zod`, `next-intl`, `next-themes`, `nuqs`, `sonner`,
  `lucide-react`, `radix-ui` primitives as needed, `recharts`; dev: `vitest`, `@testing-library/react`,
  `@playwright/test`, `eslint-plugin-jsx-a11y`, `axe-playwright`. Scripts: `typecheck`, `test`, `test:e2e`.
  `env.ts` (zod-validated `NEXT_PUBLIC_API_URL` etc.) + `.env.example`. ESLint: `import/no-cycle`, a11y.
- **AC:** `pnpm lint`/`typecheck`/`build` green on the skeleton; README quickstart ≤10 commands.
- **Status:** `DONE` (2026-07-09) — folders + all listed deps installed; `lib/env.ts` (zod), `.env.example`,
  `lib/utils.ts` (`cn`), scripts (`typecheck`/`test`/`test:watch`/`test:e2e`), `vitest.config.ts` +
  `playwright.config.ts`, ESLint `import/no-cycle` + full jsx-a11y recommended rules merged into
  `eslint-config-next`'s existing plugin registrations (can't re-register a plugin name in flat config —
  see `eslint.config.mjs` comments). `next.config.ts` pins `turbopack.root` (an unrelated lockfile one level
  up was being auto-detected). Gate green: lint/typecheck/build/test all pass. **Known environment issue**
  (not code, see `CURRENT_STATE.md`): this machine's shared pnpm store had a permission-corrupted file
  blocking all installs — worked around with a project-local `.npmrc` store-dir; do not revert it.

#### RFE-002 — Design tokens + theme + fonts + i18n scaffold
- **Depends:** RFE-001 · **Lane:** `app/globals.css`, `i18n/**`, `providers/**` · **Design:** Figma (palette/type frames) → else placeholder tokens flagged for swap
- Tailwind v4 `@theme` token set (DESIGN_SYSTEM.md §2), `.dark` overrides, next-themes provider;
  `next/font` with Noto Sans Bengali + Latin companion (subset, swap); next-intl wired (`bn` default, `en`),
  `messages/bn.json` + `en.json` skeletons; `lib/format.ts` (৳ money, dates, numbers per locale).
- **AC:** theme toggle works; both locales render; tokens documented in DESIGN_SYSTEM.md §4.
- **Status:** `DONE` (2026-07-09) — full token set in `app/globals.css` (light+derived dark, `.dark` class
  strategy via `next-themes`); `Noto_Sans_Bengali` + `Plus_Jakarta_Sans` via `next/font/google`; next-intl
  wired **without URL routing** (cookie-based locale — this is an authenticated app, not per-locale
  marketing pages; see DESIGN_SYSTEM.md §4 for why); `bn` default confirmed by product; **numerals are
  Latin in both locales** and **money groups as lakhs in both locales** (resolves ui-analysis.md Q-2/D-4 —
  see `lib/format.ts` + `docs/ARCHITECTURE.md` §4). AC verified live via preview screenshots (light/dark ×
  bn/en, all 4 combinations render correctly). Full spec in DESIGN_SYSTEM.md §4.
  ⚠️ **Not yet pixel-confirmed against Figma** (values are screenshot-sampled) — swap when Figma access exists.

#### RFE-003 — API client + auth session layer
- **Depends:** RFE-001 · **Lane:** `lib/api/**`, `lib/auth/**`, `app/api/**`, `proxy.ts`, `types/api.ts`
  (⚠️ Next.js 16 renamed `middleware.ts` → `proxy.ts`, same semantics — confirmed in the bundled docs)
- `lib/api/client.ts` (envelope unwrap → `ApiError`; sends `Accept-Language`; cursor-pagination helpers),
  `lib/api/errors.ts` (backend code map: 401 refresh-once→logout, 403 toast, 422→form fields, 429 backoff).
  Auth BFF bridge per ARCHITECTURE.md §5: login (bootstrap-farm two-step), refresh single-flight, logout,
  CSRF handling; httpOnly cookies on our domain; `proxy.ts` coarse gate; `useSession()` +
  `lib/auth/permissions.ts` (`can()`, `<Can/>` — strings from backend RBAC catalogue).
- **AC:** unit tests for error mapping + refresh single-flight; login→me→refresh→logout proven against live dev backend.
- **Status:** `DONE` (2026-07-10) — **verified live end-to-end in the browser** against the real running
  backend (not curl-only): unauthenticated `/dashboard` → `proxy.ts` redirects to
  `/login?next=%2Fdashboard` → login form (bootstrap farmId) → farm picker (demo owner has 5 farms) →
  select farm → session cookies set → `/dashboard` renders real session data (`getSession()`) **and** a
  real backend fetch (`serverFetchPage('/cattle')`, real cursor `meta`) → Log Out → redirect to `/login`,
  httpOnly cookies cleared → `/dashboard` gate-redirects again. Refresh path (rotation, CSRF re-fetch)
  proven via direct backend curl trace (see below) + reused verbatim by the browser flow's token lifetime.
  **Architecture:** BFF-only — browser never talks to the backend or sees a token. Three httpOnly cookies
  on our own domain (`rk_at`/`rk_rt`/`rk_user`, see `lib/auth/cookie-names.ts`). Client-side data fetching
  goes through one generic `/api/backend/[...path]` proxy (reactive 401→refresh→retry-once); Server
  Components fetch the backend directly via `lib/api/server-fetch.ts` (attaches the cookie's token, no
  network hop through our own routes). `proxy.ts` proactively refreshes near-expiring tokens before RSC
  pages render (Proxy uses `NextRequest`/`NextResponse` cookies, a different API from `next/headers` — the
  actual refresh HTTP calls are factored into cookie-API-agnostic `lib/auth/refresh-core.ts` so neither
  side duplicates them). Login is a two-step bootstrap-farm flow (`lib/auth/session.ts#loginWithBackend`)
  matching ARCHITECTURE.md §4 exactly. Minimal but real login page + dashboard built (not RFE-006-final —
  those own the polish/OTP/register; the session wiring here carries over unchanged).
  **Real backend contract, verified live (differs from doc 04's aspirational shape — types/api.ts header
  has the full writeup):** error envelope is flat `{success:false,message,code,requestId,timestamp}` (no
  `error.details[]` — validation errors are one comma-joined string, not per-field); codes seen:
  `VALIDATION_ERROR` (400), `UNAUTHORIZED` (401), `FORBIDDEN`/"invalid csrf token" (403); cursor pagination
  meta is `{count,limit,hasNextPage,hasPreviousPage,startCursor,endCursor}`; `Accept-Language` genuinely
  localizes error messages (bn default). **CSRF token invalidates across a login/session boundary** — a
  token fetched before login fails on a post-login refresh/logout call; the fix is to never cache it,
  fetch fresh immediately before each mutating auth call (implemented this way throughout).
  **Backend gaps discovered (also see the table below):** (1) ✅ **Fixed 2026-07-10** (RAKHAL-259) —
  `GET /auth/me` no longer returns `passwordHash` (`AuthRepository.findSafeUserById`, Prisma `omit`).
  (2) ✅ **Fixed 2026-07-10** (RAKHAL-260) — `GET /auth/me` now includes a real `permissions: string[]`
  (backend's existing `PermissionService.resolvePermissions`, previously only used by `PermissionGuard`,
  now also exposed here); `/api/auth/session` fetches it server-side via `serverFetch('/auth/me')` and
  `<Can/>`/`useCan()` consume the real array — **verified live** as `["*"]` for the demo owner. (3)
  `POST /auth/refresh`'s embedded `user.isEmailVerified` was observed `false`
  immediately after login's `true` for the same user — worked around by trusting the cached login-time
  profile over refresh's, but the backend inconsistency itself is unfixed.

#### RFE-004 — UI primitives + shared composites
- **Depends:** RFE-002 · **Lane:** `components/ui/**`, `components/shared/**` (exclusive during build-out)
- Build the full DESIGN_SYSTEM.md §3 inventory. DataTable must do cursor pagination, URL-synced filters
  (nuqs), selection, mobile collapse, all four states.
- **AC:** component tests for DataTable/FormDialog/FilterBar; axe clean; every primitive tokenized.
- **Status:** `DONE` (2026-07-10) — full `components/ui/**` inventory built (added `cmdk` +
  `react-day-picker`/`date-fns` + `@radix-ui/react-progress`/`react-scroll-area`/`react-toggle` deps for
  Command/Calendar): Input, Textarea, Label, Select, Checkbox, RadioGroup, Switch, Dialog, Sheet,
  DropdownMenu, Popover, Tooltip, Tabs, Badge, Card, Table, Avatar, Progress, Separator, Skeleton,
  Calendar, Combobox, Command, Sonner `Toaster` (now the single source — `providers/app-providers.tsx`'s
  inline `ThemedToaster` replaced with it, also wired `NuqsAdapter` there since FilterBar/DataTable need
  it). All primitives are semantic-token-only (no raw hex), matching `button.tsx`'s existing style.
  `components/shared/**` composites all built: DataTable (TanStack Table, cursor "load more" + URL-synced
  single-column sort via nuqs, row selection, mobile card-collapse via a `renderMobileCard` render prop,
  all 4 states), PageHeader, StatCard, ChartCard, EmptyState/ErrorState/TableSkeleton/CardSkeleton,
  ConfirmDialog, FilterBar (debounced 300ms search + select filters, URL-synced via nuqs), FileUpload
  (drag/drop, type/size validation, image preview, progress), FormDialog/FormSheet (chrome only — caller
  owns RHF+zod), MoneyText/DateText (wrap `lib/format.ts`, read locale via `useLocale()`), CattlePicker
  (Popover+Command search-select over `GET /cattle`). Component tests per AC:
  `data-table.test.tsx`/`form-dialog.test.tsx`/`filter-bar.test.tsx` (11 tests, using
  `nuqs/adapters/testing`'s `withNuqsTestingAdapter`) — all green. **Axe/Lighthouse deferred**: no e2e
  harness or real pages exist yet to run `axe-playwright` against (RFE-009/RFE-005 build those) — flagging
  rather than fabricating a pass; re-verify once RFE-005's shell pages exist. Gate green:
  lint/typecheck/test/build all pass (0 errors; 1 known non-blocking React Compiler warning on
  `useReactTable()`, a TanStack Table incompatible-library note, not a real bug).

#### RFE-005 — App shell, navigation, route skeleton
- **Depends:** RFE-003, RFE-004 · **Lane:** `app/(app)/layout.tsx`, `components/layout/**`, all route stubs
- AppShell per PRD §6.1/§6.2: sidebar (all MVP modules + Scoreboard flagged V1.5, Upgrade-banner slot),
  topbar (search placeholder, bell placeholder, theme toggle, avatar menu with On-Duty + language + logout),
  OrgSwitcher (farms list → switch-organization). Route stubs + `loading.tsx`/`error.tsx` per segment;
  `(app)` layout session guard; `not-found`.
- **AC:** authenticated shell renders with live session; mobile sidebar sheet; keyboard navigable.
- **Status:** `DONE` (2026-07-10) — `components/layout/**`: AppShell (desktop fixed `Sidebar` + `Topbar`,
  `lg:pl-64` content offset), Sidebar (OrgSwitcher + `SidebarNav` 15-item module list from
  `nav-items.ts` incl. Scoreboard flagged `PRO`/V1.5 + UpgradeBanner), MobileSidebar (Sheet, triggered
  from the topbar hamburger, closes on nav), Topbar (GlobalSearch ⌘K palette — placeholder per this
  ticket's scope, live query wiring against `GET /search` §19 is a future ticket — NotificationBell
  placeholder pending RFE-098's SMS/push provider decision, ThemeToggle, UserMenu), UserMenu (avatar
  initials, on-duty switch UI-only — real `PATCH /auth/me/on-duty` wiring is RFE-007's lane —
  profile/settings links, language toggle wired to the existing `lib/i18n/set-locale.ts` server action,
  logout via `useLogout()`). `(app)/layout.tsx` now wraps `children` in `<AppShell>`; route stubs +
  `loading.tsx`/`error.tsx` added for all 18 module folders (`components/layout/route-stub.tsx` /
  `route-loading.tsx` / `route-error.tsx` share the boilerplate); root `app/not-found.tsx` (public 404)
  + `app/(app)/not-found.tsx` (404 inside the shell). **Gap flagged, not guessed:** `OrgSwitcher` shows
  the current farm read-only — the backend only returns the farm list during the login bootstrap step
  (`features/auth/types.ts#FarmOption`); there is no confirmed "list my farms while logged in" GET
  endpoint (only `POST /auth/switch-organization`, which needs an id we don't have post-login) — wire
  the real switcher once that endpoint exists or is confirmed in Swagger. **Verified live** end-to-end
  in the browser against the real backend (demo owner, 5 farms): login → farm picker → dashboard inside
  the real AppShell (sidebar, topbar, avatar "DO" initials) → clicked into `/cattle` (route stub renders
  "Coming soon") → dark theme toggle applied (`<html class="…dark">`, `color-scheme: dark`) → resized to
  375px mobile, hamburger opened the Sheet with the full nav, closed on click. No console errors.
  **Local-dev gotcha discovered while verifying:** `rakhal-backend`'s `.env` now has `PORT=5000` (not
  3000 as `.env.example`/every doc still says) — this frontend's `.env` `API_BASE_URL` was pointed at
  `:5000` to match for this verification session; whoever owns the backend should reconcile the docs
  vs. the actual configured port. Gate green: lint/typecheck/test/build all pass.

#### RFE-006 — Auth pages (login / register / forgot-password / farm select)
- **Depends:** RFE-003, RFE-004 · **Lane:** `app/(auth)/**`, `features/auth/**` · **Design:** Figma auth frames
- Login (email+password → farm picker when >1 farm), register + OTP verify (`POST /auth/register`,
  `/auth/verify-otp` — verify live behavior on Swagger; email-channel OTP), forgot/reset password.
  Full Metadata/SEO on these public pages.
- **API:** §1 Auth & Session · **PRD:** §5
- **AC:** Playwright E2E: register-mock/login→dashboard smoke; VALIDATION_FAILED maps to fields; Lighthouse 100 on /login.
- **Status:** `DONE` (2026-07-10) — **Real backend contract confirmed live (Swagger + controller read),
  not the PRD's aspirational phone/OTP flow**: this backend is email+password with **token-link**
  email verification (`POST /auth/verify-email {token}`) and reset password (`POST /auth/reset-password
  {token,newPassword}`) — no `/auth/verify-otp` endpoint exists (matches the phone/OTP gap RFE-003
  already flagged in `CURRENT_STATE.md`/backend `TEMPLATE_OVERVIEW.md` §13). Built against the real
  contract: **login** (polished — redesigned `LoginForm` with real `Input`/`Label`/`Button` primitives,
  farm-picker with a "use a different account" back action, i18n), **register** (name+email+password →
  "check your email" success state), **forgot-password** (email → always-success state, no user
  enumeration), **reset-password** (`?token=` from the URL; missing/invalid-token state; success →
  login), **verify-email** (`?token=` auto-fires on mount; loading/success/error/missing-token states).
  New shared `features/auth/components/auth-shell.tsx` (split branding-panel + form-panel chrome, reused
  by all 5 pages — no Figma auth frames exist yet, DESIGN_SYSTEM.md §1 resolution-path 3: built with
  established tokens/components matching the landing page's brand language, not invented). New shared
  `components/shared/locale-toggle.tsx` (promoted out of the landing page's private `_components/` so a
  feature can use it without reaching into another route group's internals). `features/auth/{schemas,
  types,api,hooks}` extended with `register`/`verifyEmail`/`forgotPassword`/`resetPassword` (the three
  non-login mutations go through the generic `/api/backend/[...path]` proxy — no bespoke cookie logic
  needed, unlike login). New i18n `auth.*` namespace (bn+en, full copy for all 5 flows); removed the now-
  dead `authPlaceholder` namespace. **Verified live end-to-end against the real backend** (browser,
  demo owner + a real registered test account, cleaned up after): login → farm-picker → dashboard;
  register → 201 → success state; forgot-password → 201 → success state; reset-password with a
  DB-seeded valid token → 201 → success → confirmed the new password logs in; verify-email with a
  DB-seeded valid token → auto-verifies → success state; invalid-token and missing-token states on both
  reset-password and verify-email; duplicate-email register → backend's `409 Email already exists`
  surfaces correctly, no crash; dark theme (desktop split-panel, confirmed via computed-style probe —
  the JPEG screenshot's compression made the dark-green/near-black contrast hard to eyeball, verified via
  DOM instead) + mobile 375px (single column, branding panel hidden, no overflow). Gate green: lint (0
  errors, 1 pre-existing non-blocking DataTable warning) / typecheck / build / **18 unit tests** all pass.
  **Two real bugs found + fixed live** (both blocking this ticket's own verification, fixed under the
  established RFE-003/RAKHAL-259/260 precedent of collaborative agents patching blocking backend bugs
  found in-session — logged in the backend's `IN_FLIGHT.md`/`TECH_DEBT.md`, not this repo's):
  (1) **Prisma `EmailTemplate` enum was missing `PASSWORD_RESET`** (the TS domain enum already had it) —
  every `POST /auth/forgot-password` call crashed the **entire backend process** (uncaught
  `PrismaClientValidationError` inside an unguarded event listener). One-line schema fix + migration
  `email_template_password_reset`. (2) **`proxy.ts`'s `PUBLIC_PATHS` list didn't include `/verify-email`**
  (it predates this ticket, from RFE-003/005) — an unauthenticated user clicking the email link got
  bounced to `/login` instead of reaching the verification page. Added `/verify-email` to the list (this
  repo's own fix, in-lane). **Filed RD-034** (backend `TECH_DEBT.md`) for the systemic issue behind bug
  (1) — domain event listeners have no error boundary and can crash the whole process; spawned a
  background task for it (out of this ticket's scope). **Deferred, not built here** (documented as gaps,
  not guessed): Playwright E2E (blocked on RFE-009, not started yet — AC's Lighthouse-100/E2E requirement
  carries over to whichever ticket builds the harness), pixel-exact auth visual design (no Figma access
  yet, same blocker as RFE-002/004).

#### RFE-007 — Profile & session self-service
- **Depends:** RFE-005 · **Lane:** `features/profile/**`, `app/(app)/profile/**`
- `GET/PATCH /auth/me`, on-duty toggle (`PATCH /auth/me/on-duty`), PIN set/change (`PATCH /auth/me/pin`),
  language toggle (`PATCH /auth/me/language`), sessions list/revoke if exposed.
- **API:** §1 · **PRD:** §5 · **Design:** PRD-spec
- **Status:** `DONE` (scoped to what the real backend exposes)
- **Rescoped, 2026-07-10:** verified against the actual `auth.controller.ts` (not just `Rakhal_API.md`) —
  `PATCH /auth/me` (generic), `PATCH /auth/me/on-duty`, `PATCH /auth/me/pin`, and
  `POST /auth/switch-organization` **don't exist in the backend at all** (zero grep matches in `src/`).
  Only `PATCH /auth/me/language` is real. Built: real `/profile` page — `GET /auth/me` account-info
  card (verified email badge, member-since, last-login, last-password-change via `DateText`), a
  language-preference card that persists `PATCH /auth/me/language` **and** flips the local UI-locale
  cookie in one action (so it never disagrees with the topbar's cookie-only `LocaleToggle`), and a real
  sessions card (`GET /auth/sessions` list + `DELETE /auth/sessions/:id` revoke via `ConfirmDialog`,
  current-device badge derived from the session cookie's JWT `sessionId` claim, `POST /auth/logout-all`
  wired through a new bespoke `/api/auth/logout-all` route — mirrors `/api/auth/logout`'s CSRF+cookie
  dance in `lib/auth/session.ts` since that route needs `CsrfGuard` and the generic `/api/backend`
  proxy doesn't attach CSRF tokens). On-duty toggle and PIN self-service are **not built** — no backend
  route to call; the shell's on-duty switch (`components/layout/user-menu.tsx`) stays disabled as
  RFE-005 left it. See the gaps table below for the missing-endpoints entry.
- **Gate:** `pnpm typecheck` (0) / `pnpm lint` (0 errors, 1 pre-existing unrelated warning) / `pnpm test`
  (18/18) / `pnpm build` (green, `/profile` route compiles) all pass. **Live browser verification not
  yet done this session** — blocked by RFE-006's dev server holding the Next.js single-instance lock on
  this same working tree (`localhost:3000`, PID observed live); didn't kill another agent's active
  server to force it. Re-run the interactive smoke test (login → `/profile` → toggle language → revoke a
  non-current session → logout-all → lands on `/login`) once that port is free.

#### RFE-008 — Subscription context + read-only/upgrade UX
- **Depends:** RFE-005 · **Lane:** `features/subscription/**` (context part), `components/layout/upgrade-banner.tsx`
- `GET /subscription` → SubscriptionProvider: feature flags (`reports.generate`, `scoreboard.read`, feed…),
  limits+usage, status. Drives: sidebar Upgrade banner (Free), premium-module gating UI, global read-only
  mode when EXPIRED/PAST_DUE (disable writes + renewal CTA — backend already 403s).
- **API:** `GET /subscription`, `GET /plans` · **PRD:** §31 · **Design:** PRD-spec
- **Status:** `TODO`

#### RFE-009 — Testing harness + seeds
- **Depends:** RFE-003 · **Lane:** `tests/**`, `playwright.config.ts`, `vitest.config.ts`
- Vitest+RTL setup, Playwright against live dev backend (demo owner/manager/worker), axe helper,
  `tests/e2e/utils.ts` (login helpers mirroring backend e2e harness).
- **Status:** `TODO`

#### RFE-010 — CI + Lighthouse gate
- **Depends:** RFE-001 · **Lane:** `.github/workflows/**`
- CI: lint/typecheck/test/build; Lighthouse CI on key routes (login, dashboard, cattle) with 100-score
  assertion (perf ≥ 98 tolerated in CI variance, a11y/BP/SEO = 100); PR previews if hosting chosen.
- **Status:** `TODO`

---

## Phase 1 — Core daily-driver pages 🐄 (parallel lanes after Phase 0)

#### RFE-020 — Dashboard (Morning Briefing)
- **Lane:** `features/dashboard/**`, `app/(app)/dashboard/**` · **Design:** Figma dashboard frame
- All 10 widgets, each in its own ErrorBoundary + skeleton: priorities, KPIs, production-summary,
  calving-forecast, herd-status, financial-snapshot, livestock-state, feed-stock-alerts, upcoming-tasks,
  activity-feed. `staleTime` 60s; charts dynamic-imported.
- **API:** §3 (10 endpoints) · **PRD:** §7 — note PRD lists widget metrics the Figma may lack (days-remaining
  estimates, week/month sessions): PRD-spec those.
- **Status:** `TODO`

#### RFE-021 — Cattle list + highlights + bulk ops
- **Lane:** `features/cattle/**` (list part), `app/(app)/cattle/page.tsx` · **Design:** Figma cattle list
- DataTable (cursor), filters (status/breed/shed/feed-group/health/search), highlights bar (4 KPIs),
  bulk ops (`POST /cattle/bulk`: shed/feed-group/sold/export), thumbnails (signed URLs → `next/image`).
- **API:** §4 · **PRD:** §8
- **Status:** `TODO`

#### RFE-022 — Add/Edit cattle + photo + status flows
- **Depends:** RFE-021 (shares feature folder — same agent or sequenced) · **Design:** Figma add-cattle frames
- One form (create+edit), zod mirroring `CreateCattleDto`; photo upload (`POST /cattle/:id/photo` flow via
  media module); status change dialog (`PATCH /cattle/:id/status`, multi-dimension statuses PRD §8.3),
  archive sold/deceased with ConfirmDialog.
- **API:** §4 · **PRD:** §8
- **Status:** `TODO`

#### RFE-023 — Cattle detail (5 tabs)
- **Depends:** RFE-021 · **Lane:** `features/cattle/**` (detail), `app/(app)/cattle/[id]/**`
- Tabs: Overview (yield/weight/BCS/lactation-curve/lifetime — charts dynamic), Reproduction, Health,
  Finance (per-animal P&L), Pedigree/Ancestry tree. BCS + weight record dialogs (worker-permitted BCS).
- **API:** §4 detail endpoints · **PRD:** §8.5+ · **Design:** Figma detail frames; PRD-spec for tabs missing in Figma
- **Status:** `TODO`

#### RFE-024 — Cattle CSV import (+ onboarding import reuse)
- **Depends:** RFE-022 · Multipart preview→confirm wizard (`/cattle` import routes; reused by RFE-063).
- **API:** §4 / §2 · **PRD:** §8.4 · **Design:** PRD-spec
- **Status:** `TODO`

#### RFE-025 — Milk log page
- **Lane:** `features/milk/**`, `app/(app)/milk/**` · **Design:** Figma milk frames
- Overview KPIs + 30d trend; session log table (per-cattle rows, session columns per farm's
  `milkActiveSessions` settings), withholding locks, save (`POST /milk/log`) + submit-to-tank
  (`POST /milk/submit`), anomaly list + review dialog (<70% flag).
- **API:** §6 (skip `/milk/quality` — V1.5, backend not built) · **PRD:** §10
- **Status:** `TODO`

#### RFE-026 — Milk buyers & dispatch
- **Lane:** `features/buyers/**`, `app/(app)/buyers/**`
- Buyer CRUD, dispatch form (quality-adjusted pricing §11.4, discrepancy flag), dispatch history table,
  monthly statement view/download.
- **API:** §7 · **PRD:** §11 · **Design:** Figma if present, else PRD-spec
- **Status:** `TODO`

#### RFE-027 — Task Hub
- **Lane:** `features/tasks/**`, `app/(app)/tasks/**` · **Design:** Figma task frames
- List (filters: status/assignee/source/type incl. SYSTEM_AUTO), create/edit, detail with checklist steps
  (`POST .../steps/:id/check`), complete + recurrence, completion photo upload, highlights.
- **API:** §13 · **PRD:** §17
- **Status:** `TODO`

---

## Phase 2 — Clinical & money modules ❤️💰 (parallel lanes)

#### RFE-030 — Reproduction dashboard + event flows
- **Lane:** `features/reproduction/**`, `app/(app)/reproduction/**` · **Design:** Figma repro frames
- Dashboard (4 KPIs, 5 action panels, 30d calving forecast, open-cows list w/ VWP), unified events feed
  (filters), event dialogs: heat, AI (semen batch pick → inventory decrement), pregnancy check, calving
  (spawns calves — link), dry-off. Protocols (RAKHAL-214) list/enroll if UI-feasible; else follow-up ticket.
- **API:** §5 · **PRD:** §9
- **Status:** `TODO`

#### RFE-031 — Healthcare (dashboard, sick bay, cases)
- **Lane:** `features/healthcare/**`, `app/(app)/healthcare/**` · **Design:** Figma health frames
- Dashboard + sick-bay board; case lifecycle: report sickness (worker flow), case detail timeline,
  log-treatment (medicine picker → FIFO stock note), health-update, close/recover; mortality flow.
- **API:** §9 · **PRD:** §13
- **Status:** `TODO`

#### RFE-032 — Health plans + healthcare tasks
- **Depends:** RFE-031 (same folder — sequence or same agent)
- Plans CRUD, check-stock preview, apply-to-cattle; healthcare task list (reschedule, record-batch).
- **API:** §9 · **PRD:** §13.x · **Design:** PRD-spec
- **Status:** `TODO`

#### RFE-033 — Calves
- **Lane:** `features/calves/**`, `app/(app)/calves/**`
- List+KPIs, calf profile (care-schedule task links), log dialogs: colostrum, milk-feeding, weight (ADG),
  starter-feed, wean→herd.
- **API:** §10 · **PRD:** §14 · **Design:** Figma if present else PRD-spec
- **Status:** `TODO`

#### RFE-034 — Inventory (5 tabs)
- **Lane:** `features/inventory/**`, `app/(app)/inventory/**` · **Design:** Figma inventory frames
- Tabbed page: Medicine (stock, low-stock badges, adjust-stock, expiry warnings), Forage, Equipment,
  Semen (tanks + batches), Milk tanks (+ audit log table). Each tab own DataTable + create/edit forms.
- **API:** §11 · **PRD:** §15
- **Status:** `TODO`

#### RFE-035 — Finance (ledger + wizard + sub-pages)
- **Lane:** `features/finance/**`, `app/(app)/finance/**` · **Design:** Figma finance frames
- Highlights (cost-per-litre, runway status); ledger DataTable (type filters, void w/ owner permission +
  ConfirmDialog, CSV export via `GET /finance/transactions/export`); 4-type transaction wizard;
  receivables/payables (+record-payment), liabilities/EMI, assets (depreciation view), wallet.
  Sub-routes per tab. ৳ everywhere via MoneyText.
- **API:** §12 · **PRD:** §16
- **Status:** `TODO`

#### RFE-036 — Billing & subscription management pages
- **Depends:** RFE-008 · **Lane:** `features/subscription/**` (pages), `app/(app)/subscription/**`
- Plans compare (`GET /plans`), checkout (`POST /billing/checkout` + coupon field + wallet credit display +
  legal-consent gate `GET/POST /legal/consent`), bKash redirect handling (callback return page → poll
  invoice), invoices list + receipt download, referral code share + commissions view.
- **API:** billing/plans/referrals/legal (Swagger §§) · **PRD:** §31–§33, §36–§37 · **Design:** PRD-spec
- **AC:** checkout E2E against gateway-less dev backend (PENDING invoice path) — money flow gets Playwright coverage.
- **Status:** `TODO`

---

## Phase 3 — Insight, settings & long tail 📊⚙️ (parallel lanes)

#### RFE-040 — Feed Formulator
- **Lane:** `features/feed/**`, `app/(app)/feed/**` · **Design:** Figma feed frames
- Ingredients table (+price overrides), feed groups (+assign-cattle), requirements calculator,
  concentrations builder (balance/normalize), cost summaries. Mixtures UI **deferred** (backend RD-015c).
- **API:** §8 · **PRD:** §12 · Premium-gated via RFE-008.
- **Status:** `TODO`

#### RFE-041 — Reports
- **Lane:** `features/reports/**`, `app/(app)/reports/**`
- Catalogue (12 MVP reports grouped), generate dialog (params) → job poll → download (CSV/PDF).
  Schedules UI **deferred** (backend V1.5). Premium-gated.
- **API:** §15 · **PRD:** §22 · **Design:** PRD-spec
- **Status:** `TODO`

#### RFE-042 — Activity Log
- **Lane:** `features/activity/**` · Filterable feed (`GET /activity-log`), hash-chain badge, entity links.
- **API:** §16 · **PRD:** §19 · **Design:** PRD-spec
- **Status:** `TODO`

#### RFE-043 — Notification center + preferences
- **Lane:** `features/notifications/**`, bell in `components/layout/` (coordinate — layout is hot)
- Bell + unread badge (poll 60s), center list (read/read-all, deep links), preferences page
  (per-event-type toggles via routing rules), device registration hooks (web push later — skip FCM for now).
- **API:** §17 · **PRD:** §20
- **Status:** `TODO`

#### RFE-044 — Global search (⌘K)
- **Lane:** `components/layout/search-command.tsx`, `features/search/**`
- Command palette → `GET /search?q=` grouped results (cattle/tasks/suppliers/buyers/sheds/medicines) →
  deep-link navigation using backend-provided `link`.
- **API:** §19 · **PRD:** §6.2
- **Status:** `TODO`

#### RFE-045 — Settings (all tabs)
- **Lane:** `features/settings/**`, `app/(app)/settings/**` · **Design:** Figma settings frames else PRD-spec
- Farm profile (location cascades, purpose), Sheds CRUD, Feed-groups CRUD, Team (invite/remove/resend,
  seat-limit UX from RFE-008), Roles & permissions matrix editor, Module settings (PRD §21.5 toggles),
  Suppliers CRUD, Billing summary (links RFE-036).
- **API:** §18 · **PRD:** §21 · Large — may split per-tab into RFE-045a/b/c in IN_FLIGHT if two agents want it.
- **Status:** `TODO`

#### RFE-046 — Scoreboard (V1.5 flag)
- **Lane:** `features/scoreboard/**` · Highlights, leaderboard, join/leave. Premium+flag-gated; lowest priority.
- **API:** §14 · **PRD:** §18
- **Status:** `TODO`

#### RFE-047 — Onboarding wizard
- **Depends:** RFE-024 · **Lane:** `features/onboarding/**`, `app/(app)/onboarding/**`
- Farm create → configure (modules/sessions) → optional cattle CSV import (reuse RFE-024 wizard) → complete.
  Entry point after first login with zero farms.
- **API:** §2 · **PRD:** §5 · **Design:** Figma onboarding frames
- **Status:** `TODO`

#### RFE-048 — Support feedback widget
- **Lane:** `features/support/**` · Feedback dialog (category/message/screenshot upload) from avatar menu.
- **API:** `POST /feedback` · **PRD:** §36 · **Design:** PRD-spec
- **Status:** `TODO`

---

## Phase M — Marketing site 🌐 (public, outside the app shell)

#### RFE-100 — Cinematic marketing landing page
- **Lane:** `app/(landing-page)/**` (all sections live in its private `_components/`), `components/ui/button.tsx` (created here, shared) · **Design:** user-provided copy/section spec (2026-07-09 request), tokens from RFE-002
- 12 sections at the site root `/`: Hero (slow-zoom glow bg + floating glass dashboard cards), live counters
  (animated count-up — **placeholder numbers with a TODO: wire to a public stats endpoint before production
  marketing**), Problem (fading paper records → rising Rakhal card), Solution (module chips + mini dashboard
  mock), Features (sticky-rail + 7 cards), 4-step onboarding, Dashboard preview (dark section, parallax
  columns), 3 testimonials, Pricing (3 plans — **TODO: source from `GET /plans`**; Growth=৳2,500/mo matches
  the seeded Pro plan), FAQ (native `<details>`, zero-JS + FAQPage JSON-LD), final CTA, footer.
  `motion` (Framer Motion v12) for animation — all sections are **Server Components**; only thin client
  wrappers (`Reveal`/`Float`/`ParallaxY`/`CountUp`/`LocaleToggle`) hydrate, so full copy ships as HTML for
  SEO. Reduced-motion respected everywhere (`useReducedMotion` + CSS media query). No external
  assets/video — mockups are CSS-only, replaceable with real screenshots later. Full bn+en copy in
  `i18n/messages/*` under `landing.*`; localized `generateMetadata` + OpenGraph.
- **Route/domain plan:** landing owns `/` (deleted the old root redirect). Target topology: `rakhal.app` =
  landing, `farm.rakhal.app` = the `(app)` consumer shell (host-based rewrites in `proxy.ts` when domains
  exist), `admin.rakhal.app` = separate project. Until then everything serves from one origin: `/` landing,
  `/dashboard`… app.
- Also added **placeholder `/login` + `/register` pages** (`authPlaceholder.*` strings) so landing CTAs don't
  404 — RFE-006 replaces them with the real auth pages.
- **AC met:** lint/typecheck/test/build green; both locales verified live (bn default + en via nav toggle —
  title/h1/lang/FAQ JSON-LD checked in the browser); 11 sections + footer render server-side; a11y snapshot
  clean (semantic headings/lists/nav landmarks). ⚠ Preview screenshot tooling wedged this session (timeouts
  even on known-good pages) — visual QA done via a11y snapshot + computed-style inspection; eyeball pass
  recommended when the user runs `pnpm dev`.
- **Status:** `DONE` (2026-07-09)

---

## Cross-cutting quality tickets (continuous)

#### RFE-090 — i18n message completeness sweep — every `messages/en.json` key has a reviewed `bn` twin; no literals in JSX (lint rule if feasible). `TODO`
#### RFE-091 — Accessibility audit — axe on all routes, keyboard walkthrough, focus management in dialogs/wizards. `TODO`
#### RFE-092 — Performance audit — bundle analysis per route vs budget, image audit, Lighthouse CI evidence attached. `TODO`
#### RFE-093 — Error/empty state audit — every data view's four states verified against a fresh farm (empty DB) and a killed backend. `TODO`

---

## Dependency graph (build order)

```
RFE-001 → 002 → 004 ─┐
       → 003 → 005 ──┼→ 006/007/008/009/010 → Phase 1 (020–027 parallel)
                     │                          → Phase 2 (030–036 parallel)
                     └──────────────────────────→ Phase 3 (040–048 parallel)
Same-folder sequences: 021→022→023→024 · 031→032 · 008→036 · 024→047
```

## Backend gaps discovered while building (append here, then ticket in backend PROJECT_PROGRESS)

| Date | Page/ticket | Gap | Backend action |
|---|---|---|---|
| 2026-07-10 | RFE-003 | ✅ **FIXED** `GET /auth/me` returned `passwordHash` in plaintext | RAKHAL-259 — `AuthRepository.findSafeUserById` (Prisma `omit`), covered by `test/auth-me.e2e-spec.ts` |
| 2026-07-10 | RFE-003 | ✅ **FIXED** No endpoint returned the current user's `resource.action` permission strings | RAKHAL-260 — `GET /auth/me` now includes `permissions: string[]` via the existing `PermissionService.resolvePermissions`; frontend's `/api/auth/session` + `<Can/>`/`useCan()` updated to consume it, verified live |
| 2026-07-10 | RFE-003 | `POST /auth/refresh`'s embedded `user.isEmailVerified` observed `false` right after login's `true` for the same user | Worked around client-side (trust login-time cached profile over refresh's); backend inconsistency itself unfixed |
| 2026-07-10 | RFE-003 | Error envelope is flat (`{success,message,code,requestId,timestamp}`), not the `{error:{code,message,details}}` shape the cross-repo template doc assumes; validation errors are one comma-joined string, no per-field `details[]` | Not necessarily a bug — just means frontend form-error mapping can only show a form-level message, never per-field, until/unless the backend adds structured validation details |
| 2026-07-10 | RFE-007 | `PATCH /auth/me/on-duty`, `PATCH /auth/me/pin`, generic `PATCH /auth/me` (name/avatar), and `POST /auth/switch-organization` are documented in `Rakhal_API.md` but **do not exist in the backend at all** (grepped `src/` — zero matches for on-duty/pin/switch-organization; only route is `PATCH /auth/me/language`). `GET /auth/sessions` + `DELETE /auth/sessions/:sessionId` + `POST /auth/logout-all` DO exist and are real. Confirmed via `auth.controller.ts`/`auth.service.ts`. | Not built client-side — placeholders left disabled/hidden rather than faked. Backend ticket needed for on-duty toggle, PIN self-service, generic profile edit, org switch before RFE-007 can close out those ACs. RFE-005's OrgSwitcher already flagged the switch-organization gap separately. |
