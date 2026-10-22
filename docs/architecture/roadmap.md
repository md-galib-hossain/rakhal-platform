# Rakhal Admin Platform — Audit, Architecture, Roadmap

## Context
Rakhal needs an internal admin panel to operate the SaaS. The request: a new independent monorepo for admin frontend + admin API, modeled on BusinessOS, with later migration of the consumer apps in. The audits changed the premise: **admin-api already exists inside `rakhal-backend`**, and the real gaps are the admin frontend, shared UI, and the unbuilt admin modules. This document is the audit + architecture + roadmap deliverable. No code is built until approved.

Decisions already made by user: (1) admin API stays in `rakhal-backend`; (2) monorepo is a new sibling dir `D:\Projects\rakhal-platform`; (3) shared UI is copied into `packages/ui` now, consumer app migrates in Phase 7.

---

## 1. Repository audit

### 1.1 BusinessOS (`D:\Projects\businessos`) — reference only
- pnpm workspaces only (`pnpm-workspace.yaml`: `apps/*`, `packages/*`), no turbo/nx, `pnpm -r` scripts, no CI, no formatter, no root lint beyond web.
- `apps/api` NestJS 11 + Kysely + Zod pipe + Postgres RLS; `apps/web` Next 16/React 19/Tailwind 4/radix/TanStack/nuqs/next-intl; `packages/shared` = domain contracts only (consumed via `dist`, a recurring stale-build gotcha). **No shared UI package.**
- Adopt: ESLint layer boundaries (`components/ui` must not import shared/features; features only via `index.ts`; fetch only in `features/*/api.ts`; custom lint banning raw colors/`window.confirm`); 3-layer tokens (`styles/tokens.css`); single `nav-config.ts` driving sidebar/mobile/command palette with `judgeGate` (module → permission); `components/shared/form` (RHF+zod, server-issue mapping); `data-table`, `filter-bar`, `confirm-dialog`, `form-drawer`, `status-registry`; URL-as-state lists (nuqs); query-key factories scoped by tenant; audit written in same txn; Zod-validated `config.ts`.
- Avoid: no CI, no turbo caching, shared consumed from `dist`, TS-version pnpmfile hacks, hand-written DB types, custom migration runner with duplicate numbers, in-process `setInterval` jobs (multi-instance unsafe), no OpenAPI, giant service files, stray root files/secrets.

### 1.2 Rakhal backend (`Repos/rakhal-backend`, NestJS 11 + Prisma 7 + Postgres)
Admin already built (`src/modules/admin/`, `src/modules/support/`):
- Separate identity `PlatformAdmin` (`prisma/schemas/admin/platform-admin.prisma`), separate `JWT_ADMIN_SECRET`, `PlatformAdminGuard` reloads admin per request, mandatory TOTP (hand-rolled), static RBAC matrix (SUPER/SUPPORT/BILLING/CONTENT) via `@RequireAdminPermission`, `PlatformAdminAuditLog`, throttled login.
- Routes: auth/2fa, plans (read), coupons, referral commissions (read), reconciliation, feed-ingredients CRUD, requirement-presets, user session revoke, crons list, feedback triage, audit list, public health.
- E2E: `admin.e2e-spec.ts` (isolation both ways, 2FA, role 403, audit, coupons), session-revoke, feed-ingredient (teardown FK fragility).
Specced, not built (PROJECT_PROGRESS 4274–4303): business dashboard (226), user mgmt incl. suspend/force-reset/impersonation (227), farm mgmt incl. suspend (228), subscription console (229), coupon/referral depth (230/231), AQR config (232), feed pricing (233 rest), protocols master (234), SMS/announcements (235), support tickets, feature flags, security monitoring (249–255).
Gaps/weaknesses to fix first:
1. Admin tokens: stateless 1h JWT, no refresh/logout/revoke/session table/IP tracking.
2. Permission checks opt-in: `GET /admin/plans` and all `AdminFeedbackController` routes have no permission key; SUPPORT_ADMIN lacks `user.manage`; `support.*` key unused.
3. Audit: free-text `action`, no before/after, no user-agent, not DB-enforced immutable, failed logins not persisted, feedback PATCH unaudited (unverified).
4. `FarmStatus.SUSPENDED` exists but is not enforced anywhere; `User.isBlocked` enforced but no admin route sets it.
5. No admin create/invite/deactivate endpoint, no MFA recovery, no password policy.
6. `/metrics`, `/health`, `/ready` unauthenticated app-level; no admin view of BullMQ queues.
7. Docs drift (`/admin/ingredients` vs `/feed-ingredients`, `AdminAuditLog` vs `PlatformAdminAuditLog`).
8. No OpenAPI → frontend contract must be generated/maintained.

