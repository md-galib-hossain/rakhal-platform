@AGENTS.md

# Claude Code

Everything above applies, including the **Claim protocol**. Claude-specific notes:

- Worktrees live under `.claude/worktrees/`; run `node scripts/work.mjs claim ...` inside your worktree and commit the claim file first.
- Hooks (for example GateGuard) belong to your harness, not to the repo. Do not rely on them, and do not edit them from a task.
