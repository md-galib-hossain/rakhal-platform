---
id: COORD1
title: Work-claim coordination system
status: review
agent: claude-coordination
harness: claude-code
branch: claude/agent-coordination-e4b77c
paths:
  - scripts/work.mjs
  - scripts/work.test.mjs
  - docs/work/**
  - .github/workflows/work.yml
  - .github/pull_request_template.md
  - AGENTS.md
  - CLAUDE.md
  - GEMINI.md
  - docs/mobile/HANDOVER.md
depends_on: []
blocked_by: []
resolved: []
started: 2026-11-16
updated: 2026-11-16
---

## Scope

Claim files, `scripts/work.mjs` (list, check, claim, status, prune), the `work` CI workflow, knowledge-base rules (`docs/work/README.md`, `LESSONS.md`), the claim protocol in `AGENTS.md`, root `CLAUDE.md`, PR template.

## Links

- PR: see the PR for branch `claude/agent-coordination-e4b77c`

## Notes

Antigravity reads `AGENTS.md` and `GEMINI.md` at the workspace root by itself (checked in its rules docs), so no `.agents/rules/` file was added.
