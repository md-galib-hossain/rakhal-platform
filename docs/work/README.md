# Work coordination

One system for Claude Code, Antigravity and humans. Rules outrank defaults; `AGENTS.md` links here.

```bash
node scripts/work.mjs list                       # who has what
node scripts/work.mjs claim T1 --agent NAME --harness claude-code --branch feat/x
node scripts/work.mjs check --no-network         # same rules as CI, minus other open PRs
node scripts/work.mjs status T1 review           # lifecycle edits (also bumps `updated`)
node scripts/work.mjs prune                      # done claims older than 30 days
```

## Where knowledge goes

| Kind                                               | Where                                        | Rule                                             |
| -------------------------------------------------- | -------------------------------------------- | ------------------------------------------------ |
| A decision and why                                 | `docs/decisions/ADR-*.md`                    | Append dated notes. Never rewrite a shipped ADR. |
| Plan progress                                      | the row in `docs/mobile/M4-mobile-plan-*.md` | Update in the PR that finishes the work package. |
| Task status, owner of a task, notes, handover note | `docs/work/claims/<id>.md`                   | One file per task.                               |
| A trap you hit and how to avoid it                 | `docs/work/LESSONS.md`                       | Append-only: date, who, what happened, the fix.  |
| What exists now                                    | `docs/mobile/HANDOVER.md` "What is built"    | Add a row when a WP merges.                      |
| Owner decisions (D1..D10)                          | the plan; only the owner decides             | Claims record `blocked_by`; never guess one.     |

## Claim file

`docs/work/claims/<id>.md`, frontmatter then free text (scope, links to plan row / ADR / PR, running notes, handover note).

| Field                        | Meaning                                                                                                                                                        |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`, `title`                | id equals the file name                                                                                                                                        |
| `status`                     | `open` unassigned, `active`, `review` (PR open), `done`, `abandoned`                                                                                           |
| `agent`, `harness`, `branch` | who holds it: a name, `claude-code` / `antigravity` / `human` / other slug, the git branch                                                                     |
| `paths`                      | globs the task edits (repo-relative, `/`). Write `dir/**`, a bare directory is not expanded                                                                    |
| `shared`                     | optional: files several tasks only append to (i18n messages, pull entries, generated files). Allowed for you, **not compared** between claims. Keep this small |
| `depends_on`                 | claim ids; must exist and not be `abandoned`                                                                                                                   |
| `blocked_by` / `resolved`    | owner decision ids such as `D4`; add to `resolved:` once the owner decided                                                                                     |
| `started`, `updated`         | `YYYY-MM-DD`; bump `updated` whenever you push                                                                                                                 |

Lists may be `[a, b]` or `- item` lines. Unknown fields are errors.

## Lifecycle

1. **Claim, first commit of the branch.** `list`, pick an `open` claim, `claim <id> --agent --harness --branch`, branch from `origin/main` in a worktree, commit the claim file alone. Two agents taking the same claim edit the same file: the second push or merge conflicts, which is the lock. Never edit someone else's claim except to take over (below).
2. **Work.** Stay inside `paths`. Need more? Add globs to your claim in the same PR (CI then re-checks overlap). Append notes to the claim body as you go.
3. **PR opens:** `status <id> review`. The PR template has a claim field.
4. **Last commit before merge:** `status <id> done`, update the plan row and the HANDOVER table, add LESSONS entries. Do not merge; the owner does.
5. **Stopping early:** `status <id> abandoned` and write a handover note in the claim body: what is done, what is not, branch/PR to reuse, traps.

**Taking over an abandoned claim.** Read the old note, branch and PR. Run `claim <id> ...` (allowed for `open` and `abandoned` only; an `active` or `review` claim is refused), reuse the old branch or start a new one, say so in the notes. If the holder is gone but still `active` (the check warns after 14 days without `updated`), ask the owner to set it `abandoned`.

## What `check` enforces (CI job `claims`)

Failures: (a) claim files parse and validate, ids unique, `depends_on` exist and are not abandoned. (b) the PR branch matches exactly one `active`/`review` claim (a `done` one is accepted for the PR that finishes it). Exempt: branch `hotfix/*`, label `no-claim`, a PR touching only `docs/work/**`. (c) every changed file is inside that claim's `paths` or `shared`; `docs/work/**`, `docs/mobile/HANDOVER.md` and the plan file are always allowed. (d) no overlap of `paths` with any other `active`/`review` claim, on `main` or in another open PR (read with `gh api`); the same task claimed by two branches also fails. Warnings: (e) `active` not updated for 14 days; `blocked_by` not in `resolved` for an `active`/`review` claim.

**Overlap rule (conservative).** Two globs overlap when some path could match both, even if no such file exists: compared segment by segment, `**` may swallow any number of segments, `*`/`?` are intersected exactly, `[..]` counts as `?`, `{a,b}` is expanded, and `dir/**` also overlaps the bare path `dir`. When unsure it says overlap. Fix a false alarm by narrowing `paths`.

Not enforced: anything about agents that skip the docs. CI only sees what a PR changes; a local edit never pushed is invisible. The job is not a required check yet; the owner can add `claims` under Settings, Branches, branch protection, "Require status checks" once they trust it. `--no-network` skips other open PRs, so a local pass can still fail in CI.