### 1.3 Rakhal consumer frontend (`Repos/rakhal-consumer-frontend`)
- Next 16.2/React 19/Tailwind 4 CSS-first/pnpm 10; shadcn-style hand-maintained radix (16 pkgs), TanStack Query/Table/Virtual, zod 4, RHF, nuqs, next-intl (cookie locale, bn default), recharts, sonner, cmdk.
- BFF auth: httpOnly cookies, `proxy.ts` refresh, `/api/backend/[...path]` catch-all proxy, `lib/api/{client,server-fetch,envelope,errors}` (cursor envelope) — near-reusable.
- **No admin UI anywhere.** `Prototypes/farm-feed` is a v0 activity-log page, not admin. Root `D:\Projects\Rakhal` `package.json`/lockfile are a stray aws-sdk/sharp install (not a workspace); `conf/` holds an untracked **Firebase service-account key** (root git has zero commits — add `.gitignore` before first commit).
- Risks: repo has own `.git`; `.npmrc` machine-specific store-dir; `node_modules.broken`; parallel agents hold `components/**`, `lib/**`, `globals.css` via `docs/IN_FLIGHT.md`; `turbopack.root` pin.

---

## 2. Owner-facing vs platform admin vs shared
| Layer | Owns |
|---|---|
| Owner-facing app | Cattle, repro, health, milk, finance, inventory, feed, tasks — untouched |
| Platform admin (new) | tenant/user lookup & control, subscriptions, support diagnostics, platform config, ops visibility, audit |
| Shared domain logic | stays in `rakhal-backend` (single source of truth); admin reads via admin-api |
| Platform infra | Postgres, Redis/BullMQ, Sentry, Prometheus — consume, don't rebuild |

Admin never re-implements cattle/milk/etc.; it shows tenant-level aggregates and support diagnostics only.

---

## 3. Proposed monorepo (`D:\Projects\rakhal-platform`)
```
rakhal-platform/
├── apps/
│   └── admin/                 # Next 16 admin frontend (only app at start)
├── packages/
│   ├── ui/                    # copied generic primitives + base tokens
│   ├── admin-api-client/      # typed client generated from rakhal-backend OpenAPI
│   └── config/                # eslint + tsconfig + prettier presets
├── docs/{architecture,decisions,operations,migration}/
├── .github/workflows/ci.yml
├── package.json, pnpm-workspace.yaml, turbo.json, tsconfig.base.json, .gitignore, README.md
```
- **Create now:** the app + three packages above (tokens live inside `packages/ui/styles`).
- **Do not create yet:** `apps/admin-api`, `packages/validation`, `packages/types`, `packages/shared`, `packages/design-system`, `apps/web`, `apps/api`, `tooling/`. Add only when a second consumer exists.
- **Tooling:** pnpm 10 + **turbo** (cached build/lint/typecheck/test — fixes BusinessOS `pnpm -r` weakness), workspace packages exported as **source** with `transpilePackages` (no `dist` stale-build trap), Prettier added, CI from day one, `.npmrc` without machine paths.

### Architecture decisions
| Decision | Choice | Alternative / trade-off |
|---|---|---|
| Admin API home | `rakhal-backend` `src/modules/admin` | New app needs shared Prisma = drift risk; BFF adds a hop |
| DB access | Admin API uses same Prisma, same DB; no second source of truth | Direct DB from admin frontend rejected |
| Contract | Add `@nestjs/swagger` to backend, generate `admin-api-client` (openapi-typescript) filtered to `/admin/*` | Hand-written types drift |
| Admin auth in FE | BFF httpOnly cookies, own cookie names (`rk_admin_at`), own refresh once backend adds admin refresh | Reuse consumer `session.ts`/`proxy.ts` as copy-and-adapt, not import |
| Locale | English-only admin, no next-intl initially | Avoids the next-intl seam in shared components |
| FE state | TanStack Query + nuqs + RHF/zod (matches consumer) | — |
| Hosting | `admin.rakhal.com` separate deploy; calls `admin-api.rakhal.com/v1` | Same VPS/PM2 pattern; IP allowlist at nginx |
| CI | GitHub Actions: typecheck, lint, vitest, build via turbo | — |

