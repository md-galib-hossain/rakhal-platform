# 06 - Mobile track (`apps/mobile`, React Native + Expo)

Plan only. Decisions are in [ADR-005](../decisions/ADR-005-mobile-app-in-monorepo.md). This track runs beside
M1-M5 and does not block or depend on the web import.

## Reference

`D:\Projects\businessos\apps\mobile` (Expo Router, secure-store, sqlite, netinfo) and its `metro.config.js`
(watch the monorepo root, resolve from app + root `node_modules`, keep hierarchical lookup on for pnpm).
Copy the **pattern**, not the pinned versions.

## Steps

### X0 - Preconditions
- M4 done: `@rakhal/api-client` generated from the backend OpenAPI and drift-checked in CI.
- Owner signs off ADR-005 decisions 4 and 5.
- Native app identity decided (bundle id, EAS project, store accounts). No credentials in the repo.
- Firebase service-account key under `D:\Projects\Rakhal\conf` rotated and moved to EAS secrets before any push
  work. It is untracked today; keep it that way.

### X1 - Scaffold
1. Check Expo's compatibility table; record the chosen SDK, RN and React versions in the PR description.
2. `apps/mobile` from the Expo Router template; `package.json` name `@rakhal/mobile`.
3. `metro.config.js` per the reference. Add `apps/mobile/.npmrc` only if hoisting is required
   (`node-linker=hoisted`); never a machine path.
4. `tsconfig` extends `@rakhal/config`; ESLint preset from `packages/config`.
5. Create `@rakhal/validation` and `@rakhal/domain` as source-exported packages if they will have two consumers
   in the first milestone; otherwise wait.

**Exit:** `pnpm install` from a clean clone works; `pnpm --filter @rakhal/mobile typecheck lint test` is green;
the app boots in Expo Go or a dev client and renders a screen that calls `GET /health` through
`@rakhal/api-client`. Web builds are unchanged (`turbo run build --filter=@rakhal/web` equals the M0 baseline).

**Rollback:** delete `apps/mobile` and any new package; nothing else depends on it.

### X2 - Auth and farm context
Login, token storage in `expo-secure-store`, refresh, forced logout on 401/revoked. Verify with the seeded
owner/manager/worker accounts: a worker must see no manager-only action.

### X3 - Offline ADR, then offline foundation
ADR-006 (sync design) before code. Then SQLite schema, write queue, idempotency keys, `netinfo`-driven sync.
Backend ticket for idempotency keys is claimed first in the backend `IN_FLIGHT.md`.

### X4 - First vertical slice
One field-worker flow end to end offline (suggest milk log entry), then expand by module in PRD priority order.

## CI

- Path filter `apps/mobile/**`, `packages/{api-client,validation,domain,config}/**`: `typecheck`, `lint`, unit.
- A change to a shared package runs web **and** mobile jobs (turbo `--filter=...[origin/main]`).
- No EAS build on PRs. EAS builds run on `main` tags or manually. Check build quota/cost before enabling
  (cost rule: ask for scale first).

## Gates

| Step | Must be true before | Evidence |
|---|---|---|
| X1 | M4 green; ADR-005 signed off | CI run, ADR status |
| X2 | X1 exit criteria | boot + `/health` call recorded |
| X3 | ADR-006 accepted; backend idempotency ticket claimed | ADR, board row |
| X4 | X3 offline foundation tested with airplane-mode cases | test log |

## Risks

| # | Risk | Mitigation |
|---|---|---|
| 1 | Two React majors confuse Metro or pnpm hoisting | React pinned per app; hoisting tested in X1; documented clean-install steps |
| 2 | `@rakhal/ui` accidentally imported into mobile | ESLint boundary rule in `packages/config` |
| 3 | Stale shared package output | source exports only, no `dist` |
| 4 | Offline conflicts corrupt farm data | ADR-006 first; idempotency keys; server is source of truth for finance |
| 5 | EAS cost surprise | owner scale answer before enabling builds |
| 6 | Mobile work delays web migration | separate track, separate owner; no shared files except packages |
