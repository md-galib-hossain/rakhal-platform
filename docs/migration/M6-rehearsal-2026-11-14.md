# M6 rehearsal: backend into `apps/api` (2026-11-14)

Status: **rehearsal only.** Branch `m6/import-backend-rehearsal`, local, not pushed, not merged to `main`.
Production deploy, PM2 and nginx are unchanged. `rakhal-backend` (original repo) was only read.

## What was done

| Step | Result |
|---|---|
| Scratch clone, `git filter-repo --to-subdirectory-filter apps/api` | 274 commits rewritten, 1764 files, commit-map saved as `commit-map-backend.txt` |
| Audit of HEAD and all history | no secrets, no `.env`, no `secrets/`/logs; `scratch-tmp/` and `.env.staging.example` exist only in old history (untracked upstream) |
| Merge into monorepo with `--allow-unrelated-histories` | one merge commit, history preserved under `apps/api/` |
| Adapt | see "Changes" below |
| `pnpm install`, `prisma generate`, `nest build` | build exit 0 |
| Unit tests | 1598 pass, 3 fail (`sale-number.allocator.spec`, needs a real DB; identical in the original) |
| `tsc --noEmit` (test folder) | 67 error lines in both repos (pre-existing); build config 0 in both |
| `prisma migrate status` on a copy of the dev DB | 188 migrations, schema up to date |
| E2E on the DB copy | see "E2E parity" |

## Changes on the branch

- `pnpm-workspace.yaml` (root): merged the backend's `allowBuilds` and security `overrides`. **The overrides now apply to every app**, not only the API. `@parcel/watcher`, `@swc/core`, `sharp` set to `false`.
- Backend `pnpm-workspace.yaml` and `pnpm-lock.yaml` deleted. Package renamed `@rakhal/api`.
- Root `packageManager` bumped `pnpm@10.0.0` -> `pnpm@11.9.0` (the backend needs the pnpm 11 `allowBuilds` setting). **This changes the lockfile format for admin, web and mobile too.**
- `turbo.json`: `dist/**` added to build outputs.
- 71 direct dependencies in `apps/api/package.json` pinned to the exact versions the old backend lockfile resolved.

## Findings

1. **Dropping the backend lockfile silently upgrades dependencies.** The first install resolved Prisma 7.8.0 -> 7.10.1, Nest 11.1.19 -> 11.2.10, jest 30.3.0 -> 30.5.2. Prisma 7.10 surfaces the audit-table trigger error differently, so `admin-lifecycle` "audit table is append-only" failed. Exact pins fixed it. Unpin deliberately, in a separate PR, after review.
2. **pnpm 10 vs 11. DECIDED 2026-11-14 by the owner: bump the whole monorepo to pnpm 11.9.0.** Verified on the branch: `turbo lint typecheck test` for admin, mobile and the packages exits 0 under pnpm 11. NOT verified: `apps/web` build/typecheck/visual gate under pnpm 11, and the three workflows on GitHub (they use `pnpm/action-setup@v4`; the backend's own CI used `@v6` for pnpm 11, so try bumping the action if `@v4` fails). Original question: bump the whole monorepo to pnpm 11 (what this branch does), or keep the backend on `onlyBuiltDependencies` under pnpm 10. Also check `pnpm/action-setup` in the three existing workflows.
3. **The full e2e suite cannot run as one process.** `jest --runInBand` over about 220 specs ran out of memory in both repos, even at 8 GB. Not caused by the move. CI should batch specs.
4. **Backend already has CI** (`apps/api/.github/workflows/ci.yml`, pnpm 11, Node 22, Postgres service). Doc 02 and doc 05 say it has none. The nested file is inert in a monorepo and must be ported to the root workflows with a path filter.
5. **Backend `tsconfig` cannot extend `tsconfig.base.json`** (`nodenext` + emit vs `bundler` + `noEmit`). It stays standalone.
6. **`lint` uses `--fix`.** It must not run through `turbo run lint` in CI as is.
7. Backend `.env` (gitignored) was copied into the worktree for the run. It is not tracked.

## E2E parity

Compared on a copy of the dev DB (`rakhal_m6_copy`), same env, original repo vs `apps/api`:

- Batched run (25 specs per process) of all e2e specs in the monorepo: 31 suites contain failures, 71 failing tests.
- The same 31 suites re-run in the original: 70 failing tests. Every failure is pre-existing (stale schema/seed assumptions, FK teardown, throttling and similar).
- The single test failing only in the monorepo batch (`sell-milk` "rejects a sale the tank cannot supply") passes 7/7 in both repos when run alone, twice each: batch-order flakiness, not a regression.
- The one regression found along the way was the version drift in finding 1, now fixed.

Not run: a clean-DB e2e (all runs used the copy of the dev DB), a staging deploy, PM2 reload.

## Still open before a real M6

- Owner decision on pnpm 11 (finding 2) and on unpinning (finding 1).
- Port CI to root workflows with a path filter; make lint non-mutating in CI.
- Deploy runbook paths (`13-deployment-runbook.md`) for the monorepo layout, then a staging deploy.
- Gates in doc 05 for M6: V1 live, M5 stable for a release cycle, owner sign-off. Today's work was a rehearsal at the owner's request; none of those gates were waived for a merge.
- Push the `pre-monorepo-import` tag on `rakhal-backend` (not done; pushing is outward-facing).
- Re-run the import from a fresh clone right before the real merge: the backend keeps moving (RD-140 commits are landing).
