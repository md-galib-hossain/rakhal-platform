## Claim

Claim id: <!-- e.g. T1; the file docs/work/claims/<id>.md must be status review on this branch. Hotfix or no claim: say why (branch hotfix/..., label no-claim). -->

## What changed

## Checks run (exact results)

## Not covered / not verified

<!-- device, TalkBack, dark theme, iOS, anything only a unit test covered -->

## How to verify by hand

## Checklist

- [ ] `node scripts/work.mjs check` passes; my claim is `review` (set `done` in the last commit before merge)
- [ ] Only files inside my claim's `paths` changed (or I extended `paths` in this PR)
- [ ] Plan row, `docs/mobile/HANDOVER.md` "What is built", and ADR notes updated where this changes them
- [ ] A new trap I hit is in `docs/work/LESSONS.md`
- [ ] No `.env`, tokens, or secrets; no unrelated formatting churn
- [ ] Open owner decisions I hit are listed above, not guessed

<!-- Do not merge. The owner merges after "Merge when green". -->
