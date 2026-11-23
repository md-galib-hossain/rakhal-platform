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
2. **Eliminated Flawed Clock Comparison**: Removed `serverIsNewer = serverUpdatedMs > obSessionEntry.queuedAt`. Because device clock and server clock (UTC vs local BST) drift, comparing server timestamps against local `queuedAt` caused local outbox writes to be mistakenly rejected in favor of older server cache. Local outbox entries on this device are now strictly authoritative.
3. **Monotonic Outbox Precedence**: `outboxByCowSession` strictly requires `!existing || ob.queuedAt > existing.queuedAt || (ob.queuedAt === existing.queuedAt && ob.seq >= existing.seq)` so older outbox rows can never overwrite newer saves regardless of SQLite iteration order.
4. **Cache Merge on Disk Reload**: In `reloadData()`, `sync.readCache('milkLog')` merges with in-memory state rather than blindly overwriting it, guaranteeing that newly entered yields are preserved even during asynchronous cache reads.
5. **In-Memory Cache Updates**: In `saveAllDrafts` and `saveCollection`, `rawMilkLogs` is optimistically updated in memory so local React state is never stale while waiting for network.
6. **Automated Verification**: Added unit test `preserves night collection yields across cows without reverting to stale cache` and `guarantees newer outbox write wins even if older outbox row exists or disk cache is reloaded`. All 586 Jest tests and 357 node tests pass cleanly.

