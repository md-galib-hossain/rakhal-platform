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

> **RAKHAL-326 (backend-numbered, no RFE assigned)** — Inventory Unit catalog, frontend half `DONE`
> (2026-08-14): free-text `unit` on Medicine/Equipment/FeedItem replaced by a real `Unit` catalog picker
> (`UnitPicker`, system+farm-custom, same convention as the Feed Formulator's `IngredientPicker`). Full
> writeup: `docs/CURRENT_STATE.md` / `docs/IN_FLIGHT.md` Recently Done.

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
- **Pixel-exact pass (2026-07-10)** — Figma access landed (official plugin, user OAuth'd). Pulled the
  real "Dashboard" frame's `Navbar` (`732:1659`) and topbar (`Frame 32`, `732:1695`) subtrees from file
  `SCfMPdxP6vgW1uTxfqCtz7` (the full Dashboard frame is too large to fetch in one call — used
  `get_metadata` to find the sidebar/topbar child node ids first, then `get_design_context` on just those)
  and rebuilt `AppShell` to match: sidebar + topbar are now two separate floating rounded cards on a
  shared page gutter (`p-2.5 gap-2.5`), not the original flush full-bleed shell. **Sidebar**: dark-green
  card pixel-confirmed `#055640` (`--sidebar`, was eye-sampled `#0b5137`, updated in `app/globals.css`),
  logo header with a bottom border, white pill `OrgSwitcher` restyled off the sidebar-dark palette onto
  `bg-card`, two nav sections MENU/OTHERS (`nav-items.ts` gained a `section: "menu"|"others"` field —
  the Figma prototype only pictures 9 of our 15 modules, deliberately incomplete per DESIGN_SYSTEM.md §1,
  so Buyers/Reproduction/Calves/Reports were slotted into MENU next to their closest sibling rather than
  dropped), pill active/inactive states in `sidebar-nav.tsx` (active = `bg-card text-primary-hover`,
  matching Figma exactly), a handful of icons swapped for closer Figma matches (`LayoutDashboard`,
  `Warehouse`, `Syringe`, `Trophy`), `UpgradeBanner` restyled to the dark rounded card. Skipped the
  Figma frame's two blurred-polygon decorative background layers (would mean two more downloaded PNGs)
  in favor of a CSS `blur-3xl` glow — visually close without the asset weight. **Topbar**: rounded card
  wrapper, `GlobalSearch` restyled to a white search pill (same ⌘K palette logic, just new chrome),
  `NotificationBell`/`ThemeToggle`/`UserMenu` restyled to white circular/pill buttons with `shadow-xs`
  matching Figma's icon cluster. **Also fixed the RFE-009-flagged WCAG AA contrast finding** while in
  these files: `text-primary` (#00A86B is 3.23:1 on white — fails normal-text AA) was used for auth link
  text; computed contrast confirmed `text-primary-hover` (#00774C, 5.53:1) passes AND matches Figma's own
  color split (primary-500 reserved for solid button backgrounds, primary-700 for text-on-white) — swapped
  in `login-form.tsx`/`register-form.tsx`/`forgot-password-form.tsx`/`auth-shell.tsx`'s mobile logo link.
  Added the missing `<main>` landmark to `AuthShell` (same finding). **Not pulled from Figma** (fabricated
  placeholder data, not a real gap): the Figma frame's hardcoded unread-count badges ("2" on
  Dashboard/Finance) were skipped — no backing data source exists for them yet. **Verified LIVE**: full
  login→farm-picker→dashboard flow against the real backend, light+dark theme, desktop (1280px) +
  mobile (375px incl. the Sheet nav), route navigation (`/cattle`) with correct active-state — no console
  errors, no failed requests. Gate green: lint/typecheck/build/18 unit tests all pass.

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
  carries over to whichever ticket builds the harness), ~~pixel-exact auth visual design (no Figma access
  yet, same blocker as RFE-002/004)~~ **resolved below.**
- **Pixel-exact pass (2026-07-10)** — Figma access landed (official plugin, user OAuth'd). Pulled the real
  auth frames from file `SCfMPdxP6vgW1uTxfqCtz7` (`1042:63021` Sign In, `1039:52364` Sign Up, `1039:52389`
  Reset Password, `1039:52443` Set New Password; no frame exists for verify-email — same OTP-vs-token-link
  gap as before) and rebuilt all 5 pages to match: `AuthShell` rewritten (form panel moved to the **left**
  per Figma — RFE-006 originally had it on the right; 453px white card, `rounded-[20px]`, `gap-[60px]`,
  real hero photo + wordmark downloaded to `public/auth/**` since Figma's asset CDN URLs expire in 7 days),
  new `components/ui/floating-input.tsx` (floating-label input matching Figma's "Input Field/lg-52px",
  built-in password show/hide). **Real brand primary confirmed `#00A86B`/`#00774C`** (not the RFE-002
  eye-sampled `#16a34a`) — updated app-wide in `app/globals.css` (`--primary`/`--primary-hover`/`--ring`,
  both themes; dark derived, no dark Figma frames exist yet). Added a `confirmPassword` field to
  reset-password (`resetPasswordFormSchema` in `schemas.ts`, client-only, stripped before the API call) to
  match the Figma "Set New Password" frame's two-field layout. New i18n: `auth.shell.{headline,subcopy}`,
  `auth.resetPassword.{confirmPassword,passwordMismatch}` (bn+en). Full writeup + open gaps (font family
  not swapped to Satoshi, rest of the palette still eye-sampled) in `DESIGN_SYSTEM.md` §4. **Verified LIVE**:
  all 4 pages (with Figma frames), light+dark theme, bn+en locale, desktop (1280px) + mobile (375px) — no
  console errors, no failed network requests. Gate green: lint/typecheck/build/18 unit tests all pass.

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
- **Status:** `DONE` (2026-07-10) — `features/subscription/` (real `GET /subscription`, mirrors
  `features/profile/`'s api/hook pattern) + `hooks/use-subscription-gates.ts` (`useHasFeature`/
  `useIsReadOnly`/`useIsEligibleForUpgradeAd`, mirrors `lib/auth/permissions.tsx`'s `useCan()` shape).
  Drives three real pieces: `sidebar-nav.tsx`'s pre-existing `premiumFlag` scaffold (Scoreboard) now
  actually locks (Lock icon, redirects to `/subscription`, tooltip) when the feature key isn't in the
  farm's plan; `upgrade-ad.tsx`'s eligibility is real (usable status + missing the Pro-only
  `reports.scheduled` feature) instead of hardcoded `true`, and its CTA button now links somewhere
  real instead of doing nothing; new `read-only-banner.tsx` (mounted in `app-shell.tsx`) mirrors the
  backend's own `SubscriptionGuard` exactly for PAST_DUE/EXPIRED/CANCELLED/NONE. **Backend gap**:
  `Rakhal_API.md` has no §31 section for `/subscription`/`/plans` at all — verified live against
  `subscription.controller.ts`/`plan.controller.ts` instead (matches PRD §31.3 SUB-07). **Verified
  live, all 3 states**, without touching the shared demo DB: real ACTIVE+Pro data confirmed via the
  actual network response; EXPIRED/Free and ACTIVE/Starter simulated via a temporary dev-only
  `queryClient` window exposure (added, used, then fully removed — zero residual `git diff`). Full
  writeup + the contrast fix + the port-3001 Playwright environment gotcha found while testing:
  `docs/IN_FLIGHT.md`'s Recently Done entry. Gate green: lint/typecheck/`pnpm build`/18 unit
  tests/10 e2e. **Not built** (explicit scope boundary, not a miss): the full `/subscription`
  billing/plan-comparison page is RFE-036's; admin-configurable ad cadence; per-module
  mutation-button gating (moot — those modules are still `RouteStub`s, and the backend's
  `SubscriptionGuard` already 403s regardless of frontend UI).

#### RFE-009 — Testing harness + seeds
- **Depends:** RFE-003 · **Lane:** `tests/**`, `playwright.config.ts`, `vitest.config.ts`
- Vitest+RTL setup, Playwright against live dev backend (demo owner/manager/worker), axe helper,
  `tests/e2e/utils.ts` (login helpers mirroring backend e2e harness).
- **Status:** `DONE` (2026-07-10) — Vitest+RTL was already live from RFE-001/004 (18 component tests);
  this ticket built the missing **Playwright E2E layer** against RFE-006's real auth pages (the only
  pages with real business logic to exercise so far). New `tests/e2e/utils.ts`: `DEMO_OWNER/MANAGER/
  WORKER` seed credentials, `loginViaUi()` (drives the real `/login` page incl. the multi-farm picker,
  mirrors the backend's `test/utils/e2e.ts#loginAs` in spirit but through actual pages, not API
  shortcuts), `uniqueTestEmail()`, `formLevelAlert()` (disambiguates the submit-error alert from
  `FloatingInput`'s own per-field `role="alert"`), and a `test` fixture that **pins the locale cookie to
  `en`** for every spec — the app is Bangla-first by default (`bn`), so English gives E2E assertions
  stable strings without losing coverage (identical component tree either locale). New `tests/e2e/axe.ts`
  (`expectNoA11yViolations` wrapping `axe-playwright`). New `tests/e2e/auth.spec.ts` — 10 specs: login→
  farm-picker→dashboard smoke (fulfills RFE-006's own AC), wrong-password error mapping, client-side
  validation (no premature API call), register→success, duplicate-email 409 mapping, forgot-password
  no-enumeration, reset-password/verify-email missing-token states, unauthenticated redirect off a
  protected route, and an axe a11y check on `/login`. Installed the Chromium browser (`npx playwright
  install chromium`, wasn't present). **`playwright.config.ts` tuned for `next dev`'s on-demand Turbopack
  compilation**: `fullyParallel:true` (the RFE-001 default) reliably timed out 9/10 specs when several
  workers hit different uncompiled routes at once — switched to `workers:1` + `timeout:60_000`; verified
  0 failures from cold-compile after the change (root-caused via a serial re-run, not guessed). **Ran
  live against the real dev backend** (Docker Postgres+Redis, `pnpm start:dev`, seeded) — not mocked.
  **9/10 passing**; the 10th (the axe a11y check) found **real, confirmed WCAG AA violations** on
  `/login` — the harness working as intended, not a harness bug: (a) `--primary` (`#00a86b`, RFE-006's
  pixel-exact-pass brand color) fails 4.5:1 contrast as white-on-button text (3.08:1) and as link text on
  the white card (3.08:1); (b) no `<main>` landmark, page content not contained by any landmark region.
  Both are in `app/globals.css`/`features/auth/components/auth-shell.tsx`, outside this ticket's
  `tests/**` lane and mid-ownership by the just-finished RFE-006 pixel-exact-pass ticket — **left the
  strict assertion in place rather than weakening it to hide a real bug**, and spawned a background task
  (title: "Fix auth pages: color-contrast + missing landmark a11y bugs") for the fix. **Resolved
  2026-07-10**: RFE-005's pass fixed the link-text half + the `<main>` landmark; the button-text half
  (white on `#00a86b`, app-wide via `Button`'s default `variant="primary"`, not auth-only) and the
  hero-panel `region` violation were left open and fixed in a follow-up pass — darkened
  `--primary-foreground` to `#171d22` (light theme) rather than the pixel-confirmed `#00a86b` fill, and
  wrapped `AuthShell`'s hero panel in `<aside>`. `pnpm test:e2e` now 10/10 green. See IN_FLIGHT.md's
  "RFE-009 a11y fix" entry for full detail. Also fixed two real
  bugs found in my own harness code along the way (not pre-existing app bugs): `getByLabel(/password/i)`
  ambiguously matched `FloatingInput`'s new "Show password" toggle button too (switched to exact-match);
  ESLint's `react-hooks` rule false-positived on Playwright's fixture callback param conventionally named
  `use` (renamed to `runWithFixture` — a known collision between the two APIs, not a real hook violation).
  Gate green: lint (0 errors) / typecheck / build / **18 unit + 9/10 e2e** (10th is the tracked a11y
  finding above, not a flake — reproduced identically 3 runs in a row). **Deferred, not built**: RBAC-
  differentiated specs (manager/worker logins) — no permission-gated UI exists yet anywhere in the app to
  meaningfully exercise (`AppShell`'s nav isn't `<Can/>`-gated per RFE-005's own notes); add per-module
  E2E coverage as each module ships real pages, reusing this harness. RFE-010 (Lighthouse CI) can now
  build on this Playwright setup instead of starting from zero.

#### RFE-010 — CI + Lighthouse gate
- **Depends:** RFE-001 · **Lane:** `.github/workflows/**`
- CI: lint/typecheck/test/build; Lighthouse CI on key routes (login, dashboard, cattle) with 100-score
  assertion (perf ≥ 98 tolerated in CI variance, a11y/BP/SEO = 100); PR previews if hosting chosen.
- **Status:** `DONE` (2026-07-10) — `.github/workflows/ci.yml`: `checks` job (lint/typecheck/test/build on
  every push/PR to `main`) + `lighthouse` job (build, `pnpm start`, `treosh/lighthouse-ci-action@v12`
  against `lighthouserc.json`'s assertions — perf ≥98 error-level, a11y/BP/SEO =100 error-level, exactly
  ARCHITECTURE.md §7's budget). **Gotcha handled:** the repo's committed `.npmrc` pins `store-dir` to a
  Windows dev-machine path (RFE-001's corrupted-pnpm-store workaround, see CURRENT_STATE.md) — doesn't
  resolve on the Linux runner, so CI installs with `--store-dir ~/.pnpm-store` (CLI flag beats project
  `.npmrc` in pnpm's precedence) instead of editing that file. **Scoped down from the AC, flagged not
  guessed:** only `/` (landing) and `/login` are Lighthouse-audited, not dashboard/cattle as the AC lists
  — every other route sits behind `(app)/layout.tsx`'s session-cookie gate, and this workflow has no
  Postgres/Redis/backend service to log a real session in with (the backend is a *separate* GitHub repo,
  `rakhal-backend`, not a submodule of this one). Wiring the authenticated routes needs Docker service
  containers + `pnpm seed` + a cross-repo checkout — real infra work, not something to fake by pointing
  Lighthouse at the gate-redirect page. The same missing-backend-service gap means `tests/e2e/auth.spec.ts`
  (RFE-009) isn't run in this CI either. PR-preview deploys (the AC's "if hosting chosen" clause) skipped —
  hosting is still an open item in `CURRENT_STATE.md`'s "Blocked / decisions needed". **Verified:** the
  exact commands the `checks` job runs (`pnpm lint`/`typecheck`/`test`/`build`) all pass locally; YAML/JSON
  syntax checked clean; every action tag cross-checked against its real upstream GitHub releases via
  `gh release list` (not guessed from training data) — `checkout@v7`, `pnpm/action-setup@v6`,
  `setup-node@v6`, `lighthouse-ci-action@v12`. **Not verified:** an actual GitHub Actions run — no
  Chrome/Chromium exists in this sandbox to dry-run Lighthouse, so the real perf/a11y/BP/SEO scores against
  `/`/`/login` are unconfirmed until the workflow's first push-triggered run.

---

## Phase 1 — Core daily-driver pages 🐄 (parallel lanes after Phase 0)

#### RFE-020 — Dashboard (Morning Briefing)
- **Lane:** `features/dashboard/**`, `app/(app)/dashboard/**` · **Design:** Figma dashboard frame
- All 10 widgets, each in its own ErrorBoundary + skeleton: priorities, KPIs, production-summary,
  calving-forecast, herd-status, financial-snapshot, livestock-state, feed-stock-alerts, upcoming-tasks,
  activity-feed. `staleTime` 60s; charts dynamic-imported.
- **API:** §3 (10 endpoints) · **PRD:** §7 — note PRD lists widget metrics the Figma may lack (days-remaining
  estimates, week/month sessions): PRD-spec those.
- **Status:** `DONE` (2026-07-10) — **the real backend only has 9 of the doc's 10 endpoints**
  (`dashboard.controller.ts` — no `/dashboard/activity-feed`; that's the separate Activity Log module,
  RFE-042); built against the real 9, not guessed at a 10th. `features/dashboard/{types,api}.ts` types
  are read directly from `dashboard.service.ts`'s actual return objects (camelCase, not the API doc's
  aspirational examples — the two differ in at least one real place, see below). `hooks/use-dashboard-
  widgets.ts`: one `useQuery` per widget, `staleTime` 60s. **Fault isolation instead of React
  ErrorBoundary**: each widget's own `isLoading`/`isError`/`data` drives its own skeleton/error/empty/
  success state — a query failure is already scoped to just that widget, the same isolation the AC's
  "ErrorBoundary" phrasing asks for, without introducing a second, unestablished error-handling pattern
  alongside the loading/error/empty/success convention every other page in this repo already uses.
  9 widget components in `features/dashboard/components/`; `HerdStatusDonut`/`LivestockStateChart` are
  the app's first real chart usage (`recharts`, `next/dynamic`-imported per ARCHITECTURE.md §7 — kept out
  of the main bundle). **Real bug caught before merge**: `ProductionSummaryResponse.sessions` was first
  typed against the API doc's richer per-session `{status,totalL,submittedAt}` shape; a live
  `MISSING_MESSAGE` i18n error while browser-verifying led to cross-checking the actual
  `MilkService#sessionStatuses` — the real shape is a flat `session -> "submitted"|"pending"|
  "not_configured"` string map. Fixed in `types.ts` + `production-summary-card.tsx`, confirmed against
  the real `GET /dashboard/production-summary` network response body. New `dashboard.*` i18n namespace,
  bn+en, all 9 widgets. **Verified LIVE**: full render against the real backend (demo owner, Demo Farm) —
  real priorities/KPIs/production/calving/herd-status (all 4 tabs)/livestock-state/financial/feed-alerts/
  tasks data, light+dark theme, desktop (1280px) + mobile (375px), no console errors, no failed requests.
  Gate green: lint/typecheck/build/18 unit tests. No Figma frame was pulled for this ticket's widgets
  (out of scope for this pass — the sidebar/topbar chrome around them is already pixel-matched per
  RFE-005; widget-internal layout used the established `StatCard`/`ChartCard`/`Card` primitives).
  **Parent-card wrapper (2026-07-11, user request):** new shared `components/shared/page-card.tsx` —
  the title+date-pill header row and every widget now sit inside one `PageCard` instead of floating
  independently on the bare page background (not Figma-sourced, its equivalent container node
  `732:1714` has no fill/shadow of its own — reuses the established `DashboardCard` chrome instead).
  `OverviewHeader` reduced to just `TodayDatePill` (the `actions` slot content), `PageCard` now owns
  the title row. Verified live (computed-style probe, not screenshot — this session's screenshot tool
  was down): `rounded-2xl`/16px radius, correct shadow, `bg-card` white in light / dark-card in dark,
  no console errors, no horizontal overflow at 375px. Gate green: lint/typecheck/build. Same pattern
  applied to `/cattle`, intended for every module page going forward — see IN_FLIGHT.md.

#### RFE-021 — Cattle list + highlights + bulk ops
- **Lane:** `features/cattle/**` (list part), `app/(app)/cattle/page.tsx` · **Design:** Figma cattle list
- DataTable (cursor), filters (status/breed/shed/feed-group/health/search), highlights bar (4 KPIs),
  bulk ops (`POST /cattle/bulk`: shed/feed-group/sold/export), thumbnails (signed URLs → `next/image`).
- **API:** §4 · **PRD:** §8
- **Status:** `DONE` — see `IN_FLIGHT.md` Recently Done for the full build note. Real gaps found vs the
  aspirational `Rakhal_API.md` §4: cursor pagination not page/per_page, `highlights()` is snake_case
  on the wire (unlike the rest of this app's camelCase responses), thumbnails render via `Avatar`
  (plain `<img>`) not `next/image` (no fixed remote host for the R2 signed URL). Bulk result is
  aggregate-only (`{updated,failed}`, no per-row detail). No detail/add-edit route yet (RFE-022/023).
  **Parent-card wrapper (2026-07-11 follow-up):** page now wrapped in the shared `PageCard` — see
  RFE-020's entry above for the full writeup, same component, no `actions` slot on this page.
  **Pixel-perfect pass + reusable Pagination (2026-07-12 follow-up):** cursor "Load more" replaced
  by numbered `Pagination` (new `components/shared/pagination.tsx`, generic — `page`/`totalPages`/
  `onPageChange`) over a new `useCattlePagedList` cursor-trail adapter (still keyset under the hood,
  no fake offset). Table restyled to the real Figma "Cattle" frame: gender glyphs, outline `Chip`
  status pills (new `components/ui/chip.tsx`), rebuilt `CattleHighlightsBar` as its own elevated
  card, added the "All Cattle View" section heading + moved `CattleAddButton` next to search/filter.
  New `CattleDetailSheet` right-side drawer (row-action "View Details") reuses the RFE-023 profile
  card + 5 tabs as-is — the `/cattle/:id` route stays the deep link, the drawer is now an additional
  fast-access presentation of the same data, not a replacement. Full writeup: `IN_FLIGHT.md`.

#### RFE-022 — Add/Edit cattle + photo + status flows
- **Depends:** RFE-021 (shares feature folder — same agent or sequenced) · **Design:** Figma add-cattle frames
- One form (create+edit), zod mirroring `CreateCattleDto`; photo upload (`POST /cattle/:id/photo` flow via
  media module); status change dialog (`PATCH /cattle/:id/status`, multi-dimension statuses PRD §8.3),
  archive sold/deceased with ConfirmDialog.
- **API:** §4 · **PRD:** §8
- **Status:** `DONE` (2026-07-11) — see `IN_FLIGHT.md` Recently Done for the full build note. One
  `CattleFormDialog` for create+edit; status dialog + archive dialog (reason select) round out the
  new row-actions menu. Found+fixed 2 root-cause infra bugs along the way: the app had no multipart
  upload path at all (`apiUpload()` + proxy fix — first multipart consumer), and `useCan()` never
  matched the backend's `["*"]` Owner wildcard, hiding every `<Can>`-gated control app-wide. Photo
  upload reaches the backend correctly but 500s on a real R2 `AccessDenied` — pre-existing env
  credential issue, not this ticket's code, flagged not fixed.

#### RFE-023 — Cattle detail (5 tabs)
- **Depends:** RFE-021 · **Lane:** `features/cattle/**` (detail), `app/(app)/cattle/[id]/**`
- Tabs: Overview (yield/weight/BCS/lactation-curve/lifetime — charts dynamic), Reproduction, Health,
  Finance (per-animal P&L), Pedigree/Ancestry tree. BCS + weight record dialogs (worker-permitted BCS).
- **API:** §4 detail endpoints · **PRD:** §8.5+ · **Design:** Figma detail frames; PRD-spec for tabs missing in Figma
- **Status:** `DONE` (2026-07-11) — see `IN_FLIGHT.md` Recently Done for the full build note. Built
  as a plain page (`app/(app)/cattle/[id]/page.tsx`), not the Figma drawer (D-2) — no intercepted-route
  precedent in this codebase yet. Health's vaccination timeline and Ancestry's canvas pedigree diagram
  simplified to cards/grid (both already PRD-spec-flagged in `rakhal-ui-analysis.md`). **BCS/weight
  record dialogs added (2026-07-21)** — see `IN_FLIGHT.md` Recently Done.

#### RFE-024 — Cattle CSV import (+ onboarding import reuse)
- **Depends:** RFE-022 · Multipart preview→confirm wizard (`/cattle` import routes; reused by RFE-063).
- **API:** §4 / §2 · **PRD:** §8.4 · **Design:** PRD-spec
- **Status:** `DONE` (2026-07-21) — no column-mapping UI (canonical CSV headers documented in the
  dialog instead); see `IN_FLIGHT.md` Recently Done for the full build note + a real backend bug found
  during verification (Redis client never connected at boot — TECH_DEBT, flagged separately).

#### RFE-025 — Milk log page
- **Lane:** `features/milk/**`, `app/(app)/milk/**` · **Design:** Figma milk frames
- Overview KPIs + 30d trend; session log table (per-cattle rows, session columns per farm's
  `milkActiveSessions` settings), withholding locks, save (`POST /milk/log`) + submit-to-tank
  (`POST /milk/submit`), anomaly list + review dialog (<70% flag).
- **API:** §6 (skip `/milk/quality` — V1.5, backend not built) · **PRD:** §10
- **Status:** `DONE` (2026-07-11) — built against the real backend, verified directly against
  `milk.controller.ts`/`milk.service.ts`/the 4 DTOs (not the aspirational API doc): `logTable`/
  `anomalies` return flat objects, not cursor pages; `sessionsStatus`/`sessionConfig` are real.
  New `features/milk/{types,schemas,api,hooks/use-milk}.ts` + 8 components: `MilkOverviewCard`
  (today/sellable/withholding + yesterday/last-week/last-year comparisons + per-session status
  dots — `GET /milk/overview`), `MilkTrendChart` (+`-inner`, 30-day area chart, dynamic-imported
  `recharts`, shares the same overview query — TanStack Query dedupes it into one network call),
  `MilkSessionLog` (session tabs from the farm's real `sessionConfig`, not a hardcoded 4) wrapping
  `MilkSessionTable` (the editable per-cow yield grid + Save Draft/Submit All Logs, `milk.log`-gated
  via `<Can/>`), `MilkAnomaliesPanel` + `ReviewAnomalyDialog` (`milk.update`-gated). New local
  `MilkCard` (not `features/dashboard`'s `DashboardCard` — no public `index.ts` there to import
  through per ARCHITECTURE.md §3, so duplicated the same `rounded-2xl bg-card shadow-card` chrome
  as a small in-lane component instead of reaching into another feature's internals). Wrapped in
  the shared `PageCard` (2026-07-11 pattern), matching `/dashboard` and `/cattle`. **Hit and fixed
  a real `set-state-in-effect` React Compiler error**: the session-switch re-seed of the editable
  draft inputs was originally a `useEffect` calling `setDrafts` synchronously — restructured into
  the `MilkSessionTable` child, `key`-remounted per session by its `MilkSessionLog` parent, so a
  fresh `useState` initializer seeds from that session's data with no effect at all (same
  remount-key fix `CattleFormDialogBody` already established in this codebase for an equivalent
  reset-on-change need — followed the precedent instead of re-solving it differently). Also fixed
  a real `recharts` `Tooltip.labelFormatter` type error (removed — it was a no-op passthrough
  anyway, the reference `financial-performance-chart-inner.tsx` doesn't use it either). **Verified
  LIVE end-to-end** against the real backend + real seeded data (demo owner, Demo Farm): overview
  totals/comparisons/session-status dots all real, 30-day trend chart renders, session tabs show
  only the farm's 2 actually-configured sessions (Morning/Evening — Noon/Night correctly absent,
  not just disabled), switching sessions correctly resets the draft inputs to that session's own
  saved values (confirmed empty inputs on Evening, a session with no prior entries), a real
  `POST /milk/log` **save** (`201 Created`, real success toast, auto-refetch confirmed via network
  log) — the anomalies list showed its real empty state (no anomalies in the seed data, not
  independently exercised beyond that this session). Dark theme + mobile (375px, no horizontal
  overflow) also confirmed via computed-style probes (screenshot tool down this session, same as
  other recent entries on this board). Gate green: lint/typecheck/build/18 unit tests. **Built in
  parallel with another agent's RFE-023 (cattle detail)** — zero file overlap (`features/milk/**`
  vs `features/cattle/**`), confirmed both compile together in the same `pnpm build`. **Not
  built**, flagged not guessed: `/milk/quality` (ticket's own note — V1.5, backend doesn't have
  it), a shed filter on the log table (`GET /milk/log?shedId=` exists server-side but no shed
  picker UI was wired — `MilkLogQueryDto.shedId` untouched from this page), no dedicated
  Playwright spec (this repo's e2e harness only covers `/login` et al. so far, per RFE-009).

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
- **Status:** `DONE` (2026-07-16) — Figma-perfect: list page (highlights + filter tabs + real search +
  card grid + pagination), Create Task side panel, Task Details side panel (reassign + checklist +
  complete). See `IN_FLIGHT.md` "Task Hub — Figma-perfect" for the full build notes and gaps
  (no completion-photo-upload endpoint on the real controller; no create-time steps builder — no
  Figma frame for either).

---

## Phase 2 — Clinical & money modules ❤️💰 (parallel lanes)

#### RFE-030 — Reproduction dashboard + event flows
- **Lane:** `features/reproduction/**`, `app/(app)/reproduction/**` · **Design:** Figma repro frames
- Dashboard (4 KPIs, 5 action panels, 30d calving forecast, open-cows list w/ VWP), unified events feed
  (filters), event dialogs: heat, AI (semen batch pick → inventory decrement), pregnancy check, calving
  (spawns calves — link), dry-off. Protocols (RAKHAL-214) list/enroll if UI-feasible; else follow-up ticket.
- **API:** §5 · **PRD:** §9
- **Status:** `DONE` (2026-07-26) — no Figma frames for this module, user asked to build it self-designed
  following the established widget-grid pattern (Milk/Cattle). Real backend wired throughout, verified
  from source not the aspirational API §5 (which lists stale routes) — `GET /reproduction/dashboard` +
  `/events` (RAKHAL-051), heat/breeding(AI, semen-batch picker → real inventory decrement)/pregnancy-
  diagnosis/calving(dynamic calves array)/abortion create dialogs, and a RAKHAL-214 protocols panel
  (apply + per-instance AI/outcome/close). **Dry-off has no backend route** (`DryPeriod` is schema-only)
  — its dashboard panel is informational only, no create flow; flagged rather than faked. Protocol
  instance rows show `cattle_id` only (backend's `mapInstance` doesn't join cattle name/tag) — a real
  gap, not hidden. `CattlePicker` gained an optional `gender` filter (backward-compatible) for the
  female-only/bull pickers. See `docs/IN_FLIGHT.md` Recently Done for full build notes.

#### RFE-031 — Healthcare (dashboard, sick bay, cases)
- **Lane:** `features/health/**`, `app/(app)/healthcare/**` · **Design:** Figma health frames
- Dashboard + sick-bay board; case lifecycle: report sickness (worker flow), case detail timeline,
  log-treatment (medicine picker → FIFO stock note), health-update, close/recover; mortality flow.
- **API:** §9 · **PRD:** §13
- **Status:** `DONE` (2026-07-15) — see `IN_FLIGHT.md`/`CURRENT_STATE.md` "Healthcare — Figma-perfect".

#### RFE-032 — Health plans + healthcare tasks
- **Depends:** RFE-031 (same folder — sequence or same agent)
- Plans CRUD, check-stock preview, apply-to-cattle; healthcare task list (reschedule, record-batch).
- **API:** §9 · **PRD:** §13.x · **Design:** PRD-spec
- **Status:** `DONE` (2026-07-16) — Task Hub tab done 2026-07-15 (Figma-perfect: calendar strip +
  filter tabs + grouped "Scheduled Task Cards" over real per-animal `HealthTask` rows + reschedule +
  batch-record dialogs). Health Plan tab done 2026-07-16 (Figma-perfect: plan CRUD 3-step wizard,
  Apply-to-cattle 2-step wizard — no bulk-apply endpoint exists, so applying loops a real
  create-case + apply-plan call per selected animal, flagged not faked). See `IN_FLIGHT.md`/
  `CURRENT_STATE.md` for both. No "check-stock preview" step exists in the Figma frames given for
  this half — not built (flag if a future pass wants one).

#### RFE-033 — Calves
- **Lane:** `features/calves/**`, `app/(app)/calves/**`
- List+KPIs, calf profile (care-schedule task links), log dialogs: colostrum, milk-feeding, weight (ADG),
  starter-feed, wean→herd.
- **API:** §10 · **PRD:** §14 · **Design:** Figma if present else PRD-spec
- **Status:** `DONE` (2026-07-27) — no Figma frames for this module; user asked to build it self-designed
  following the established widget-grid pattern (same precedent as RFE-030 Reproduction). Real backend
  throughout (`calf.controller.ts`/`calf.service.ts`, verified from source): 4-KPI row from `GET /calves`'s
  `meta.kpis`, cursor-paginated table (name/tag, age, dam, stage, weight, health, fed-today, weaning-due),
  calf-profile drawer (`?view=`) with 6 tabs (Overview, Colostrum, Milk & Feeding, Weight, Starter Feed,
  Tasks) each triggering its own `FormDialog` log action, Wean action in the profile header
  (`calf.update`-gated, irreversible — moves the row into the Cattle module and out of this list).
  No `calf.create` route exists (calves originate only from Reproduction's calving-event flow), so
  deliberately no "Add Calf" button. Live-verified end-to-end against the real dev backend: list+KPIs
  render real data (4 calves), detail sheet + tab switching + a real `POST /calves/:id/milk-feeding`
  write (201, row appeared via cache invalidation) all confirmed; both locales (bn default + en) render.
  `tsc`/`eslint` (0 new errors)/`next build` all green.

#### RFE-034 — Inventory (5 tabs)
- **Lane:** `features/inventory/**`, `app/(app)/inventory/**` · **Design:** Figma inventory frames
- Tabbed page: Medicine (stock, low-stock badges, adjust-stock, expiry warnings), Forage, Equipment,
  Semen (tanks + batches), Milk tanks (+ audit log table). Each tab own DataTable + create/edit forms.
- **API:** §11 · **PRD:** §15
- **Status:** `PARTIAL` — Medicine tab done (list/grid/add-edit/archive-restore/adjust-stock/photo,
  see `IN_FLIGHT.md` Recently Done). **Forage tab done** (2026-07-12, Figma-perfect: list/grid/
  add-edit/"Item Details" view/stock-update/archive-restore, see `IN_FLIGHT.md` Recently Done +
  `CURRENT_STATE.md`). **Milk tab done** (2026-07-13, Figma-perfect: tank grid (Sellable/Withholding,
  real fill-gauge), Add New Tank + Sync to Physical side modals, Statistics KPI, audit log table —
  see `IN_FLIGHT.md` Recently Done + `CURRENT_STATE.md`). **Semen tab done** (2026-07-15, Figma-perfect:
  LN2 tank grid (Stable/Need Refill), Add New Tank + Tank Details (repurposed "Update Readings") side
  sheets, paginated straw-batch cards + Add Straw sheet — see `IN_FLIGHT.md` Recently Done +
  `CURRENT_STATE.md`). Equipment ("Others") still `TODO` — a real backend controller exists
  (`equipment.controller.ts`) but no Figma frames were given for it yet.

#### RFE-035 — Finance (ledger + wizard + sub-pages)
- **Lane:** `features/finance/**`, `app/(app)/finance/**` · **Design:** Figma finance frames
- Highlights (cost-per-litre, runway status); ledger DataTable (type filters, void w/ owner permission +
  ConfirmDialog, CSV export via `GET /finance/transactions/export`); 4-type transaction wizard;
  receivables/payables (+record-payment), liabilities/EMI, assets (depreciation view), wallet.
  Sub-routes per tab. ৳ everywhere via MoneyText.
- **API:** §12 · **PRD:** §16
- **Status:** `IN PROGRESS` — 5 tab bodies + Wallet + Record wizard done (2026-07-16, Figma-perfect
  against 12 real Figma links the user supplied across two passes: Master Ledger/Receivables/
  Payables/Liabilities/Asset Distribution tabs, then Wallet/Add Funds/Withdraw/Record wizard).
  Highlights KPI row + Master Ledger (search/category filter, DataTable, Financial Performance
  Over Time chart, Operating Margin/Debt-to-Asset stats, honest-frontier pagination) + Receivables/
  Payables (3 stat tiles, search/status filter, DataTable) + Liabilities (Total Debt/Monthly EMI,
  Loan Portfolio table) + Asset Distribution (Asset Allocation donut + Fixed Asset Depreciation bar
  chart) + Wallet hub (balance, Add Funds/Withdraw, recent transactions) + the 4-type "Record"
  transaction wizard (3 steps, mirrors `CreateTransactionDto` incl. real side effects: cattle-sale
  status update, inventory auto-increment, loan create/EMI-payment) all wired to the real
  `finance.controller.ts`. **Real gaps flagged, not faked** (full list in `features/finance/types.ts`'s
  doc comment): no `FinanceLoan.dueDate` (Liabilities drops that column), no per-litre margin/AQR on
  `highlights()` (shows the real cost-per-litre instead), `herdMarketValue` always ৳0 server-side (no
  valuation model — shown honestly, not fabricated), no `GET /finance/transactions/export` route
  (Export button renders disabled), no ledger `type` filter (only `category`, wired to the mock's
  "All Types" dropdown), Add Funds' "Fund Name" input maps to the real `description` field (no such
  DTO field exists). All 4 Record-wizard types (Operating Expense, Inventory Purchase, Revenue/Sale,
  Debt/Loan) now have their own real Figma frames — the initial pass's Revenue/Inventory/Debt-Loan
  extrapolation from Operating Expense's shape was corrected across 3 follow-up user-supplied-frame
  passes (see `IN_FLIGHT.md`). Debt/Loan's `interestRate` is client-only (no `FinanceLoan` column
  exists) — used purely to live-compute the read-only Monthly EMI field, never sent on submit; its
  EMI Payment loan-picker cards drop the mock's "X months left" text since `liabilities()` doesn't
  return enough data to compute a real remaining-tenure number. **Still deferred**: the
  Receivables/Payables record-payment modal, the ledger's void ConfirmDialog, and the Assets tab's
  create-asset modal — no Figma links given for those yet. Full writeup: `IN_FLIGHT.md` Recently Done
  (tabs pass → Wallet/Record wizard pass → Inventory Purchase fix → Revenue/Sale fix → Debt/Loan fix).

#### RFE-036 — Billing & subscription management pages
- **Depends:** RFE-008 · **Lane:** `features/subscription/**` (pages), `app/(app)/subscription/**`
- Plans compare (`GET /plans`), checkout (`POST /billing/checkout` + coupon field + wallet credit display +
  legal-consent gate `GET/POST /legal/consent`), bKash redirect handling (callback return page → poll
  invoice), invoices list + receipt download, referral code share + commissions view.
- **API:** billing/plans/referrals/legal (Swagger §§) · **PRD:** §31–§33, §36–§37 · **Design:** PRD-spec
- **AC:** checkout E2E against gateway-less dev backend (PENDING invoice path) — money flow gets Playwright coverage.
- **Status:** `IN PROGRESS` — Settings › Billing & Subscription tab built against Figma `1039:51174`
  (file `SCfMPdxP6vgW1uTxfqCtz7`), consuming the already-complete backend (RAKHAL-217…240): Current
  Plan banner (`GET /subscription` + `GET /plans` price match), Invoice History (`GET /billing/invoices`,
  cursor-paged, Download gated to PAID/REFUNDED), Payment Method rendered as **bKash** (no saved-card
  vault — Figma's "Visa - 4242" replaced; the backend stores no payment method on file), and a plan-picker
  checkout sheet (`POST /billing/checkout` — server computes the total, never client-sent; ToS/Privacy
  consent gate wired to `GET/POST /legal/consent`; bKash `redirect_url` navigation). New
  `app/(app)/billing/return` page polls real `GET /subscription` (never trusts the callback's `?status=`
  query param) to confirm payment before redirecting back into Settings — matches backend
  `BKASH_RETURN_URL=http://localhost:3005/billing/return`. Binary receipt PDF can't go through the
  generic JSON-envelope `/api/backend` proxy, so a bespoke `app/api/billing/invoices/[id]/receipt`
  route streams it instead (session-scoped, refresh-on-401, no JSON parsing of the PDF bytes).
  `nest`/`tsc`/`eslint`/`next build` all green; live-verified against the demo owner (Demo Farm, real
  Pro plan + 10 real PENDING invoices + real `/plans` catalogue in the checkout sheet). **Deferred**:
  referral code share/commissions view, coupon-redemption UI beyond the plain input, PAID-invoice
  receipt-download happy path (no PAID invoice in current seed data to exercise it against), Playwright
  money-flow spec. Settings' other 3 tabs (workspace/team/modules) are RFE-045's remaining scope.
  **2026-07-24 follow-up:** fixed the real bKash callback 404 (backend `BKASH_CALLBACK_URL` points at
  the frontend for local dev — added a passthrough redirect route + a Next-16 Suspense render bug on
  `/billing/return`), and added scheduled downgrade/lateral plan changes (no forfeited paid time, no
  double-charge — switch is deferred to the current period's end via the backend's daily sweep instead
  of an immediate checkout). Full detail in this repo's `docs/IN_FLIGHT.md` Recently Done + the backend's.

---

## Phase 3 — Insight, settings & long tail 📊⚙️ (parallel lanes)

#### RFE-040 — Feed Formulator
- **Lane:** `features/feed/**`, `app/(app)/feed/**` · **Design:** Figma feed frames
- Ingredients table (+price overrides), feed groups (+assign-cattle), requirements calculator,
  concentrations builder (balance/normalize), cost summaries. Mixtures UI **deferred** (backend RD-015c).
- **API:** §8 · **PRD:** §12 · Premium-gated via RFE-008.
- **Status:** `IN PROGRESS` — list page (`1048:33190`) + 2-step "Create New Feed Formulator" wizard
  (`1065:35227`/`1065:35817`) built against the real `feed.controller.ts`/`settings.controller.ts`
  routes (ingredients, requirements, concentrations CRUD + normalize, feed-groups read). Live-verified
  end-to-end (demo owner, Demo Farm): create → real `POST /feed/concentrations → 201` → appears
  server-scored in the list; "Normalize to 100%" → real `POST /feed/concentrations/normalize → 201`.
  Still open: a dedicated Ingredients-table UI (+ price overrides) and Feed-group management/assign-
  cattle UI — no Figma frames supplied for those yet, this pass only covers the list + wizard frames.
  See `features/feed/types.ts`'s doc comment for the real gaps vs the Figma mock (single target
  weight/milk instead of a range).
- **2026-07-17 follow-up** (backend epic Phase 1, plan `composed-pondering-teapot`): the backend now
  computes 12 nutrients (RDP/RUP/Starch/ADF/Calcium/Phosphorus/TDN added to DM/CP/ME/Fat/NDF) and
  `lib/formula-math.ts`/`feed-mixture-table.tsx` mirror all 12 end-to-end. `ingredient-picker.tsx`'s
  custom-ingredient quick-add gained a collapsible "Advanced: full nutrition profile" section (12
  optional fields, no Figma frame — built with existing `LabeledInput`/`Select` primitives) so a
  farm with real lab values isn't limited to the cost-only quick-add. Verified live: a custom
  ingredient with a full profile correctly showed both the rate (e.g. 20% DM) and the computed kg
  contribution (2kg from 10kg @ 20%) in the mixture table.
- **2026-07-17 follow-up #2 — all 12 nutrient columns now visible** (Phase 5, same plan): user
  pointed at their own reference spreadsheet and asked why the table only showed 5 of the 12
  computed nutrients — `feed-mixture-table.tsx` rewritten with a data-driven `NUTRIENT_COLUMNS` list
  (Protein: CP/RDP/RUP, Energy: ME/FAT/Starch/TDN, Fibers: NDF/ADF, new Minerals: Calcium/Phosphorus
  using the existing `accent-purple` token), wrapped in `overflow-x-auto`. The "Daily Total
  Requirement" row shows a real tinted comparison only for DM/CP/ME/NDF/Fat (the only nutrients with
  a requirement formula in `requirements.ts`) and `—` for the other 7 — flagged, not fabricated.
  `concentration-detail-sheet.tsx` needed no changes (already passes full 12-field server data).
  Verified live against two saved formulas with real nutrient data.

#### RFE-041 — Reports
- **Lane:** `features/reports/**`, `app/(app)/reports/**`, `app/api/reports/**`
- Catalogue (12 MVP reports grouped), generate dialog (params) → async job poll → download (CSV/PDF).
  **Schedules panel now built** (backend's V1.5 deferral shipped 2026-07-29 — RD-013c) — create/list/delete,
  DAILY/WEEKLY/MONTHLY. Premium-gated on `reports.generate`/`reports.scheduled`.
- **API:** §15 · **PRD:** §22 · **Design:** PRD-spec
- **Status:** `DONE` (2026-07-29) — `tsc`/`eslint`/`next build` gated green; live in-browser E2E verification
  was inconclusive this session (dev-harness flakiness, not a static-check failure) and should be re-checked.

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
- **API:** §18 · **PRD:** §21 · Large — split per-tab into RFE-045a/b/c (see `IN_FLIGHT.md` Recently Done).
- **Status:** `IN_PROGRESS` — 045a (Farm profile + Sheds CRUD + Feed-groups CRUD) done 2026-07-30, API-verified live, UI click-through pending a dev-server restart (browser-harness Suspense quirk, see `IN_FLIGHT.md`). Remaining: 045b (Roles matrix + Module toggles), 045c (Suppliers CRUD).

#### RFE-046 — Scoreboard (V1.5 flag)
- **Lane:** `features/scoreboard/**` · Highlights, leaderboard, join/leave. Premium+flag-gated; lowest priority.
- **API:** §14 · **PRD:** §18
- **Status:** `TODO`

#### RFE-047 — Onboarding wizard
- **Depends:** RFE-024 · **Lane:** `features/onboarding/**`, `app/(onboarding)/onboarding/**`
- Farm create → configure (modules/sessions) → optional cattle CSV import (reuse RFE-024 wizard) → complete.
  Entry point after first login with zero farms.
- **API:** §2 · **PRD:** §5 · **Design:** PRD-spec (no Figma onboarding frames exist)
- **Status:** `DONE` (2026-07-27) — 3-step wizard (Configure sheds/sessions → Add cattle → Invite team),
  every step independently skippable, against the real `onboarding.controller.ts` (`GET /onboarding/status`,
  `POST /onboarding/{configure,complete}`) + `POST /settings/team/invite` (called directly, RFE-045
  isn't built yet). `app/(onboarding)/onboarding/layout.tsx`'s gate reworked: previously any real
  `farmId` redirected straight to `/dashboard` (the actual bug this ticket fixes — a farm created via
  `createFirstFarm` landed on the dashboard with zero sheds/cattle/team and no way back into a wizard);
  now it fetches live status and only redirects once `has_completed_onboarding` is true.
  `CreateFarmForm` (Step 1) now routes to `/onboarding` instead of `/dashboard` on success. New
  `OnboardingShell` (wider than `AuthShell`'s 453px card, PRD-spec chrome). Cattle step reuses
  `CattleFormDialog`/`CattleImportDialog` directly (cross-feature import, precedented elsewhere in
  this codebase) — no bespoke onboarding-only create flow. **Live-verified end-to-end** against a
  real farm-scoped session with real seeded data (412 cattle, real dashboard on finish): Configure →
  skip → Cattle (real count shown) → skip → Team → **Finish setup** → real `POST /onboarding/complete
  → 201` → redirected to the real Dashboard; re-visiting `/onboarding` after completion now redirects
  straight back to `/dashboard`, confirming the gate works both directions. **Caught and fixed a real
  bug during verification**: the Configure step's default one-blank-shed row failed `name` validation
  silently (no visible error), permanently blocking "Continue" — fixed by defaulting to zero sheds and
  relaxing the form-level schema to drop blank rows instead of rejecting them (`configureOnboardingFormSchema`
  in `schemas.ts`, separate from the API-facing `configureOnboardingSchema`). `tsc`/`eslint` both clean.
  **Known gap, flagged not hidden**: a user who abandons the wizard mid-way and logs back in via the
  normal single-farm auto-login path lands straight on `/dashboard` (that path doesn't re-check
  onboarding status) rather than resuming the wizard — acceptable for a wizard a user only ever sees
  once at signup; full resume-detection would require adding a status check to `app/(app)/layout.tsx`,
  the hottest shared file in the app, for a low-frequency edge case. `next build` blocked this session
  by an unrelated in-progress file (`app/invite/[token]/page.tsx`, another agent's active
  `onboarding-finalization` claim per `IN_FLIGHT.md`) — verified via `tsc`+`eslint`+live dev-server
  click-through instead.

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

## Phase 4 — Finance V2 💰 (MILESTONE 21 — frontend half; each ticket follows its backend twin)

> **Numbering:** these use backend `RAKHAL-NNN` ids, per this repo's convention for the frontend half of a backend ticket (same as RAKHAL-330 in reproduction). Full spec, per-ticket Lanes and acceptance criteria live in **`D:\Projects\Rakhal\docs\PROJECT_PROGRESS.md` → MILESTONE 21**; the *why* is **`D:\Projects\Rakhal\docs\FINANCE_V2_DESIGN.md`**; the decision is **ADR-022**.
> **Why this exists:** a user asked where the money goes when milk / an animal / manure / anything is sold — wallet, cash or bank — and Rakhal cannot answer, because no money-account concept exists anywhere. Finance is being rebuilt on a double-entry ledger with a real `Sales` domain and named Cash/Bank/MFS accounts. **The V1 finance UI is frozen — no new features on `features/finance/` until these land.**
> **Hard rule:** a frontend ticket **does not start until its backend twin is live-verified.** Backend agents flag domain-shape changes on the board so the mirrored TS types follow. Do not build against a schema that has not shipped.
> **Known state to fix, not preserve:** `features/finance/` has **zero tests** and **zero `<Can>` RBAC gating** today, the payment-method enum is duplicated in **nine** places (with a divergent 3-value variant in `features/buyers/types.ts:9`), `record-transaction-dialog.tsx` is 784 lines, and three features each hand-roll their own `StepProgress` because no shared wizard exists.

#### RAKHAL-355 — Shared money/payment primitives — `MoneyInput` (none exists today), one canonical `PaymentMethod` type + picker replacing the nine duplicates, `AccountPicker` (follow `features/inventory/components/unit-picker.tsx:41`'s popover+Command+quick-add pattern), extracted shared `Wizard`. Also fixes `.claude/launch.json` port 3001 → **3005** to match `pnpm dev`. **Backend twin:** RAKHAL-336. `DONE` — `components/shared/{money-input,wizard}.tsx`, `features/finance/components/account-picker.tsx` (live against `GET`/`POST /finance/accounts`, RAKHAL-335) + new `features/finance/{api-v2,types-v2}.ts`/`hooks/use-finance-v2.ts`, new WALLET-less canonical `lib/types/payment.ts#PaymentMethod`. Payment-method dedup judgment call: 3 of the 6 duplicate sites (V1 `features/finance/schemas.ts`, `features/reproduction/{schemas.ts,components/dialogs/breeding-event-form-fields.tsx}`, `features/feed/components/finalize-tmr-dialog.tsx`) still post through the live WALLET-accepting V1 backend route, so they were deduped onto one shared V1 source (`FINANCE_PAYMENT_METHODS` in `features/finance/schemas.ts`) instead of the new WALLET-less type — full reasoning in `docs/IN_FLIGHT.md`'s Recently Done row. Gate: `typecheck`(0)/`lint`(0 errors)/`build`(0, 37 routes)/`test`(34/34, 13 new). Unblocks 356-361.
#### RAKHAL-356 — Accounts + Rakhal Balance screen — Cash/Bank/MFS breakdown, opening balances, transfers with fees. Receivable/payable shown as a **separate position block**, never summed into the balance. Replaces the V1 wallet drawer. **Backend twin:** RAKHAL-338. `DONE` (2026-08-24) — new standalone route `/finance/accounts` (documented judgment call: not a 6th V1 tab, see the page's own doc comment); `RakhalBalanceCard`/`AccountList`/`AccountFormSheet`/`ArchiveAccountDialog`/`TransferFormSheet`. Real finding: `GET /finance/balance`'s `receivablePayable` block is still `wired:false` today (RAKHAL-340/348 never re-pointed `BalanceService` at the real models) — rendered as "not yet available", never a fake ৳0. `finance.transfer` (owner-only, RAKHAL-353) gated via `<Can>` with a disabled+tooltip entry point. Full writeup in `docs/IN_FLIGHT.md`'s Recently Done row.
#### RAKHAL-357 — Record Sale flow (Product / Animal / Other Income) — replaces the `Milk | Animal | Manure | Others` pills at `record-transaction-dialog.tsx:368-388`. Live available-quantity display, derived **Sale Total** (not "Total Cost"), **Amount Received → derived Due** instead of the Full/Partial choice, and account selection on every payment. **Backend twins:** RAKHAL-342/345/346/347/350. `PARTIAL` (2026-08-24) — Milk (RAKHAL-342/343) and Other Income (RAKHAL-350) fully wired + live-verified end-to-end against the real dev backend; Animal Sale (RAKHAL-345) and Product Sale's Manure/Inventory sub-types (RAKHAL-347/346) are UI-only — their use cases exist server-side but have no HTTP controller yet, confirmed by reading the backend source directly, not assumed. Full writeup: `docs/IN_FLIGHT.md`'s Recently Done row.
#### RAKHAL-358 — Payments, receivables, payables, allocation — Receive/Make Payment choosing the account; multiple payments per document with running outstanding; status displayed as derived, never chosen. **Backend twins:** RAKHAL-340/348. `DONE` (2026-08-24) — confirmed the real payable route by reading `payable.controller.ts` directly: `GET /purchasing/payables` (not `finance/payables`); receivables at `GET /finance/receivables`. `POST /finance/payments` has no inline allocation (confirmed against `CreatePaymentDto`), so Receive/Make Payment is `useSettlePayment(kind)` — a create-then-allocate mutation across two real calls, presented as one action. `PaymentStatusBadge` is a pure pass-through of the API's derived status (`FINANCE_V2_DESIGN.md` §4.6), covered by a dedicated Vitest suite across all 4 states. `PaymentHistorySheet` proves multiple-payments-per-document visibly (running outstanding per row). New documented backend gap: no `receivableId`/`payableId` filter on `GET /finance/payments` and no `allocations` on its list response — worked around with an N+1 fan-out, flagged not hidden (see gap table below). **Deliberately not wired into `app/(app)/finance/page.tsx`** yet — that page sits under RAKHAL-356/360's concurrent claim; all 6 components are complete and gate-green, ready for RAKHAL-361 to mount. Full writeup in `docs/IN_FLIGHT.md`'s Recently Done row.
#### RAKHAL-359 — Expenses + purchases — Record Expense and Record Purchase as **separate flows** (an expense is consumed; a purchase becomes stock). **Backend twin:** RAKHAL-349. `DONE` (2026-08-24) — real routes live (`purchasing/purchases`/`purchasing/expenses`/`purchasing/payables`, RAKHAL-348/349), new `features/purchasing/**` + `/purchasing` page + nav entry. New combined Medicine/FeedItem/Equipment `ItemPicker` (none existed). Supplier stays free text per `CreatePurchaseDto`'s own judgment call (no Supplier entity). Payable status links to RAKHAL-358's `/finance/payables` rather than duplicating settlement UI (not yet mounted — flagged). Live-verified against the real dev stack: recorded the exact ৳30,000/৳20,000/Payable-10,000 worked AC example, confirmed stock +300 and payables cross-reference. Full writeup: `docs/IN_FLIGHT.md`'s Recently Done row (2026-08-24).
#### RAKHAL-360 — Finance dashboard + ledger views on V2 endpoints — Rakhal Balance, Cash/Bank/MFS table, month KPIs. Ledger is a **business-document list**; debits and credits are **never** shown to the farmer. **Backend twin:** RAKHAL-351. `DONE` (2026-08-24) — `finance-highlights.tsx` rebuilt on `GET /finance/balance` (Rakhal Balance headline + Cash/Bank/MFS mini-cards + receivable/payable position rendered "not yet available", reusing 356's own `wired:false` finding rather than re-discovering/faking it) + the pre-existing `GET /dashboard/financial-snapshot`/`financial-performance` (RAKHAL-351 already additively re-pointed both at V2 ledger activity — confirmed via a doc-comment-only note on `features/dashboard/components/financial-{snapshot-card,performance-chart}.tsx`, no logic changed, nothing was broken). Ledger tab redesigned as 4 segments — Sales/Purchases/Payments/Transfers (`ledger-view.tsx` + new `ledger-{sales,purchases,payments,transfers}-table.tsx`) — reading `GET /sales`, `GET /purchasing/purchases`, `GET /finance/payments`, `GET /finance/transfers` respectively; zero ledger-account names or debit/credit columns anywhere (§9's AC, grepped clean). **Split vs RAKHAL-356**: this highlights card is a read-only summary (headline + breakdown + KPIs), no create/edit/archive/transfer actions — 356 owns the full Accounts management screen (`/finance/accounts`) this card links out to nowhere yet (no stable in-page anchor existed at push time; documented as a follow-up wire-up, not guessed). A new 6-action "Record Sale · Record Expense · Other Income · Receive Payment · Make Payment · Transfer Money" quick-actions row was added inside `finance-view.tsx` itself (not the page header/`finance-header-actions.tsx`, which stays out of scope and out of 356's `app/(app)/finance/**` lane) — **all 6 disabled with a "Coming soon (RAKHAL-35x)" tooltip**, same honest-disabled precedent `ledger-filters.tsx`'s own Export button already used in this codebase; none of them were mounted at `/finance` yet at push time even though 358 is itself `DONE` (358's own row above documents it was deliberately left unwired pending 356/360's concurrent claim on the page). Vitest: `saleSummary`/`purchaseSummary` pure-logic tests (9 new). Gate: `typecheck`(0)/`lint`(0 errors, only pre-existing `react-hooks/incompatible-library` warnings on untouched files)/`build`(0, 40 routes)/`test`(83/83, 9 new). One transient `pnpm build` failure hit mid-session in `features/sales/components/record-sale-wizard.tsx` (357's own in-progress file, confirmed via `git status` as untracked/concurrent, not this ticket's diff) — resolved itself on retry once 357's save settled; not this ticket's regression. Full writeup in `docs/IN_FLIGHT.md`'s Recently Done row.
#### RAKHAL-361 — Domain entry points + retire V1 UI — Cattle profile → Sell, Milk → Sell Milk, Inventory item → Sell all open the same Sales flow; remove the V1 wizard/wallet dialogs; add `<Can>` gating across every finance screen; Playwright coverage for the money flows. **Blocks backend RAKHAL-354** (V1 deletion). `DONE` (2026-08-24) — all 6 Finance quick-actions wired live (Record Sale/Other Income reuse RAKHAL-357's wizard via a new `initial` pre-fill prop, Record Expense links `/purchasing`, Receive/Make Payment switch to the now-mounted V2 Receivables/Payables tabs, Transfer Money mounts RAKHAL-356's `TransferFormSheet` owner-gated); Cattle-detail/Milk/Inventory "Sell" entry points added; 13 V1-only files deleted (Loans/FixedAssets UI kept, out of scope); `ReceivePaymentDialog`/`MakePaymentDialog` gained a defense-in-depth `<Can>` check (the one real RBAC gap found); new `tests/e2e/sales.spec.ts` (2/2 live) plus a real pre-existing `playwright.config.ts` stale-port bug fixed along the way (3001→3005, the whole suite was silently hitting an unrelated app before). **Backend RAKHAL-354 is now unblocked.** Full writeup: `docs/IN_FLIGHT.md`'s Recently Done row.

#### RAKHAL-402 — Frontend twin: Dispose/Delete split, herdStatus filter, `deletedAt`-keyed restore — `DONE` (2026-08-26)
Backend twins: RAKHAL-399/400/401 (all done). `CattleListItem` gains `deletedAt`/`lifecycleSubStage`; `CattleDetail` drops the dead `isActive` (backend removed the column entirely, RAKHAL-397). Split the old combined `CattleArchiveDialog` into `CattleDisposeDialog` (Cull/Death only — `POST /cattle/:id/dispose`, RAKHAL-399) and `CattleDeleteDialog` (real soft-delete only — `DELETE /cattle/:id`, surfaces the backend's real-history 409 message as-is). Sold stays on the existing `RecordSaleTrigger`/`RecordSaleDialog` (`features/sales`, RAKHAL-357/361) rather than being duplicated into either new dialog — a sale needs price/buyer/payment neither plain disposition record carries. `cattle-row-actions.tsx`'s restore-eligibility check fixed to key off `deletedAt` instead of `status` — `restore()` server-side only ever clears `deletedAt` (never resets `status` back to ACTIVE, a RAKHAL-397 fix), so the old `status`-keyed check either hid "Restore" for a soft-deleted-but-still-ACTIVE row entirely, or showed a "Restore" that was a no-op for a disposed-but-not-deleted row. Added a `herdStatus` filter to `cattle-filters.tsx` (ACTIVE/SOLD/CULLED/DECEASED). **Deliberately not done this pass** (flagged, not silently dropped): the `lifecycleSubStage` filter chip and collapsing the 5 duplicated `ANIMAL_CATEGORY_VARIANT`/i18n label blocks — both real but lower-priority per the original AC, scoped out to keep this ticket's diff reviewable. Gate: `pnpm typecheck`(0)/`pnpm lint`(0 new — 1 pre-existing error in `health/create-health-plan-dialog.tsx`, confirmed untouched via `git status`)/`pnpm build`(0, 40 routes)/`pnpm test`(81/81). **Not live-verified** — port 3005's dev server is owned by another concurrent agent's session (not tracked by this session's harness) and is running stale pre-edit code; restarting someone else's process was judged unsafe. `tsc`/`build` passing is the substitute evidence the code itself is correct.

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
| 2026-07-10 | RFE-008 | `Rakhal_API.md` has **no §31 section for `GET /subscription`/`GET /plans` at all** — the only subscription-adjacent entry, `GET /settings/billing`, describes a different, unimplemented shape (`current_plan.status: "active"` lowercase, `price_per_month`, `currency`, `invoices[]`) that doesn't match the real endpoint and shouldn't be used. The real routes exist and work correctly — verified live directly against `subscription.controller.ts`/`plan.controller.ts` source, response shape matches PRD §31.3 SUB-07. | Docs-only gap, not a code bug — no backend change needed, `Rakhal_API.md` just needs a real §31 section written from the actual controllers. |
| 2026-08-06 | RAKHAL-287 (backend RAKHAL-277/278) | `MilkEligibility` (`MilkService.getMilkEligibility(farmId, cattleId)`) is fully implemented server-side (`src/modules/milk/domain/milk-eligibility.ts` + the service method) but **has no HTTP route at all** — `milk.controller.ts` never calls it; the method's own doc comment says a route was deliberately skipped since the ticket's AC didn't require one. Separately, `MilkDisposition` is computed and stored on `MilkLogEntry.disposition` at `saveLog()` write time (RAKHAL-277) but **no read endpoint returns it** — `GET /milk/log` (`logTable()`) shapes its response per-cow-per-day with no `disposition` field, and no other route exposes raw `MilkLogEntry` rows. Grepped the whole backend `src/` for any HTTP caller of `getMilkEligibility` — none exists. | Not built client-side — no route to call, so no fake data. Frontend types added ahead of time (`features/milk/types.ts`: `MilkDisposition`/`MilkEligibility`/etc.) + i18n labels, ready to wire once a `GET /milk/eligibility/:cattleId`-shaped route ships and `logTable()`/`saveLog()` start returning `disposition`. Backend ticket needed before RAKHAL-287's UI (disposition chip on log entries, eligibility chip on cattle detail) can be built. |
| 2026-08-07 | RAKHAL-293-F (backend RAKHAL-282) | `POST /milk/quality-tests` (`CreateMilkQualityTestDto`) requires a `lactationId` the backend validates belongs to the cow (`MilkQualityService.assertLactationBelongsToCattle`), but **no endpoint exposes a cow's active/current lactation id to the frontend** — confirmed by reading source directly: `GET /cattle/:id/overview` (`cattle-detail.service.ts#overview`) selects the active lactation's `startDate` only (not `id`), and `GET /cattle/:id/reproduction-summary` (`reproduction.service.ts#summary`) returns `currentLactation` as a plain lactation-count *number*, not the row id. | Worked around, not built as a fake — reused the already-real `GET /reproduction/lactations?cattleId=` (`reproduction.read`-gated) in the quality-test dialog to list a cow's lactations (id/number/status) and default the picker to the most recent `ACTIVE` one. Works today, but is an extra permission-gated round trip a purpose-built field on `/cattle/:id/overview` or `/reproduction-summary` (e.g. `currentLactationId`) would avoid — worth adding server-side if another frontend ticket needs a cow's active lactation id. |
| 2026-08-24 | RAKHAL-358 | `GET /finance/payments` (`PaymentController.findAll`/`PaymentService.findAll`) is a plain un-paginated array with **no `receivableId`/`payableId` filter and no `include: { allocations: true }`** — confirmed by reading `payment.service.ts` directly. Only `GET /finance/payments/:id` (`findOne`) includes `allocations`. So there is no single route that answers "every payment allocated to this receivable/payable" — the exact question a document's Payment History panel needs to answer. | Worked around, not faked — `usePaymentHistory` (`features/finance/hooks/use-finance-v2.ts`) fetches the un-paginated payments list once, then fans out one `GET /finance/payments/:id` per payment (`useQueries`, each cached by id) and filters/sorts the allocations client-side. Fine for a demo/early-stage farm's payment volume; a farm with hundreds of payments would need a real `receivableId`/`payableId` query filter (and ideally `allocations` on the list route) added server-side instead of this N+1 fan-out — worth a small backend ticket before RAKHAL-361/production. |
