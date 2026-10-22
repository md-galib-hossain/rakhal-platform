# 01 - Consumer frontend into `apps/web`

## Current state (verified 2026-10-23)

| Fact | Value |
|---|---|
| Repo | `rakhal-consumer-frontend`, remote `git@github.com:md-galib-hossain/rakhal-consumer-frontend.git`, branch `main` |
| History | 143 commits on `main`; one extra local branch (`claude/amazing-burnell-1c4cef`); `.git` about 9 MB |
| Stack | Next 16.2.6, React 19.2.4, Tailwind v4, pnpm 10, `proxy.ts` (not middleware) |
| CI | `.github/workflows/ci.yml` (lint, typecheck, test, build; Lighthouse job) |
| Deploy | VPS, PM2 process `rakhal-web`, nginx (see `D:\Projects\Rakhal\docs\infrastructure\04, 09, 10, 13`) |
| Local-only hazards | committed `.npmrc` pins `store-dir=D:/.pnpm-store-rakhal-fe`; `node_modules.broken/`; `next.config.ts` pins `turbopack.root` because of an unrelated root lockfile; `playwright-report/`, `test-results/`, `tsconfig.tsbuildinfo` present on disk |
| Concurrency | Other agents edit `components/**`, `lib/**`, `globals.css` (see its `docs/IN_FLIGHT.md`) |

## Decision: how to bring the history in

Three options were weighed (full reasoning in ADR-004):

| Option | History | Cost | Verdict |
|---|---|---|---|
| Copy files, new history | lost | trivial | rejected: loses `git blame`/bisect for 143 commits of product decisions |
| `git subtree add --prefix=apps/web` | kept, but paths at the repo root in old commits | low | acceptable fallback |
| **`git filter-repo --to-subdirectory-filter apps/web` on a throwaway clone, then merge** | **kept, with paths already under `apps/web/`** | medium | **chosen** |

`git filter-repo` runs on a *fresh clone in a scratch directory*. The original repo is never modified.
Commit hashes in the imported history differ from the originals; the mapping is recorded
(`git filter-repo` writes `commit-map`) and committed to `docs/migration/commit-map-web.txt` so old PR links
and issue references can still be resolved.

## Steps

### M0 - Preflight (no changes)

1. Run the gates in [05](05-risks-and-gates.md) section "Before M1". In particular: the consumer repo's
   `docs/IN_FLIGHT.md` shows **no active claims**, `git status` is clean, and `main` equals `origin/main`.
2. Record baselines to `docs/migration/baseline/`: `pnpm build` output sizes and route list, test counts,
   Lighthouse scores for `/` and `/login`, and `pnpm lint`/`typecheck` exit codes. Cutover is judged
   against these numbers.
3. Tag the original: `git tag pre-monorepo-import` and push it. This is the rollback anchor.

### M1 - Import (additive)

On a scratch machine path, never inside either repo:

```bash
git clone git@github.com:md-galib-hossain/rakhal-consumer-frontend.git /scratch/web-import
cd /scratch/web-import
git filter-repo --to-subdirectory-filter apps/web          # rewrites THIS clone only
cp .git/filter-repo/commit-map <rakhal-platform>/docs/migration/commit-map-web.txt

cd <rakhal-platform>
git checkout -b migrate/web
git remote add web-import /scratch/web-import
git fetch web-import
git merge --allow-unrelated-histories web-import/main -m "chore: import rakhal-consumer-frontend into apps/web (history preserved)"
git remote remove web-import
```

Then, in one follow-up commit, **adapt rather than move**:

- Delete `apps/web/.npmrc` (machine-specific path), `apps/web/pnpm-lock.yaml`, and
  `apps/web/pnpm-workspace.yaml`; the workspace root owns installs.
- Remove the `turbopack.root` pin from `apps/web/next.config.ts` (the workspace root is now the real root)
  and add `transpilePackages: ["@rakhal/ui"]` only when M3 starts.
- Add `apps/web` to turbo (`dev`, `build`, `lint`, `typecheck`, `test`) and a distinct dev port.
- Add `apps/web/node_modules.broken`, `playwright-report`, `test-results`, `*.tsbuildinfo` to `.gitignore`
  if they came across (they should not: they are untracked in the source repo - verify with `git ls-files`).

**Exit criteria for M1:** `pnpm install` from a clean clone of `rakhal-platform` succeeds;
`pnpm turbo run lint typecheck test build --filter=@rakhal/web` is green and matches the M0 baseline
(same routes, same test counts). Nothing is deployed from the monorepo yet.

**Rollback:** delete the branch. The original repo and its `pre-monorepo-import` tag are untouched.

### M2 - Run both side by side

- CI in `rakhal-platform` builds `apps/web` on every PR (path-filtered; see [04](04-ci-deploy-cutover.md)).
- A scheduled job (or manual step) builds both the monorepo copy and the original at the same commit and
  diffs `next build` route manifests. Any difference is a bug in the import, not a feature.
- **During M1-M5 the original repo stays the source of truth.** Every change lands there first, then is
  mirrored by `git subtree pull`-style re-import of new commits (re-run the filter-repo clone and merge the
  new tip: the merge is a fast no-op for already-imported history). This avoids two live copies diverging.
  The mirror cadence and its owner are decided at M0.

### Freeze window at cutover

Cutover (M5) is the first moment the monorepo becomes the source of truth. Before it: a short code freeze on
the original repo (announced, with the `IN_FLIGHT` board cleared), one last re-import, then
`apps/web` becomes canonical and the original repo gets a README banner pointing here.

## What stays in the consumer app (not extracted)

`features/*`, `app/(landing-page)`, the farm-domain pickers (`cattle-picker`, `animal-link`,
`payment-method-picker`), i18n catalogues (`bn`/`en`), and `lib/auth` (farm-token BFF). These are product code,
not shared UI.
