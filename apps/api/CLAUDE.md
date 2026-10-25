# Rakhal Backend — Claude Code memory (auto-loaded)

NestJS + Prisma + PostgreSQL dairy-farm SaaS backend. **Do not redesign — follow existing patterns.**

## Read first
- **`../../docs/IN_FLIGHT.md` — parallel agents work this tree at once. Read it and claim your ticket there BEFORE editing.** Hot shared files (`prisma/schemas/{farm,auth,permission}/*.prisma`, `prisma/seed.ts`, `src/app.module.ts`, the status docs, `RD-NNN`/`RAKHAL-NNN` numbering) are append-only + re-`Read` before each `Edit`; one `migrate dev` at a time.
- `docs/TEMPLATE_OVERVIEW.md` — the bible: layering + conventions (§2), guard chain (§6), gaps (§13), reusable building blocks (§16).
- Project state + next task: `../../docs/CURRENT_STATE.md` and `../../docs/HANDOFF.md`.
- Tickets: `../../docs/PROJECT_PROGRESS.md`. Specs: `../../docs/Rakhal_PRD_v3_Complete.md`, `../../docs/Rakhal_API.md`.

## Reference module
Copy `src/modules/inventory/` for any new module.

## Hard rules
- Layering: `domain → application → infrastructure → presentation`.
- Farm-scoped routes: `@UseGuards(JwtAuthGuard, SessionGuard, FarmContextGuard, PermissionGuard)` + `@CurrentFarmId()`/`@CurrentUserId()` + `@RequirePermission('resource.action')`. **No `farmId` in the body.**
- Lists: cursor pagination (`CursorPaginationQueryDto`, `getCursorArgs`, `toCursorPage`, orderBy ends with `id`).
- DTOs: class-validator; every prop needs a validator decorator (whitelist strips undecorated). Reuse `src/common/dto` helpers.
- Services hold business logic + farm scoping; soft-delete; throw exceptions (global filter envelops). Map Prisma `P2002` → Conflict.
- AQR/Activity: `AqrService.applyEvent(...)` / `ActivityLogService.record(...)`. Module tasks: `TaskService.createInternal(...)`.
- Cost & scale: No Kafka or heavy architecture; ask target scale (QPS, writes/sec) before introducing costly optimizations; keep schedulers/jobs from preventing DB idle suspension (e.g. Neon 24/7 wakeups).

## Commands
- `pnpm prisma:generate`, `prisma migrate dev --name <x>`, `pnpm seed`.
- `pnpm build` / `pnpm lint` / `pnpm test`.
- Dev stack: `pnpm redis:up` + Docker `rakhal-postgres` (Docker Desktop must run). Demo: `owner@demo.rakhal.test` / `DemoPass123`.

## Definition of done
`nest build` (0) + `eslint` (0) + `jest` (green) + **`pnpm test:e2e` (green)** — the automated replacement for the manual curl smoke. Add/extend an e2e spec under `test/` for new routes (harness: `test/utils/e2e.ts` → `createTestApp()` + `loginAs()`; demo owner/manager/worker + finance data come from `pnpm seed`). Needs the dev stack (Postgres + Redis) up. Then update the docs in `../../docs/`.