---

## 4. Component reuse matrix (source = `rakhal-consumer-frontend`)
| Component | Action | Dest |
|---|---|---|
| `components/ui/*` (30 of 32: button, input, dialog, sheet, tabs, table, badge, card, select, command, tooltip, skeleton, sonner, etc.) | Copy as-is | `packages/ui` |
| `components/ui/date-picker`, `date-time-picker` | Refactor (drop next-intl/`lib/format`) | `packages/ui` |
| `lib/utils.ts` (`cn`) | Copy | `packages/ui` |
| `shared/{empty-state,error-state,table-skeleton,card-skeleton,page-header,page-card,stat-card,chart-card,confirm-dialog,row-actions-menu,pagination,truncated-text,mobile-record-card}` | Copy with minimal edits | `packages/ui` |
| `shared/data-table`, `filter-bar`, `form-sheet`, `bulk-action-dock`, `infinite-scroll-footer` | Refactor (inject labels; keep nuqs) | `packages/ui` |
| `money-*`, `date-text`, `locale-toggle`, `date-range-picker` | Rebuild/skip (bn/৳ specific) | admin-local if needed |
| `layout/{app-shell,sidebar,sidebar-nav,topbar,nav-items}` | Rebuild as props-driven `Shell` with admin `nav-config` + BusinessOS `judgeGate` | `apps/admin` |
| `layout/{org-switcher,notification-bell,global-search,user-menu,upgrade-ad,read-only-banner}` | Keep in consumer (domain-coupled) | — |
| `globals.css` tokens (colors, radius, shadow, fonts) | Split base; leave `--session-*`, `--cream`, landing keyframes | `packages/ui/styles` |
| `lib/api/{client,server-fetch,envelope,errors}`, `lib/query/client.ts`, `lib/env.ts` | Copy-adapt | `apps/admin/lib` |
| `lib/auth/permissions.tsx` (`Can`, `useCan`) | Copy-adapt to admin permission keys | `apps/admin/lib` |
| `features/*`, `cattle-picker`, `animal-link`, `payment-method-picker` | Keep | consumer |
| BusinessOS ESLint boundary rules | Adapt | `packages/config` |
Add tests for every copied shared component (consumer already has 9 under `components/shared`).

---

## 5. Admin module priority matrix
| Module | Business value | Urgency | Depends on | Pri | Phase |
|---|---|---|---|---|---|
| Admin session hardening (refresh, logout, revoke, session table, IP) | Security | High | backend | P0 | 2 |
| Default-deny permissions + audit hardening | Security | High | backend | P0 | 2 |
| Admin user mgmt (invite/deactivate/MFA reset) | Operate | High | auth | P0 | 2 |
| Farm list/detail + suspend/restore (enforce `SUSPENDED`) | Core support | High | audit | P0 | 3–4 |
| User lookup + block/unblock + force reset | Core support | High | audit | P0 | 3–4 |
| Platform overview (verified metrics only) | Visibility | Med | rollup table | P1 | 3 |
| Subscription console (activate/extend/comp/cancel) | Revenue | Med-High | farm mgmt | P1 | 4–6 |
| UI for existing coupons/reconciliation/feed master | API already built | Med | shell | P1 | 3 |
| Support triage (feedback inbox, notes, diagnostics) | Support | Med | farm/user | P1 | 4 |
| Read-only support access / time-boxed impersonation | Support | Med | audit+sessions | P2 | 4 (read-only first) |
| Jobs/queue visibility, notification delivery, integration health | Reliability | Med | backend | P2 | 5 |
| Feature flags, platform config, announcements | Ops | Low-Med | — | P2 | 5 |
| Usage analytics, reports/export, referral/fraud | Growth | Low | data | P3 | 6 |
Why P0: a privileged control plane without session revocation, default-deny RBAC and trustworthy audit is a liability; farm/user suspend are the first things support needs and suspension is currently unenforced.

---

## 6. Roadmap
Effort: S/M/L. Every phase: tests required for authz + tenant isolation; rollback = revert deploy (additive migrations only; new guards ship report-only first).

