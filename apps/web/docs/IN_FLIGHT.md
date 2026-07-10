# Frontend — In-Flight Board (live concurrency lock)

> **Multiple agents work this repo in parallel.** Read this FIRST, claim BEFORE editing, stay in your lane.
> Same protocol as the backend board (`D:\Projects\Rakhal\docs\IN_FLIGHT.md`) — this board covers
> `Repos/rakhal-consumer-frontend` only.

## Protocol
1. **Before starting** — read Active Claims; pick a ticket whose files/lane don't overlap any active row.
2. **Claim** — add a row *before* editing anything.
3. **Stay in your lane** — a ticket's lane is its `features/<x>/**` + `app/(app)/<x>/**` folders. Never edit
   another active row's files.
4. **Hot shared files** (append-only, minimal-diff, **re-read immediately before each edit**):
   `app/globals.css` (tokens) · `components/ui/**` · `components/shared/**` · `components/layout/**` ·
   `lib/**` · `i18n/messages/*.json` · `types/api.ts` · `package.json` · the docs in `docs/` ·
   RFE numbering in `PROJECT_PROGRESS.md`.
   Need a new shared component/util mid-ticket? Add it as a **new file**, note it in your claim row, never
   rewrite an existing shared file another lane may be using.
5. **i18n merge discipline:** add your keys namespaced by feature (`"cattle": { … }`) at the END of the
   feature's block — JSON conflicts are the #1 parallel-agent hazard here.
6. **Phase 0 (RFE-001…010) is NOT parallel-safe** except 006/007/009/010 after 003+004 land. One agent per
   foundation ticket, sequenced per the dependency graph.
7. **When done** — gate green (DoD in `ARCHITECTURE.md` §8), move row to Recently Done, update
   `PROJECT_PROGRESS.md` + `CURRENT_STATE.md`.

## 🔒 Active Claims

| Agent | Ticket | Lane (file globs) | Started | Status |
|-------|--------|-------------------|---------|--------|
| claude | RFE-009 | `tests/**`, `playwright.config.ts`, `vitest.config.ts` | 2026-07-10 | IN-PROGRESS |

## 🟢 Recently Done (pending commit)

| Ticket | Notes |
|--------|-------|
| RFE-006 | All 5 auth pages (login/register/forgot-password/reset-password/verify-email) built against the **real** backend contract (email+password + token-link verification, not the PRD's phone/OTP) — see PROJECT_PROGRESS.md for the full writeup. New shared `AuthShell` + `components/shared/locale-toggle.tsx`. Verified LIVE end-to-end for every flow incl. error states, dark theme, mobile. **Found+fixed 2 live backend bugs** while verifying (full crash on forgot-password from a Prisma enum gap; `/verify-email` missing from `proxy.ts`'s public-paths allowlist) — backend fix logged in the backend repo's own IN_FLIGHT.md/TECH_DEBT.md (RD-034 filed + a background task spawned for the systemic issue). Gate green (lint/typecheck/build/18 unit tests). Dev server released — should unblock RFE-007's pending live smoke test. |
| RFE-007 | Profile & session self-service, rescoped to the real backend (see PROJECT_PROGRESS.md — `PATCH /auth/me/on-duty`, `/pin`, generic `/auth/me`, and `switch-organization` don't exist server-side, only `/auth/me/language` does). Real `/profile` page: account-info card (`GET /auth/me`), language card (persists `PATCH /auth/me/language` + local cookie together), sessions card (`GET/DELETE /auth/sessions`, `POST /auth/logout-all` via a new `/api/auth/logout-all` BFF route mirroring `/api/auth/logout`'s CSRF dance). New shared code: `qk.profile.*` in `lib/query/keys.ts`, `logoutAllSessions()` appended to `lib/auth/session.ts`. Gate green (lint/typecheck/build/test all pass) — **live browser smoke test still pending**, blocked by RFE-006's dev server holding the single-instance Next.js lock on this tree; didn't force-kill another agent's active server. |
| RFE-005 | Real AppShell wired into `(app)/layout.tsx` (Sidebar+Sheet, Topbar, OrgSwitcher read-only pending a backend gap, route stubs for all 18 modules + loading/error/not-found). Verified LIVE in the browser (login→farm picker→shelled dashboard→cattle stub→dark theme→mobile sheet nav), no console errors. Gate green. Details in PROJECT_PROGRESS.md |
| RFE-004 | Full `components/ui/**` + `components/shared/**` inventory built (DataTable, FormDialog/FormSheet, FilterBar, ConfirmDialog, StatCard/ChartCard, MoneyText/DateText, CattlePicker, FileUpload, empty/error/skeleton states + all Radix primitives incl. Command/Calendar). 11 component tests green. Axe/Lighthouse deferred (no real pages/e2e harness yet). Gate green. Details in PROJECT_PROGRESS.md |
| RFE-003 | Auth/session/API layer — verified LIVE end-to-end in the browser (login→farm-picker→session→real backend fetch→logout→gate). BFF-only, 3 httpOnly cookies, generic `/api/backend/[...path]` client proxy + `server-fetch.ts` for RSC, `proxy.ts` proactive refresh. Real backend contract (flat error envelope, cursor meta shape) documented in `types/api.ts`. Found+flagged a backend passwordHash-leak bug (background task) + a missing permissions endpoint (`<Can/>` built, wired to a placeholder). Minimal real login page + dashboard page (not RFE-006-final) built to prove the flow. Details in PROJECT_PROGRESS.md |
| RFE-100 | Marketing landing page at `/` (`app/(landing-page)/**` + shared `components/ui/button.tsx` + `landing.*`/`authPlaceholder.*` messages + `--cream` token/keyframes in globals.css + placeholder /login, /register). Gate green; details in PROJECT_PROGRESS.md |
| RFE-002 | Tokens/theme/fonts/i18n live — spec recorded in DESIGN_SYSTEM.md §4 |
| RFE-001 | Bootstrap: folders, deps, env.ts, scripts, ESLint, vitest/playwright configs. NB machine-level pnpm-store workaround in `.npmrc` — see CURRENT_STATE.md |
| — (knowledge base created 2026-07-09) | docs/ARCHITECTURE.md, DESIGN_SYSTEM.md, PROJECT_PROGRESS.md, this board, CURRENT_STATE.md, CLAUDE.md |
