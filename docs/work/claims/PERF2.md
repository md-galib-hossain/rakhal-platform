---
id: PERF2
title: "Performance: Outbox batch enqueue to eliminate SQLite busy_timeout locks on milk save"
agent: nexus
harness: antigravity
branch: main
status: done
started: 2026-11-23
updated: 2026-11-23
paths:
  - apps/mobile/src/offline/outbox.ts
  - apps/mobile/src/offline/sync-engine.ts
  - apps/mobile/src/offline/SyncProvider.tsx
  - apps/mobile/src/milk/useMilkScreen.ts
shared: []
depends_on: []
blocked_by: []
resolved: []
---

## Scope & Implementation Notes

Eliminated the 16+ second SQLite `busy_timeout` lock contention during milk save operations:
1. **Outbox Engine (`outbox.ts`, `sync-engine.ts`, `SyncProvider.tsx`)**:
   - Added `enqueueBatch(inputs)` to execute multiple outbox insertions within a single atomic SQLite transaction.
   - Publishes once and triggers background sync `kick()` once after the entire batch is committed to SQLite.
2. **Milk Screen (`useMilkScreen.ts`)**:
   - In `saveCollection` and `saveAllDrafts`, accumulated writes (`milk.saveLog` entries + `milk.submit`) into a batch and dispatched via `sync.enqueueBatch`.
   - Prevented previous failed/conflict session states from accidentally re-queueing unchanged sessions.
3. Verification across unit tests, node test suite, and emulator live telemetry:
   - Measured live tap-to-done on Pixel 8 Android emulator: dropped from 16,665ms to 311ms total (`enqueueBatch` took 52ms).

## Verification

- `pnpm --filter mobile exec tsc --noEmit`: 0 errors.
- `pnpm --filter mobile exec eslint src/offline/outbox.ts src/offline/sync-engine.ts src/offline/SyncProvider.tsx src/milk/useMilkScreen.ts`: 0 errors.
- `pnpm run test:node`: 357/357 tests passed (zero drop-shadows & token drift checks passed).
- `pnpm exec jest src/milk/ src/offline/`: 5/5 test suites passed (34/34 tests).
- `node scripts/work.mjs check --no-network`: 37 claims, branch main, 0 errors, 0 warnings.
- Android Emulator Live Run: verified via adb logcat (`[PERF_MILK] enqueueBatch(2 items) took 52ms`, `saveCollection finished in 311ms total`).
