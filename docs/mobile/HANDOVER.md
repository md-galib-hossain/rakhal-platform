# Mobile handover (2026-11-16)

Written for agents taking over the mobile work from the Claude Code sessions that built WP4 to WP9. Read `AGENTS.md` (repo root) first; it holds the rules, commands and the run-it-locally steps. This file says **what exists, what is open, and one brief per task**.

State: `main` at `b1bc14b2` (WP9 merged). All numbers below were true then.

## 1. What is built

| WP | What | Where |
|---|---|---|
| WP4 | typed API client, envelope, single-flight refresh, `X-Client: mobile`, `headers` option | `packages/api-client` |
| WP5a-b | backend: refresh token in the body for native clients (no CSRF); login by email or username | `apps/api` auth |
| WP5c-d | auth provider, SecureStore token store, login and farm picker screens, auth gate | `apps/mobile/src/auth`, `src/screens`, `app/login.tsx`, `app/farm.tsx` |
| WP6 | tab shell (Home, Cattle, Milk, Tasks, More), header (farm name, language toggle), `can()` + `PermissionGate`, permissions from `/auth/me` cached offline | `src/navigation`, `src/permissions`, `app/(tabs)` |
| WP7 | ADR-006 offline sync design | `docs/decisions/ADR-006-offline-sync.md` |
| WP8a | backend: per-route `Idempotency-Key` (`IdempotencyService`), milk-log `baseUpdatedAt` version check with `conflicts[]`, tolerant repeat answers for task complete and milk submit | `apps/api/src/common/idempotency`, `modules/milk`, `modules/task`, `modules/health` |
| WP8b | SQLite outbox, sync loop, pull cache, header `SyncStatusPill` + sheet, sign-out guard | `apps/mobile/src/offline` |
| WP9 | read-only cattle list (local search) and cattle detail, offline fallback | `apps/mobile/src/cattle` |

How the offline layer works, in one paragraph: a screen calls `useSync().enqueue({ endpoint, method, path, body, dependsOn? })`; the row is stored in SQLite and sent in order, one at a time, with the row's UUID as `Idempotency-Key`; network and 5xx errors retry with backoff, 4xx fail only that row (kept and shown), a milk save the server partly refused becomes a `conflict` row. After the queue drains the engine pulls sheds, milk tanks, cattle and tasks (+-30 days) into `cache_rows`; screens read them with `useSync().readCache(entity, { search, limit })`. `useSync().snapshot` has the pill numbers and `lastSyncedAt`. Full detail: ADR-006 "Implementation notes".

Not built: any screen that queues a real write, the milk log, tasks and notifications screens, push, the feed grid, the sickness report, tab icons, EAS builds, Sentry, iOS.

## 2. Owner decisions that block work

Open and **not yours to decide** (report if blocked): D2 session length, D3 platforms and app identity (bundle id, EAS project, stores), D4 EAS cost, D5 Sentry, D8 Firebase project and key, D9 carried-over design items (icons, haptics, number pad, toast, undo), D10 shared zod schemas timing. Decided: D1 (email or username login, no phone yet), D6 (queued writes: milk log, sickness report, task complete; everything else online-only), D7 (per-route `Idempotency-Key`).

## 3. Tasks and who can run in parallel

| # | Task | Depends on | Blocked by | Touches (keep other agents out) |
|---|---|---|---|---|
| T1 | WP10 offline milk log | WP8b, WP9 (done) | needs the backend change in T1 step 1 | `apps/mobile/app/(tabs)/milk.tsx`, new `src/milk/`, `src/offline/pull.ts` (milk day grid), `apps/api` milk DTO |
| T2 | WP12 tasks, notifications, push | WP6, WP8b (done) | **D4, D8**; first EAS dev client | `apps/mobile/app/(tabs)/tasks.tsx`, new `src/tasks/`, `src/notifications/`, `app.json`/EAS config |
| T3 | WP11 feed grid confirm (online-only) | WP9 (done) | none | new `src/feed/`, a route under `apps/mobile/app/` |
| T4 | Sickness report (queued write) | WP8b, WP9 (done) | none; best after T1 so it reuses the same form pieces | new `src/health/`, `app/(tabs)/cattle` action |
| T5 | Path-filtered mobile CI | none | none | `.github/workflows/` only |
| T6 | Register `HealthGridCellDto` in the API | none | none | `apps/api` (a `@ApiExtraModels`), regenerate OpenAPI + client |
| T7 | Tab icons | none | **owner picks the icon library** (D9) | `src/navigation/TabButton.tsx` |

