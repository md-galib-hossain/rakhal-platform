# 05 - Risks and gates

## Definition of "V1 stable" (proposed - needs the owner's confirmation)

Migration starts only when all of these hold. They are proposals; the owner edits this list.

- [ ] V1 has been in production for at least **4 weeks** with no rollback.
- [ ] No open Sev-1/Sev-2 bug in the consumer app or API.
- [ ] Backend CI exists and is green (it has none today - add it first, infra doc 14 Phase 3).
- [ ] Both repos have a clean `git status` and `main == origin/main`.
- [ ] `docs/IN_FLIGHT.md` shows no active claim in either repo.
- [ ] A restore from the latest production backup has been rehearsed (infra doc 16).

## Gates per step

| Step | Must be true before | Evidence |
|---|---|---|
| M0 | V1 stable list above ticked | checklist in a PR |
| M1 | M0 baselines recorded; tag `pre-monorepo-import` pushed on the original | baseline folder + tag |
| M2 | M1 exit criteria green from a clean clone | CI run link |
| M3 | visual-regression baseline captured on the original, in M2 | stored screenshots |
| M4 | backend `IN_FLIGHT.md` claim for the OpenAPI script | board row |
| M5 | two weeks of M2 side-by-side; staging soak; rollback rehearsed; owner sign-off | runbook run log |
| M6 | M5 stable for a release cycle; backend lanes closed; owner sign-off | decision recorded in ADR |
| M7 | one full release cycle without rollback | release notes |

## Risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| 1 | Parallel agents edit the consumer repo while it is imported, so the copy is stale or a half-written file breaks the build | **high today** | high | Hard prerequisite: empty `IN_FLIGHT` board; freeze window; re-import before cutover; the original stays source of truth until M5 |
| 2 | History rewrite loses or scrambles commits | low | high | filter-repo runs on a throwaway clone only; commit-map committed; originals tagged and untouched |
| 3 | Imported tree carries local junk or secrets (`node_modules.broken`, reports, `.npmrc` path, `secrets/`, logs, the Firebase key) | medium | high | check `git ls-files` of the clone before merging; secret scan (gitleaks) on the import branch; `conf/` and `*adminsdk*.json` are already gitignored here |
| 4 | Shared-UI dedupe changes how the consumer looks | medium | medium | one component per PR, consumer behaviour as reference, visual-regression gate, easy revert |
| 5 | Two toolchains disagree (Next/React versions, Tailwind config, ESLint) | medium | medium | pin versions at the workspace root; align admin and web to the same Next/React before M1 (both are 16.2.6 / 19.2.4 today) |
| 6 | Windows path/pnpm-store problems on dev machines (`store-dir`, `node_modules.broken`) | high locally | low | remove machine-specific `.npmrc` on import; document a clean-install procedure |
| 7 | Deploy-time surprise: a monorepo build differs from the original | medium | high | M2 route-manifest diff; staging soak; release-folder deploy with symlink rollback |
| 8 | Backend move breaks migrations or double-applies them | low | **critical** | backend move is optional and last; one schema, one migration runner; staging first; additive-only rule |
| 9 | CI cost and time grow as the repo grows | low | low | turbo `--filter=...[origin/main]`, caches, path filters |
| 10 | The monorepo becomes a dumping ground | medium | medium | package rules in ADR-002/003; a package needs two consumers or it stays in its app |
| 11 | Admin app exposed before hardening is deployed | medium | high | deployment checklist in 04; nginx allowlist; seeded admin created once with forced password change |
| 12 | A rushed migration blocks product work | medium | medium | every step reversible; no flag day until M5; M6 optional |

## Owner answers (2026-10-23)

1. **No paying users yet.** The only environment is staging; it becomes production when development is done.
   Consequence: the "4 weeks in production" gate cannot apply as written. Replacement gate: **V1 is released to
   production and has run one full release cycle with no rollback.**
2. **Staging exists** and will be promoted to production at V1. Consequence: M5 has no separate staging to soak
   on until a production exists. Before V1 launch, either keep a second staging, or rehearse cutover and rollback
   on a throwaway copy. Decide this at M0.
3. **Scope now: admin frontend only in the monorepo.** Backend and consumer frontend stay in their own repos.
   **Later (after V1 is live in production): everything moves in**, frontend first, backend second (M6 is now
   wanted, not optional, but still last and still gated).

Defaults kept for decisions 2, 4, 5 below until the owner says otherwise.

## Decisions that need the owner (original list)

1. **Is the proposed "V1 stable" definition right?** (weeks in production, no Sev-1/2, backups rehearsed.)
2. **Who owns the mirror** between the original repo and `apps/web` during M1-M5, and how often?
3. **Is M6 (backend into the monorepo) wanted at all?** The recommendation is "decide after M5".
4. **Visual-regression tool and threshold.** Default: Playwright snapshots, 0.1% pixel tolerance.
5. **Freeze-window length** for cutover (recommended: one working day, outside peak milking hours).
6. **Staging environment:** infra doc 14 Phase 4 assumes a Neon staging branch and a staging VM. Do they exist?
   M5 needs them.

## Things explicitly out of scope

The Flutter app (`rakhal-app`), database consolidation, splitting `admin-api` into its own service, and any
change to production URLs before cutover.
