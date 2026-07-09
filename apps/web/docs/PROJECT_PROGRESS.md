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
- **Status:** `TODO`

#### RFE-004 — UI primitives + shared composites
- **Depends:** RFE-002 · **Lane:** `components/ui/**`, `components/shared/**` (exclusive during build-out)
- Build the full DESIGN_SYSTEM.md §3 inventory. DataTable must do cursor pagination, URL-synced filters
  (nuqs), selection, mobile collapse, all four states.
- **AC:** component tests for DataTable/FormDialog/FilterBar; axe clean; every primitive tokenized.
- **Status:** `TODO`

#### RFE-005 — App shell, navigation, route skeleton
- **Depends:** RFE-003, RFE-004 · **Lane:** `app/(app)/layout.tsx`, `components/layout/**`, all route stubs
- AppShell per PRD §6.1/§6.2: sidebar (all MVP modules + Scoreboard flagged V1.5, Upgrade-banner slot),
  topbar (search placeholder, bell placeholder, theme toggle, avatar menu with On-Duty + language + logout),
  OrgSwitcher (farms list → switch-organization). Route stubs + `loading.tsx`/`error.tsx` per segment;
  `(app)` layout session guard; `not-found`.
- **AC:** authenticated shell renders with live session; mobile sidebar sheet; keyboard navigable.
- **Status:** `TODO`

#### RFE-006 — Auth pages (login / register / forgot-password / farm select)
- **Depends:** RFE-003, RFE-004 · **Lane:** `app/(auth)/**`, `features/auth/**` · **Design:** Figma auth frames
- Login (email+password → farm picker when >1 farm), register + OTP verify (`POST /auth/register`,
  `/auth/verify-otp` — verify live behavior on Swagger; email-channel OTP), forgot/reset password.
  Full Metadata/SEO on these public pages.
- **API:** §1 Auth & Session · **PRD:** §5
- **AC:** Playwright E2E: register-mock/login→dashboard smoke; VALIDATION_FAILED maps to fields; Lighthouse 100 on /login.
- **Status:** `TODO`

#### RFE-007 — Profile & session self-service
- **Depends:** RFE-005 · **Lane:** `features/profile/**`, `app/(app)/profile/**`
- `GET/PATCH /auth/me`, on-duty toggle (`PATCH /auth/me/on-duty`), PIN set/change (`PATCH /auth/me/pin`),
  language toggle (`PATCH /auth/me/language`), sessions list/revoke if exposed.
- **API:** §1 · **PRD:** §5 · **Design:** PRD-spec
- **Status:** `TODO`

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
| — | — | — | — |
