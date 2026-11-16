# AGENTS.md: how to work in `rakhal-platform`

For any coding agent (Antigravity, Claude Code, Codex, ...). Read this first, then `docs/mobile/HANDOVER.md` if you were given a mobile task.
Rules here outrank your defaults. `apps/api/CLAUDE.md` and `apps/web/CLAUDE.md` + `apps/web/AGENTS.md` hold the per-app rules for the backend and the web app; this file is the repo-wide layer.

## What this is
Rakhal: a dairy-farm SaaS for Bangladesh (Bangla-first, currency BDT). One pnpm + turbo monorepo:

| Path | What | Stack |
|---|---|---|
| `apps/api` | customer + admin backend, port from `.env` (5005 in the owner's setup, 5000 is the code default), prefix `/api/v1` | NestJS, Prisma 7, PostgreSQL, Redis |
| `apps/web` | customer web app | Next 16, React 19 |
| `apps/admin` | internal admin panel | Next 16 |
| `apps/mobile` | native app (Android first) | Expo SDK 58, React Native 0.88, expo-router, React 19.3 |
| `packages/api-client` | typed mobile API client (generated from OpenAPI) | TypeScript, source-exported |
| `packages/domain` | pure TS: money, numbers, dates, digits, locale | zero deps |
| `packages/ui`, `admin-api-client`, `config` | web UI primitives, admin client, shared tsconfig/eslint | |

The root `README.md` describes the admin app only and is out of date. Packages export TypeScript source (no `dist`).

## Read before you start
- `docs/mobile/M4-mobile-plan-2026-11-15.md`: the mobile plan: requirements, work packages (WP4..WP13), owner decisions (D1..D10), risks. **Source of truth for mobile.**
- `docs/decisions/ADR-005-mobile-app-in-monorepo.md`, `ADR-006-offline-sync.md` (outbox, idempotency keys, conflict rules; read the "Implementation notes" sections).
- `docs/mobile/device-testing.md`: how to run and check the app on the Android emulator.
- `apps/api/docs/TEMPLATE_OVERVIEW.md`: backend conventions (layering, guard chain). Backend specs: `apps/api/openapi/customer-api.json`.
- Product specs live outside the repo: `D:\Projects\Rakhal\docs\Rakhal_PRD_v3_Complete.md`, `Rakhal_API.md`. Ask the owner if you cannot reach them.

## Ground rules (violations are review blockers)
1. **One task = one branch = one git worktree = one PR to `main`.** Branch from latest `origin/main`: `git worktree add ../<name> -b <branch> origin/main`. Never push to `main`. Never edit another agent's branch.
2. **Do not merge.** Open the PR and stop. The owner merges by saying "Merge when green"; only then wait for all checks and squash-merge. Never enable auto-merge.
3. **Stay in your lane.** Touch only the files your task needs. Two agents must not edit the same files. If you need a change outside your task (backend, shared package, tokens), say so in the PR instead of doing it, unless the task says to.
4. **Never decide an owner decision** (`D2, D3, D4, D5, D8, D9, D10` in the plan are open). If your task needs one, stop and report what is blocked.
5. **Secrets.** Never commit `.env`, tokens, keys, or print them in logs, chat or PR text. `apps/api/.env` is gitignored: copy it from the owner's checkout (`D:\Projects\rakhal-platform\apps\api\.env`) into your worktree only to run locally, and delete it before you commit. The Firebase service-account key (owner decision D8) is not yours to touch.
6. **Never guess an API shape.** Check `apps/api/openapi/customer-api.json` and the real response from the running API. Many list routes have no typed response in OpenAPI: read the payload.
7. **No `farmId` in request bodies.** The farm comes from the access token. Lists use cursor pagination (`limit` max 100).
8. **Cost rule (backend):** no new infrastructure, no always-on jobs, nothing that stops the database idling. Ask the owner for the target scale before an expensive optimisation.
9. **Do not rewrite shipped things:** applied Prisma migrations (add a new one), the ADRs (append notes), generated files (regenerate them).
10. **Report honestly.** The PR says what you ran, what you did not run, and what you could not verify (device, TalkBack, dark theme, iOS...). Never write "works" for something only a unit test covered.
11. Commit messages: `type(scope): summary`, for example `feat(mobile): ...`. End with your own agent attribution line, not another agent's.

## Commands (run from the repo root unless noted)
```bash
pnpm install
# mobile (cd apps/mobile)
pnpm exec tsc --noEmit
pnpm exec eslint .
pnpm run test:node                      # node:test, pure TypeScript under test/
pnpm exec jest --ci                     # component tests under src/**/*.test.tsx
# inside a git worktree under .claude/ jest finds nothing by default, use:
pnpm exec jest --ci --testMatch "**/src/**/*.test.tsx"
# api (cd apps/api)  needs Docker Desktop: rakhal-postgres + rakhal-redis (pnpm redis:up)
pnpm prisma:generate && pnpm build && pnpm exec jest
pnpm test:e2e                           # real Postgres + Redis, demo seed (pnpm seed); needed for new routes
pnpm gen:openapi && pnpm gen:openapi:check
# api-client (cd packages/api-client)
pnpm gen && pnpm test                   # regenerate types after an OpenAPI change
```
Backend done = `nest build` + `eslint` + `jest` + `pnpm test:e2e` green, plus an e2e spec for each new route (`apps/api/test/utils/e2e.ts`).
Mobile done = tsc + eslint + node tests + jest green, and a run on the emulator for anything a user sees (CI runs only typecheck, lint, and unit tests; it does not run a device).

## Run it locally (Windows, Pixel 8 emulator)
Full steps in `docs/mobile/device-testing.md`. Short form:
1. Docker Desktop up (Postgres + Redis), `pnpm seed` once. Copy `apps/api/.env` (see rule 5), `pnpm start:dev` in `apps/api`, check `http://localhost:<port>/health`.
2. Demo accounts (seed): `owner@demo.rakhal.test`, `manager@demo.rakhal.test`, `worker@demo.rakhal.test`, password `DemoPass123`. Choose "Demo Farm" (the owner also has many leftover `E2E ...` farms).
3. In `apps/mobile`: `EXPO_PUBLIC_API_PORT=<port> pnpm exec expo start --port 8081 --clear`. Open `exp://<your LAN IP>:8081` in Expo Go on the emulator (`adb shell am start -a android.intent.action.VIEW -d exp://<ip>:8081 host.exp.exponent`). The app derives the API address from Metro's host; do **not** use `10.0.2.2` (it hangs on this emulator image).
4. Expo Go cannot load the bundle with Wi-Fi off. Test offline by keeping the phone connected and stopping the API.
5. The e2e suite and device tests share one dev database. Use far-future dates, create your own rows, delete them afterwards.

## Mobile conventions
- Import local files with the `.ts` / `.tsx` extension. `erasableSyntaxOnly` is on: no enums, no constructor parameter properties.
- All user-visible text lives in `apps/mobile/src/i18n/messages.ts`, Bangla and English with identical keys and `{placeholders}` (a test enforces parity). Do not hard-code strings (dev-only screens are the exception). Avoid plurals that break in English ("1 cows"); reword instead.
- Touch targets at least 48dp, both languages, light and dark theme, system font scale up to 200%. Colour is never the only signal: pair status colour with an icon or text (`StatusBadge`).
- Permissions: `can()`, `PermissionGate`, `useAuth().permissions`; the server is the real gate.
- Offline: the core in `apps/mobile/src/offline/` is plain TypeScript behind a small SQL seam and has no React Native imports, so it runs under `node --test` with `node:sqlite`. Keep it that way. Writes the app may queue are listed in ADR-006 section 2; everything else is online-only.
- All HTTP goes through `@rakhal/api-client` (`useAuth().client`). The one exception is the `/health` probe in `src/offline/connectivity.ts`; ESLint forbids a bare `fetch` elsewhere.
- Tests: pure logic goes in `apps/mobile/test/*.test.ts` (node), components in `src/**/*.test.tsx` (jest). Harnesses: `src/test-utils/` (`auth-harness`, `sync-harness`, `mount`), `test/helpers/` (`node-sqlite-db`, `fake-api`).

## Backend conventions (short)
Layering `domain -> application -> infrastructure -> presentation`. Farm routes use `JwtAuthGuard, SessionGuard, FarmContextGuard, PermissionGuard` with `@RequirePermission('resource.action')`. DTOs use class-validator on every field. Soft-delete; map Prisma `P2002` to a conflict. Writes the mobile app queues take an `Idempotency-Key` through `IdempotencyService` (`apps/api/src/common/idempotency/`). Prisma may ask to reset the database because old migrations were edited: write the migration SQL by hand, apply it with `prisma db execute`, then `prisma migrate resolve --applied <name>`.

## Pull request checklist
- Title `type(scope): summary (WPn)`. Body: what changed, checks run (exact results), what was **not** covered, how to verify by hand.
- Docs updated: the plan row, `docs/mobile/device-testing.md` for device checks, an ADR note if a decision changed.
- No `.env`, no screenshots with secrets, no unrelated formatting churn (`expo install` reformats `app.json`: undo that).
- CI: `API`, `Web`, `Visual`, `ci` workflows in `.github/workflows/`. Wait for them; do not merge.
