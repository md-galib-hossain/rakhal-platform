# M0 preflight report - 2026-11-10

Read-only inspection. Nothing was changed in any repo. Builds and tests were **not** run (no baselines recorded
yet); this report covers repo state and import hazards only.

## Repo state

| Repo | Branch | Commits | Dirty files | vs origin/main | Tags |
|---|---|---|---|---|---|
| rakhal-backend | main | 240 | 0 | 0 ahead / 0 behind | none |
| rakhal-consumer-frontend | main | 173 | 0 | 0 / 0 | none |
| rakhal-app (Flutter) | main | 2 | 0 | 0 / 0 | none |

`pre-monorepo-import` tags do **not** exist yet (needed before M1). Trees are clean now; earlier uncommitted work
has been committed since the plan was written (it said 143 and 219 commits).

## Gate results (05-risks-and-gates.md)

| Gate | Result |
|---|---|
| V1 in production, one clean release cycle | **not met** (no production yet, per owner 2026-10-23) |
| Backend CI exists | **not met** (no `.github/` in backend) |
| Clean `git status`, `main == origin/main` | met (all three repos) |
| `IN_FLIGHT.md` has no active claim | **not met** - consumer frontend board lists about 18 claim rows; several are marked "done (pending commit)", others show no done marker in the visible text. Needs a row-by-row check before M1. |
| Restore from production backup rehearsed | not checked (needs infra doc 16 and a prod DB) |

## Import hazards found

### Backend (`rakhal-backend`)
1. **`tok.json` is tracked and committed (af59e5a, 2026-11-09), and pushed** (main == origin/main). It is 762
   bytes, holds a demo owner login and a string that matches a JWT shape. Values are not reproduced here.
   Action for owner: confirm it is an expired demo token or rotate `JWT` secrets, then remove it from the index.
   Removing it from history is a separate decision (rewrite on a throwaway clone only, per ADR-004).
2. **Build output is tracked:** `dist-qa/` (2706 files) and `dist-qa-root/` (2706 files). They are not in
   `.gitignore` (only `/dist` is). These must not be imported into `apps/api`; they inflate history and the clone.
3. Also tracked and probably not wanted in the import: `scratch-tmp/` (9 files), `plan.md`,
   `auth_implementation_stage.md`.
4. Good: `.env`, `secrets/`, `logs/` are ignored and not tracked. Pack size is 6.2 MiB, so a history-preserving
   import is cheap.
5. No CI workflow in the repo.

### Consumer frontend
1. `.npmrc` pins `store-dir=D:/.pnpm-store-rakhal-fe` (machine path; dropped at import as planned).
2. `.tmp-figma/` (6 PNGs) is tracked. Harmless, but exclude it from the import.
3. `node_modules.broken`, `playwright-report`, `test-results` are not tracked (good).
4. CI exists (`.github/workflows/ci.yml`).

## What is safe to do now (no production effect)

1. Add backend CI (lint, build, unit; e2e needs Postgres + Redis services).
2. Add `dist-qa*/`, `scratch-tmp/`, `tok.json` to the backend `.gitignore` and untrack them (own ticket, claim in
   the backend `IN_FLIGHT.md` first).
3. Add the `gen:openapi` script plus a drift check (M4).
4. Record the M0 build/test/Lighthouse baselines, ideally right before M1 so they are current.

## Still needed from the owner

- Decide what to do about `tok.json` (see Backend 1).
- Confirm the staging story for the M5 rehearsal (infra doc 14 Phase 4).
- Name the mirror owner and cadence for M1-M5 (05, decision 2).
