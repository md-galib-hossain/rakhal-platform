# Migration plan: consumer apps into this monorepo

Status: **plan only.** Nothing described here has been executed. Every step below is reversible until the
final cutover step, and no step touches production without its own gate.

## Why migrate at all

`rakhal-platform` today holds the admin app and shared packages. The consumer web app
(`rakhal-consumer-frontend`) and the API (`rakhal-backend`) live in separate repositories. That costs us:

- **Duplicated UI.** `packages/ui` was *copied* from the consumer app (commit `9af1681`). Two copies drift.
- **Hand-kept contracts.** The admin app and the API agree through hand-written types and review, not a
  shared source of truth.
- **Three toolchains.** Three lockfiles, two CI setups (only the frontend has one), a Windows-specific
  `.npmrc` store path in the frontend, and a stray root lockfile in `D:\Projects\Rakhal`.

The aim is *one* place for web code and shared packages, with the deployable units unchanged.

## What this plan deliberately does **not** do

- It does not merge the databases or change the schema. One Postgres, one Prisma schema, as today.
- It does not move the Flutter app (`rakhal-app`, 1 commit, its own toolchain).
- It does not change production URLs, PM2 process names, or nginx routing until the cutover step.
- It does not touch the consumer repos while other agents hold files there (`docs/IN_FLIGHT.md` rules).

## Documents

| # | Document | Question it answers |
|---|---|---|
| 01 | [Consumer frontend](01-consumer-frontend.md) | How does `apps/web` arrive with history intact, and how do we back out? |
| 02 | [Backend and database](02-backend-and-database.md) | Should the API move, when, and what owns migrations? |
| 03 | [Shared UI dedupe](03-shared-ui-dedupe.md) | How do the two UI copies become one without a regression? |
| 04 | [CI, deploy, cutover](04-ci-deploy-cutover.md) | How do three apps deploy from one repo, and how is cutover rolled back? |
| 05 | [Risks and gates](05-risks-and-gates.md) | What must be true before each step, and what can go wrong? |
| ADR-004 | [Migration strategy](../decisions/ADR-004-migration-strategy.md) | The decisions, with alternatives. |

## The sequence at a glance

| Step | What | Reversible? | Needs owner sign-off |
|---|---|---|---|
| M0 | Preflight: freeze list, clean trees, baselines recorded | yes | yes (start) |
| M1 | Import consumer frontend into `apps/web` (history preserved), **not deployed from here** | yes (delete the folder) | no |
| M2 | Make `apps/web` build in CI beside the original; compare outputs | yes | no |
| M3 | Shared UI dedupe, one component per PR, visual-regression gated | yes (per PR) | no |
| M4 | Generate API types from the backend's OpenAPI into `@rakhal/admin-api-client` and a consumer client | yes | no |
| M5 | Cutover: production web deploys from the monorepo | rollback runbook, tested first | **yes** |
| M6 | Backend import (`apps/api`) - **optional, decide after M5** | yes until deploy moves | **yes** |
| M7 | Retire old repos (archive, never delete) after one full release cycle | archive is reversible | **yes** |

Rough effort (no dates, per the plan's rule): M0 S, M1 M, M2 M, M3 L (many small PRs), M4 M, M5 M, M6 L, M7 S.