Safe in parallel: T1 + T2 (different tabs; both may add messages to `src/i18n/messages.ts` and entries to `pull.ts`: rebase carefully, keep additions append-only), T3, T5, T6. Run T4 after T1 merges.

## 4. Briefs

Each brief: do the task, one PR, report per `AGENTS.md`. "Done" always includes tsc, eslint, node tests and jest green, and an emulator run with screenshots you actually looked at.

### T1: WP10 offline milk log (the first real queued write)
**Goal.** A worker logs milk per cow per session without a connection; it syncs on reconnect, once, with conflicts handled.

**Step 1: backend first (small PR or the first commit of your PR, in `apps/api`).** `GET /api/v1/milk/log?date=&session=&shedId=` returns rows whose `log` (`MilkLogEntrySessionsDto`) has `morningL, noonL, eveningL, nightL, totalL, submittedSessions, tank, tankId, tankLocked, anomalyFlag, dispositions` but **no per-session `updatedAt`**. The phone needs it as `baseUpdatedAt` (ADR-006 section 6). Add an `updatedAt` (ISO) per session cell, keep the existing fields, regenerate OpenAPI (`pnpm gen:openapi`) and the client (`pnpm gen` in `packages/api-client`), add an e2e assertion in `apps/api/test/idempotency.e2e-spec.ts` or `milk-log.e2e-spec.ts`. The web app must keep working (additive only).

**Step 2: app.**
- Milk tab (`app/(tabs)/milk.tsx`, now a "coming soon" placeholder), gated by `milk.read`; logging needs `milk.log`.
- Session chips from the farm's configured sessions (`GET /milk/log` returns `sessionConfig`) defaulting by the clock; a shed filter (`/sheds` is cached as `sheds`); cow cards with the ghost values `prevDayYieldL` and `avgYield7d`; `StepperField` for litres (0 to 100); anomaly icon (server flags it; show it); a 5 s undo.
- Cows come from the cattle cache (reuse the WP9 list/search pieces in `src/cattle/`); cows with `withholding: true` are blocked (the server routes them to the withholding tank and a withheld cow can never go to a sellable tank).
- Save = `enqueue({ endpoint: 'milk.saveLog', method: 'POST', path: '/milk/log', body: { date, session, entries: [{ cattleId, yieldL, anomalyNote?, tankId?, baseUpdatedAt }] } })`. `baseUpdatedAt` is the `updatedAt` you last saw for that cow, or `null` when you saw no row. Omitting it means plain overwrite: do not omit it.
- Submit = `enqueue({ endpoint: 'milk.submit', ..., body: { date, session }, dependsOn: <the save's localId> })`. Editing an entry that is already **submitted** is online-only (ADR-006 section 2): disable it offline with a reason.
- Add the milk-log day grid to the pull (`src/offline/pull.ts`: a new `CacheEntity` and `PullSpec`, plus a unit test like `test/cattle-cache.test.ts`) so the screen opens offline; show "last updated".
- Each row shows saved / waiting / failed / needs review (icon + text + colour). The existing sheet (`SyncSheet`) already lists rows and has "Keep the saved version". **Build "Use mine"**: a new outbox row with a **new key**, `baseUpdatedAt` = the server `updatedAt` from the conflict, and an Activity Log line server-side (ADR-006 section 6: confirm whether `ActivityLogService.record` is already called on overwrite; if not, add it in `MilkService.saveLog` for the conflict-resolved path and say so in the PR).
- Double-tap and replay must produce one entry (the key guarantees it; test it).
- Remove or keep the dev-only "Queue a test milk entry" button on More: keep it only under `__DEV__`.

**Acceptance (from the plan).** Works in airplane mode and syncs on reconnect; each row saved/waiting/failed; double-tap and replay make one entry; withholding cows blocked; no secrets in logs; both languages, both themes. Emulator run: log offline (stop the API), kill the app, restart, reconnect, confirm one row server-side and a single `IdempotencyKey` row; force a conflict by saving the same cow/day from a second login (`manager@demo.rakhal.test`) and resolve it both ways.

