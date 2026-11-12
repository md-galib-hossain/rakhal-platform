# Rakhal Consumer Frontend — Architecture

> **Scale level: MS (Medium-Scale Production)** per `D:\Projects\Templates\02-FRONTEND-WEB-ENGINEERING-FRAMEWORK.md`.
> That document + `04-UNIVERSAL-ENGINEERING-RULES.md` are the law of this repo. This file distills them into
> Rakhal-specific decisions. When in doubt, read the framework docs — do **not** improvise structure.

**Last verified:** 2026-07-09

---

## 1. What this app is

The **farm-facing web app** (customer-api consumer) for Rakhal — dairy-farm operations SaaS for 20–500-animal
farms in Bangladesh (currency ৳, **Bangla-first UI**). It consumes the NestJS backend at
`Repos/rakhal-backend` exclusively through `/api/v1` (customer surface — never `admin-api`).

- **Spec sources (in priority order):**
  1. Live Swagger: `http://localhost:3000/api/docs` (dev backend must be running — this is ground truth)
  2. `D:\Projects\Rakhal\docs\Rakhal_API.md` (incl. the **PAGE-TO-API QUICK REFERENCE** table at the bottom)
  3. `D:\Projects\Rakhal\docs\Rakhal_PRD_v3_Complete.md` (feature behavior, metrics, business rules — §6 nav, §7–§22 per-module)
  4. Figma prototype (visual design): see `docs/DESIGN_SYSTEM.md` §1
- **Never guess API shapes.** If Swagger and the API doc disagree, Swagger wins (the doc predates some tickets).

## 2. Stack (pinned decisions — do not swap without ADR)

| Concern | Choice | Notes |
|---|---|---|
| Framework | **Next.js 16.2.6, App Router** | ⚠️ Newer than agent training data. **Read `node_modules/next/dist/docs/`** (per `AGENTS.md`) before using an API you're unsure about — conventions changed. |
| React | 19.2 | Server Components default; `'use client'` only at interactive leaves |
| Language | TypeScript strict, no `any` in features | |
| Styling | **Tailwind CSS v4** (CSS-first: `@theme` tokens in `app/globals.css` — there is no `tailwind.config.js`) | Semantic tokens only; no raw hex in components |
| UI primitives | Radix UI primitives styled in-repo (shadcn-style, copied not installed as kit) | Live in `components/ui/` |
| Server state | **TanStack Query v5** (+ RSC initial fetch where it helps) | Query-key registry in `lib/query/keys.ts` |
| Client state | `useState` / URL params (`nuqs`); Zustand only if a real cross-cutting store emerges | No Redux |
| Forms | react-hook-form + zod (schemas mirror backend DTOs) | One form component per entity for create+edit |
| Tables | TanStack Table wrapped once in `components/shared/data-table.tsx` | Never re-implement pagination |
| i18n | **next-intl — `bn` (default) + `en`** | Backend defaults users to Bangla (PRD §1.4, RAKHAL-107). Non-negotiable from day one; no hard-coded UI strings, ever |
| Theme | next-themes (light/dark via token swap under `.dark`) | PRD §6.2 requires theme toggle |
| Toasts | sonner | |
| Icons | lucide-react (per-icon imports only — no barrel import) | |
| Charts | Recharts, always behind `next/dynamic` | Heavy; never in the initial bundle |
| Tests | Vitest + Testing Library; Playwright E2E; axe checks on key pages | |
| Package manager | pnpm | Latest stable versions of everything above at install time |

## 3. Folder structure (framework doc 02 §4.3 — medium scale)

