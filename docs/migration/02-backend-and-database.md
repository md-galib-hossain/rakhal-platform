# 02 - Backend and database

## Current state (verified 2026-10-23)

| Fact | Value |
|---|---|
| Repo | `rakhal-backend`, remote `git@github.com:md-galib-hossain/rakhal-backend.git`, `main` plus `template_with_logging` |
| History | 219 commits, `.git` about 5 MB |
| Working tree | **13 uncommitted files** right now (parallel agents; admin work on this machine is also uncommitted) |
| Stack | NestJS 11, Prisma 7 + Postgres, Redis + BullMQ, pnpm |
| Prisma | one schema folder `prisma/schemas/*` (about 17 domains), `prisma.config.ts`, hand-authored additive migrations applied with `migrate deploy` |
| CI | **none** in the repo (the frontend has one) |
| Deploy | VPS, PM2 process `rakhal-api`, runbook `13-deployment-runbook.md`: `git pull --ff-only`, `prisma migrate deploy`, `pnpm build`, `pm2 reload` |
| Surfaces | `customer-api` and `admin-api` live in the **same NestJS app** (ADR-016); the admin API is the module `src/modules/admin` |

## The key question: does the API move into the monorepo?

The frontend migration is mostly mechanical. The backend is different, because it **owns the schema and the
migrations** and is deployed with a database-changing step. Moving it changes who runs
`prisma migrate deploy`, from where, and with what review. So:

**Recommendation: do not move the backend until M5 (web cutover) has been stable for one release cycle, and
treat M6 as optional.** Reasons:

1. The monorepo's main payoff (shared UI, one web toolchain) is fully delivered by M1-M5 without it.
2. A backend move has the largest blast radius (schema, migrations, jobs, secrets) and the smallest benefit
   (it already has a clean module structure and its own docs).
3. 13 uncommitted files and several active agent lanes make a history rewrite unsafe today.
4. The contract problem the monorepo was meant to solve (typed admin/consumer clients) is solved by **OpenAPI
   generation** (M4), which works across repos.

If M6 is later chosen, the safe version is below.

## M4 - Typed contracts across repos (recommended, low risk)

1. Backend already depends on `@nestjs/swagger` (admin controllers carry `@ApiTags`). Add a script
   `pnpm gen:openapi` in the backend that writes `openapi.json` (committed or published as a CI artifact).
   This is a **backend-repo change** and needs an `IN_FLIGHT.md` claim there.
2. In the monorepo, generate types with `openapi-typescript` into `packages/admin-api-client` (admin routes) and
   a new `packages/api-client` (customer routes, consumed by `apps/web`), behind a CI **drift check**: CI fails
   if the generated file differs from the committed one.
3. `apps/web` migrates feature by feature from hand-written `types.ts` to generated types. Each feature is its
   own PR; the old type file is deleted only when nothing imports it.

## M6 (optional) - Backend into `apps/api`

Only after M5 + one release cycle, and only with the owner's explicit go-ahead.

**Non-negotiable invariants**

- Exactly **one** Prisma schema and **one** migrations folder, wherever they live. Never two copies.
- Exactly **one** process runs `migrate deploy` per environment, from CI, staging first
  (infra doc 14, standing rule 2).
- The deployable stays a single NestJS process (`rakhal-api`). The monorepo does not split `admin-api` into a
  separate service as part of this migration (ADR-001 stands).

**Steps**

1. M0-style preflight on the backend: all agent lanes closed, tree clean, `main == origin/main`,
   `pre-monorepo-import` tag pushed.
2. `git filter-repo --to-subdirectory-filter apps/api` on a scratch clone; merge with
   `--allow-unrelated-histories` on a branch (same procedure as 01).
3. Adapt: path-aware `prisma.config.ts`, `nest-cli.json`, `tsconfig` extending `@rakhal/config`, delete the
   backend lockfile/workspace file, keep `docker-compose.redis.yml`.
4. Verify against a **copy** of the dev database: `prisma migrate status` clean, `pnpm build`, unit, and the
   full e2e suite green, admin routes included.
5. Staging deploy from the monorepo using the existing runbook commands with new paths; production only after
   a clean staging cycle. PM2 process name stays `rakhal-api`.
6. Remove the nested `dist`/log/secrets folders from the import (`secrets/`, `logs/`, `diff_err.log`,
   `scratch-tmp/` must not be imported - confirm with `git ls-files` before merging).

**Rollback:** the old repo remains deployable until M7. Reverting the deploy path is a one-line change in the
runbook (point the `deploy` user back at the old checkout) plus `pm2 reload`; the database is untouched
because migrations are additive and forward-only (a migration that already ran stays; rolling code back is safe
as long as the previous release tolerates the new columns, which the additive-only rule guarantees).

## Database

No change. One Postgres per environment (Neon in production per `06-neon-postgresql.md`). The admin panel
keeps reading through the API, never directly. Adding a *platform-owned* table (as in Phase 2-5) stays a
backend migration reviewed like any other.