**Do not.** Queue anything not listed in ADR-006 section 2; compute nutrients or tank balances on the device; change the outbox schema without a migration and a test in `test/offline-core.test.ts` style.

### T2: WP12 tasks, notifications, push
**Blocked until the owner answers D4 (EAS cost) and D8 (Firebase owner and key).** You can start the non-push half (tasks list and complete) without them; stop before the EAS dev client.
- Tasks tab (`app/(tabs)/tasks.tsx`): list from the tasks cache (`entity 'tasks'`, +-30 days) with open / overdue / done states; complete = `enqueue({ endpoint: 'task.complete', method: 'POST', path: '/tasks/{id}/complete', body: { notes? } })` (`task.complete` permission). The server answers a repeat with `alreadyCompleted: true` and `completedByName`; the outbox already treats that as done: show "Already done by <name>". Photos on completion stay online-only (ADR-006 section 2).
- Notifications: `GET /notifications`, `POST /notifications/{id}/read`, `POST /notifications/read-all` (online; cache reading is optional). Device registration: `POST /notifications/devices` with `RegisterDeviceDto { token (10-4096 chars), platform: 'android', provider: 'fcm' }` after login, `DELETE /notifications/devices` on logout.
- Push needs the first **EAS dev client** (Expo Go cannot receive FCM push on recent SDKs). The Firebase key comes from EAS secrets, never from the repo. Test push must open the right screen.
- Acceptance: token registered after login and removed on logout; test push opens the right screen; task complete works offline and syncs once.

### T3: WP11 feed grid confirm (online-only)
`GET /feed/grid`, `POST /feed/grid/draft`, `POST /feed/grid/confirm` (`FeedGridConfirmCowDto { offered_kg, refusal_kg, cost_tk }`). One-tap "as planned", refusal in kg. **Online-only** (it deducts stock and cost); disable offline with a reason. Show server cost totals; nutrient values are displayed, never computed on the device; a failed confirm keeps the draft; no horizontal-scroll table. Read the real payloads first (`FeedGridResponseDto`, `FeedGridDraftResponseDto`).

### T4: sickness report (queued write)
`POST /health/cases` (`CreateHealthCaseDto`: required `cattleId`, `careType`, `priority`; optional `condition`, `note`, `symptoms`, `temperature`, ...). Permission `healthcare.report-sickness`. Enqueue with `endpoint: 'health.createCase'`; the key is the only dedupe, so two devices reporting the same cow offline can create two cases (accepted in ADR-006: say so in the UI help text, do not try to merge). Entry point: an action on the cattle detail (`src/cattle/CattleDetailScreen.tsx`), gated by the permission.

### T5: path-filtered mobile CI
Add `.github/workflows/mobile.yml` that runs `pnpm exec tsc --noEmit`, `eslint .`, `pnpm run test:node` and jest in `apps/mobile` (and `packages/api-client` tests) only when `apps/mobile/**`, `packages/api-client/**`, `packages/domain/**` or the lockfile change. Today mobile is checked by `ci.yml` `verify` (turbo lint, typecheck, test and build for every package except web and api, on every PR). `web.yml` and `visual.yml` trigger on `packages/**`, so a change in `packages/api-client` (mobile-only) also runs the web build and the visual job: narrow those filters to the packages web actually uses. Keep job names stable (branch protection may require them). Prove it with a mobile-only and a web-only test PR, and say what you saw.

### T6: register `HealthGridCellDto`
`packages/api-client/scripts/generate.mjs` patches an unresolved `$ref` to `HealthGridCellDto` to `unknown` (known allowlist). Register the model in the API with `@ApiExtraModels(HealthGridCellDto)` where the health grid DTO is declared, regenerate OpenAPI, remove the allowlist entry, regenerate the client, confirm `pnpm gen:openapi:check` and `pnpm gen` are clean.

### T7: tab icons
Needs the owner to pick an icon library (owner decision D9) before you start. Then add icons to `TabButton`, keep the text label visible always, keep the 56dp height, check both themes and bn labels.

## 5. Before you open the PR
`AGENTS.md` "Pull request checklist". Then post, in the PR: checks run with results, emulator steps done with screenshots reviewed, **what you did not test**, and any owner decision you hit. Then stop and wait for review. Questions for the owner go in the PR description, not in a guess.