```txt
app/                                # routes are THIN (<50 lines) — compose feature components
  (auth)/ login/ register/ forgot-password/
  (app)/                            # authenticated shell
    layout.tsx                      # AppShell: sidebar (PRD §6.1), topbar (§6.2), providers, guards
    dashboard/  cattle/  reproduction/  milk/  buyers/  feed/  healthcare/
    calves/  inventory/  finance/  tasks/  scoreboard/  reports/
    activity/  settings/  subscription/  onboarding/  profile/  notifications/
  api/                              # ONLY the BFF auth bridge (see §5) — no other route handlers
  layout.tsx  error.tsx  global-error.tsx  not-found.tsx  globals.css
features/
  <feature>/                        # cattle/, milk/, finance/, …one per sidebar module
    components/                     # feature-private components
    hooks/                          # TanStack Query hooks (use-cattle-list.ts, …)
    api.ts                          # ALL endpoint calls for this feature — the only fetch site
    schemas.ts                      # zod schemas mirroring backend DTOs
    types.ts                        # response/entity types from the contract
    index.ts                        # PUBLIC surface — outsiders import only from here
components/
  ui/                               # Button, Input, Dialog, Badge, Tabs, Select… (tokenized primitives)
  shared/                           # DataTable, PageHeader, StatCard, ChartCard, EmptyState,
                                    # ErrorState, ConfirmDialog, FileUpload, FilterBar, Skeletons
  layout/                           # AppShell, Sidebar, Topbar, OrgSwitcher, NotificationBell
lib/
  api/    client.ts errors.ts types.ts     # THE fetch wrapper + ApiError mapping
  auth/   session.ts permissions.ts        # useSession(), can(), <Can/>
  query/  client.ts keys.ts                # QueryClient config + query-key registry
  format.ts                               # ৳ money, dates (Intl, bn-BD/en-BD), numbers
  utils.ts constants.ts env.ts
i18n/    request.ts routing.ts messages/bn.json messages/en.json
providers/  app-providers.tsx theme-provider.tsx
types/      api.ts                         # shared envelope/pagination/permission types
tests/      e2e/ (Playwright)
docs/       (this knowledge base)
```

**Import rules:** features import from `components/`, `lib/`, `types/`, and other features' `index.ts` only —
never internals. ESLint `import/no-cycle` enforced. Route files compose; they contain no logic.

## 4. Backend contract essentials (learned from the live backend — trust these)

- **Envelope:** every response is `{ success, data, meta }`; errors
  `{ success: false, message, code, … }` unwrapped by `lib/api/client.ts` into `ApiError`.
- **Pagination is CURSOR-based** (not page-based): list endpoints take `?per_page=&cursor=` style params and
  return `meta.nextCursor`. The shared `DataTable`/list hooks implement cursor + infinite-scroll/"load more";
  do **not** build page-number pagination.
- **Tenancy is token-based.** `farmId` **never** goes in request bodies. The active farm is baked into the
  access token at login / switch-organization.
- **Login flow (important, non-obvious):** `POST /auth/login` requires `{ email, password, farmId }`.
  First login uses `farmId: "bootstrap"` → then `GET /farms` to list the user's farms → re-login (or
  `POST /auth/switch-organization`) with the chosen real farmId. The Org Switcher (PRD §6.1) uses the same flow.
- **Auth tokens:** access token (Bearer) + rotating refresh token in an **httpOnly cookie** + CSRF token
  (`GET /auth/csrf`) required on cookie-authenticated mutating auth routes (`/auth/refresh`, `/auth/logout`).
- **401 state machine (identical to other clients):** 401 → single-flight refresh → retry once → logout.
- **RBAC:** Owner/Manager/Worker; permission strings like `cattle.read`, `finance.create` come from the
  backend. UI gates with `<Can I="cattle.create">` — **never** `role === 'owner'` checks. The backend is the
  enforcer; UI gating is UX.
- **Subscription gate:** expired/past-due farms are **read-only server-side** (writes 403 with a renewal
  message) and premium features (reports/scoreboard/feed) 403 entirely on Free. `GET /subscription` returns
  status + features + limits + usage — drive "Upgrade to Pro" banner (PRD §6.1) and disabled-state UX from it.
- **i18n:** backend error messages/notifications localize via `Accept-Language` header — the API client always
  sends the active locale. `PATCH /auth/me/language` persists the user's toggle.
- **Money:** Bangladeshi Taka, **lakh grouping in both locales** (screenshots show `৳1,19,000` in the
  "English" mock too — RFE-002 verified `en-BD` does NOT produce lakh grouping in Node's ICU, only `en-IN`
  does; `bn-BD` does). **Numerals are Latin in both locales** (per product decision + the screenshots) via
  the `-u-nu-latn` extension — plain `bn-BD` defaults to Bengali digits (০-৯). `style:'currency'` places ৳
  as a *suffix* in `bn-BD` (wrong — mock always prefixes) so `lib/format.ts` manually prepends `৳` instead.
  **Verified implementation:** `lib/format.ts#formatMoney` uses
  `Intl.NumberFormat(locale === 'bn' ? 'bn-BD-u-nu-latn' : 'en-IN', { maximumFractionDigits: 0 })` +
  manual `৳` prefix. Dates: `bn-BD-u-nu-latn` (Bengali month names, Latin digits) / `en-US`. Use
  `lib/format.ts` only — never format money/dates ad hoc in components.

