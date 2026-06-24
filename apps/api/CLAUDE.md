# Rakhaal Backend — Claude Code memory (auto-loaded)

NestJS + Prisma + PostgreSQL dairy-farm SaaS backend. **Do not redesign — follow existing patterns.**

## Read first
- `docs/TEMPLATE_OVERVIEW.md` — the bible: layering + conventions (§2), guard chain (§6), gaps (§13), reusable building blocks (§16).
- Project state + next task: `../../docs/CURRENT_STATE.md` and `../../docs/HANDOFF.md`.
- Tickets: `../../docs/PROJECT_PROGRESS.md`. Specs: `../../docs/Rakhaal_PRD_v3_Complete.md`, `../../docs/Rakhaal_API.md`.

## Reference module
Copy `src/modules/inventory/` for any new module.

## Hard rules
- Layering: `domain → application → infrastructure → presentation`.
- Farm-scoped routes: `@UseGuards(JwtAuthGuard, SessionGuard, FarmContextGuard, PermissionGuard)` + `@CurrentFarmId()`/`@CurrentUserId()` + `@RequirePermission('resource.action')`. **No `farmId` in the body.**
- Lists: cursor pagination (`CursorPaginationQueryDto`, `getCursorArgs`, `toCursorPage`, orderBy ends with `id`).
- DTOs: class-validator; every prop needs a validator decorator (whitelist strips undecorated). Reuse `src/common/dto` helpers.
- Services hold business logic + farm scoping; soft-delete; throw exceptions (global filter envelops). Map Prisma `P2002` → Conflict.
- AQR/Activity: `AqrService.applyEvent(...)` / `ActivityLogService.record(...)`. Module tasks: `TaskService.createInternal(...)`.

## Commands
- `pnpm prisma:generate`, `prisma migrate dev --name <x>`, `pnpm seed`.
- `pnpm build` / `pnpm lint` / `pnpm test`.
- Dev stack: `pnpm redis:up` + Docker `rakhal-postgres` (Docker Desktop must run). Demo: `owner@demo.rakhal.test` / `DemoPass123`.

## Definition of done
`nest build` (0) + `eslint` (0) + `jest` (green) + a live smoke test (RBAC verified with the worker), then update the docs in `../../docs/`.
