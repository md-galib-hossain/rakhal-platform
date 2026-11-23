---
id: PERF5
title: Preserve completed outbox milk entries to prevent stale cache fallback before server pull
status: done
agent: nexus
harness: antigravity
branch: main
started: 2026-11-23
updated: 2026-11-23
paths:
  - apps/mobile/src/milk/useMilkScreen.ts
  - apps/mobile/src/milk/MilkScreen.test.tsx
---

# Claim PERF5: Preserve Completed Outbox Milk Entries

## Problem
When a milk outbox write is drained and marked `status: 'done'`, `useMilkScreen` previously executed `if (ob.status === 'done') continue;`. Because the local SQLite table `cache_milkLog` is only updated on explicit pull, `reloadData()` loaded stale cache from disk. With `done` outbox rows discarded, the cow's yield fell back to the stale pre-save cache for several seconds until a pull completed.

## Completed Work
1. **Preserve Completed Outbox Writes**: Removed `if (ob.status === 'done') continue;`. Completed outbox writes are mapped to `status: 'saved'` in `outboxByCowSession`.
2. **Timestamp Precedence**: Checked whether `serverLog.updatedAt` is strictly newer than `ob.queuedAt`. If not superseded by a newer server record, the local outbox entry remains authoritative.
3. **In-Memory Cache Updates**: In `saveAllDrafts` and `saveCollection`, `rawMilkLogs` is optimistically updated in memory so local React state is never stale while waiting for network.
4. **Automated Verification**: Added unit test `preserves completed outbox values across sequential saves without reverting to stale cache`. All 585 Jest tests and 357 node tests pass cleanly.