## 5. Auth architecture (web)

Access token must not live in `localStorage` (framework doc 02 §22.13). Pattern:

1. `POST /auth/login` from a **server action / route handler** (`app/api/auth/*`) acting as a thin BFF bridge:
   it forwards credentials, receives `{ accessToken, sessionId, user }` + refresh `Set-Cookie`, and re-sets
   cookies on our domain (access token in an httpOnly cookie too — the browser JS never sees it).
2. Server Components / route handlers attach `Authorization: Bearer` from the cookie when proxying;
   client-side TanStack Query calls go through `/api/proxy`-less direct backend calls **only if** CORS +
   cookie forwarding is configured — default: **all client fetches hit our own `app/api/` bridge** which
   attaches the token server-side. Decide once in RFE-003 and document in `lib/api/client.ts`.
3. `proxy.ts` (⚠️ Next.js 16 renamed `middleware.ts` → `proxy.ts`, identical semantics — RFE-001/002 confirmed
   in the bundled docs): no session cookie → redirect `/login` (coarse). `(app)/layout.tsx` verifies the
   session server-side (`GET /auth/me`) and hydrates `useSession()`.
4. Refresh: single-flight, retry-once, then hard logout + redirect. Logout clears local session even if the
   server call fails.

## 6. The four states rule

Every data view ships **loading (skeleton matching layout), error (ErrorState + retry + requestId), empty
(EmptyState with guidance + primary action), success**. Shared components only — a missing state is a review-blocker.

## 7. Performance — Lighthouse 100 is a per-ticket gate

Budgets on every page: **LCP < 2.0s · INP < 200ms · CLS < 0.1 · initial JS < 170KB gz per route.**

Rules (violations are review-blockers):
- Server Components by default; `'use client'` only at leaves, with a one-line justification comment.
- `next/image` for every content image (backend media URLs are signed R2 URLs — configure `remotePatterns`).
- `next/font` for fonts — Bangla needs a proper webfont (e.g. Noto Sans Bengali) + Latin companion, subset, `display: swap`.
- `next/dynamic` for charts, CSV/PDF viewers, rich editors, the onboarding import wizard.
- No barrel imports of icon/UI libs; no moment.js-class deps (use `Intl`/date-fns if needed).
- TanStack Query `staleTime` ≥ 30s on dashboards; no refetch storms.
- Route-group code splitting: heavy modules (reports, feed formulator) must not leak into the dashboard bundle.
- Semantic HTML + a11y (labels, focus, contrast ≥4.5:1, keyboard paths) — Radix gives most of it; don't break it.
- App-behind-login pages: `noindex`. Marketing/login pages: full Metadata API, OG image, sitemap/robots.
- Verify with `pnpm build` output (route sizes) + Lighthouse in CI (RFE-010) or `npx lighthouse` locally.

## 8. Definition of Done (every ticket)

1. `pnpm lint` ✓ · `pnpm typecheck` ✓ · `pnpm build` ✓ (route size within budget)
2. Unit/component tests for logic-bearing hooks/components; Playwright spec updated if the ticket touches
   auth/checkout/critical flows
3. All four data states implemented; a11y pass (labels/keyboard/axe)
4. All strings in `i18n/messages/*` (bn + en) — hard-coded UI text fails review
5. Permission-gated actions wrapped in `<Can/>`; verified against a Worker login (see seed users below)
6. Docs updated in the same change: `docs/PROJECT_PROGRESS.md` ticket status + `docs/CURRENT_STATE.md`
7. Claim released in `docs/IN_FLIGHT.md`

**Dev backend:** `Repos/rakhal-backend` — Docker `rakhal-postgres`+`rakhal-redis`, `pnpm start:dev`, seed via
`pnpm seed`. Demo logins: `owner@demo.rakhal.test` / `DemoPass123`, `worker@demo.rakhal.test` / `WorkerPass123`
(+ a manager — see backend seed). Swagger at `/api/docs`.

## 9. Next.js 16 warnings (from `AGENTS.md`)

This Next version post-dates agent training data. Known trip-wires — **check
`node_modules/next/dist/docs/01-app/`** before using: async `params`/`searchParams` (must be awaited),
caching defaults changed vs 14 (fetch is uncached by default; opt in), `unstable_instant` for instant
navigation, proxy/middleware conventions. When an API errors unexpectedly, read the bundled doc for that
API first — do not pattern-match from memory.