**Phase 0 — Discovery (this doc). S.** Deliverable: approved plan.

**Phase 1 — Monorepo foundation. M.**
Tasks: init repo (+`.gitignore` first), pnpm/turbo/tsconfig/eslint/prettier, `packages/config`, `packages/ui` (copy + tests + tokens), `apps/admin` skeleton (shell, nav-config, login page, theme, `/dev/ui` gallery), CI, env schema (zod), README/docs, deploy notes. Backend: add Swagger + `admin-api-client` generation script.
Dependencies: none. Security: no secrets committed; CSP/headers in Next config. DB/API: none besides OpenAPI. Acceptance: `pnpm i && pnpm dev` runs admin against demo env; CI green; `ui` tests pass. Risk: UI copy drifts from consumer (mitigate: record origin commit in package README, dedupe in Phase 7).

**Phase 2 — Secure admin foundation. L (mostly backend).**
Backend: admin session table + refresh/logout/revoke; short access TTL; default-deny permission guard (opt-out only for public); fix plans/feedback permission keys; grant SUPPORT user-ops; structured audit (`action` enum, `before/after`, userAgent, requestId, session id), persist failed logins, DB-level immutability; admin create/invite/deactivate/MFA reset + backup codes; password policy; IP allowlist option; `/metrics` auth. Frontend: login + TOTP setup/verify, cookie BFF, `Can`/route gates, 401/403 handling.
Tests: extend `admin.e2e-spec.ts` (every route 403 without permission; farm token ≠ admin; revoked session rejected; audit row per mutation). Fix feed-ingredient teardown FK.
Acceptance: no admin route reachable without explicit permission; logout/revoke effective immediately; every mutation audited with before/after.

**Phase 3 — MVP operations (read). M–L.**
Backend: `GET /admin/farms` (search/filter/cursor), `/farms/:id` (profile, owner, members, subscription, last activity from reliable sources), `GET /admin/users`, `/users/:id` (memberships, status, session count — never hashes/secrets), overview endpoint from metrics derivable today (farms total/active/suspended, users, signups/day, paid subs); defer rollup-dependent ones. Frontend: overview, farms & users lists/detail, pages for coupons/reconciliation/feed-ingredients. Acceptance: admin finds a customer by phone/email/farm name and sees account state in ≤3 clicks; pagination/empty/loading/error states; isolation tests.

**Phase 4 — Support & controlled operations. M–L.**
Suspend/reactivate farm (enforce `SUSPENDED` in `FarmContextGuard`), block/unblock user, force password reset, revoke sessions (SUPPORT allowed), reason + confirmation + idempotency key required, audit, farm activity timeline (read existing ActivityLog), support notes, feedback triage UI, read-only diagnostics. Impersonation only if later justified (explicit grant, banner, 15 min, no password/finance writes). No bulk actions. Acceptance: common support case resolved without SQL.

**Phase 5 — Reliability & SaaS ops. M.**
Queue/failed-job view + controlled retry (BullMQ), email/SMS delivery status (`EmailLog`), cron status, integration health (SMS, bKash, R2), feature flags + platform settings (new models), announcements, backup status page linking to infra runbooks; link out to Sentry/Prometheus rather than building monitoring.

**Phase 6 — Commercial & advanced. M–L.**
Plan/feature-matrix editor, manual activate/extend/comp/cancel, refunds, referral approve/clawback, usage analytics (needs `PlatformMetricsDaily` rollup), exports, privacy export/delete workflows.

**Phase 7 — Consumer migration (after V1 stable). L.**
(1) Import `rakhal-consumer-frontend` into `apps/web` with history preserved, old repo stays deployable; (2) replace its `components/ui` with `@rakhal/ui` in per-component PRs; (3) optionally import backend as `apps/api` (single Prisma schema) or leave separate; (4) Flutter app stays out; (5) retire old repos only after one release cycle of dual verification. Reversible at each step.

---

## 7. Initial backlog (Phases 1–2)
Format: scope · deps · acceptance · tests · security.

