# ADR-004: Migration strategy for the consumer apps

Status: accepted by owner 2026-10-23, with these scope rulings:
- Now: only `apps/admin` + shared packages live in this monorepo. Backend and consumer frontend stay separate.
- After V1 is live in production and stable for a release cycle: consumer frontend moves in (M1-M5), then the
  backend (M6, now intended rather than optional, still last).
- No paying users yet; staging becomes production at V1. See `docs/migration/05-risks-and-gates.md`.

## Context

`rakhal-platform` holds the admin app and shared packages. The consumer frontend (143 commits) and backend
(219 commits) are separate repositories. `packages/ui` is a copy of consumer UI and will drift.
See `docs/migration/README.md` for the full picture.

## Decisions

1. **Frontend first, backend optional and last.** The frontend delivers most of the value (one UI source, one
   web toolchain) at low risk. The backend owns schema and migrations, so moving it is high risk for little
   gain; typed contracts come from OpenAPI instead.
2. **History is preserved with `git filter-repo --to-subdirectory-filter` on a throwaway clone, then a merge.**
   Alternatives: copy files (loses history), `git subtree add` (keeps history but old commits have root-level
   paths, which hurts `blame` and bisect). The originals are tagged `pre-monorepo-import` and never modified.
3. **The original repo is the source of truth until the cutover step**, then the monorepo is. No period of two
   writable copies.
4. **Shared UI is deduplicated one component per PR behind a visual-regression gate**, with consumer behaviour as
   the reference.
5. **Deployable units are unchanged** (`rakhal-web`, `rakhal-api`, new `rakhal-admin`). Deploys use release
   folders and a `current` symlink so rollback is a flip.
6. **Old repositories are archived, never deleted**, after one full release cycle.

## Consequences

- Positive: one place for web code; shared packages tested against every consumer; reversible at every step.
- Negative: a mirror process during M1-M5 costs discipline; a one-off import commit map must be kept; the
  backend keeps its own CI until (and unless) M6.
- Revisit: after M5, decide M6 with real data on how often backend and web change together.

## Alternatives rejected

- **Big-bang move of everything.** One flag day, no rehearsal, and the riskiest part (migrations) goes first.
- **Never merge.** Keeps the duplicated UI and hand-kept contracts forever.
- **Git submodules for the old repos.** Adds a second dependency graph without removing the duplication.