**Phase 1**
1. P1-01 Init repo & hygiene — git, `.gitignore`, pnpm workspace, turbo, tsconfig.base, Prettier — none — fresh clone installs/builds — CI smoke — no secrets, `.env.example` only.
2. P1-02 `packages/config` — eslint presets with layer-boundary rules (no raw fetch outside `api.ts`, no raw colors) — P1-01 — lint fails on violation — rule unit tests — n/a.
3. P1-03 `packages/ui` copy — generic primitives + tokens + `cn` — P1-01 — `/dev/ui` gallery renders all; light/dark — vitest per component, axe — none.
4. P1-04 `apps/admin` shell — props-driven shell, `nav-config`, `judgeGate`, topbar, theme, error/loading routes — P1-03 — responsive at 375px — nav-config unit tests — route gating is UX only.
5. P1-05 Env + API plumbing — zod env, `lib/api` copy-adapt, BFF proxy route — P1-04 — typed call to `/admin/health` — client tests — server-only secrets.
6. P1-06 Backend OpenAPI + client generation — swagger on `/admin/*`, `pnpm gen:api` — P1-01 — client type-checks against live schema — CI drift check — swagger disabled in prod or admin-gated.
7. P1-07 CI & docs — workflow, README, ADRs 001–005 — P1-01 — PR checks required — none — n/a.

**Phase 2**
8. P2-01 Admin session model (backend) — `PlatformAdminSession`, refresh rotation, logout, revoke — none — revoke effective on next request — e2e — token theft window ≤ access TTL.
9. P2-02 Default-deny permission guard — global guard + explicit `@AdminPublic()` — P2-01 — unannotated route returns 403 — e2e route-sweep enumerating all admin routes — closes opt-in gap.
10. P2-03 Permission matrix fix — keys for plans/feedback/users, SUPPORT gets session revoke — P2-02 — matrix test — least privilege.
11. P2-04 Structured audit — action enum, before/after, UA, requestId, session id, failed logins, immutability trigger — none — every mutation produces row — e2e + trigger test — redaction of secrets in metadata (test).
12. P2-05 Admin user lifecycle — create/invite/deactivate/role change, MFA reset, backup codes, password policy — P2-04 — SUPER only, audited — e2e — last-super-admin protection.
13. P2-06 Endpoint hardening — auth for `/metrics`, per-route rate limits, IP allowlist env — none — e2e — nginx allowlist documented.
14. P2-07 Admin login UI — login, TOTP setup/verify, cookie BFF, forced-logout handling — P1-05, P2-01 — happy path + expired + revoked — Playwright — httpOnly/SameSite=strict cookies.
15. P2-08 Authz FE — `Can`, route gates, 403 page — P2-07 — hidden nav + server 403 both verified — unit + e2e — UI hiding is not security; server enforced.
16. P2-09 Fix e2e fragility — feed-ingredient teardown FK, throwaway admins per suite — none — admin suites pass in parallel — existing e2e — none.

---

## 8. Migration plan summary
Consumer FE and backend stay independently deployable throughout. Monorepo gains `apps/web` only after V1 is stable, via history-preserving import, per-component `@rakhal/ui` adoption and parallel deploys. Coordinate with `docs/IN_FLIGHT.md` — no consumer-repo edits until agents release `components/**`, `lib/**`, `globals.css`.

## 9. Risks & open questions
1. Backend work (Phases 2–4) edits `rakhal-backend` — claim a row in `docs/IN_FLIGHT.md` first and respect hot-file rules (`prisma/schemas/{farm,auth,permission}/*.prisma`, `seed.ts`, `app.module.ts`, one `migrate dev` at a time).
2. **Needs your input:** is V1 already charging customers (bKash plans)? Sets Phase 6 priority.
3. **Needs your input:** impersonation required, or read-only diagnostics enough for launch? (Plan assumes read-only first.)
4. **Needs your input:** admin team size/roles — keep the 4 roles or add more?
5. Provisional: English-only admin; staging+prod; `admin.rakhal.com` behind nginx IP allowlist.
6. Firebase key in `D:\Projects\Rakhal\conf` — rotate/relocate before any commit of that tree.
7. No admin design exists; assumption: reuse consumer design language (green primary), no Figma pass scheduled.

## Verification (when implemented)
- Phase 1: fresh clone → `pnpm i && pnpm turbo build lint typecheck test` green; `pnpm dev` shows admin login against local backend (`pnpm seed` admin@rakhal.test).
- Phase 2+: backend `nest build`, `eslint`, `jest`, `pnpm test:e2e` (admin specs); frontend Playwright login/TOTP/revoke flows; route-sweep authz test; manual check at desktop + 375px.
