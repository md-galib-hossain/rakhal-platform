---
id: FIX1
title: "Mobile: Resolve SQLite database locked error on milk collection save"
status: done
agent: nexus
harness: antigravity
branch: fix/mobile-sqlite-busy-timeout
paths:
  - apps/mobile/src/offline/expo-sqlite-db.ts
  - apps/mobile/src/milk/useMilkScreen.ts
shared: []
depends_on: []
blocked_by: []
resolved: []
started: 2026-11-19
updated: 2026-11-19
---

## Scope

Fix `SQLiteErrorException: Error code 5: database is locked`:
1. Add `PRAGMA busy_timeout = 5000;` to `openExpoSqliteDb` so SQLite waits for concurrent background transactions rather than failing instantly.
2. Add promise-based operation serialization (`mutex` / `serialize`) in `openExpoSqliteDb` covering all top-level `raw` calls (`exec`, `run`, `all`, `get`, `transaction`) so concurrent outbox operations and transactions serialize cleanly without collision.

## Verification results

- `pnpm exec tsc --noEmit` -> PASS (0 errors)
- `pnpm exec eslint .` -> PASS (0 warnings, 0 errors)
- `pnpm run test:node` -> PASS (326/326 tests passed)
- `pnpm exec jest --ci` -> PASS (46/46 suites passed, 551/551 tests passed)
- `node scripts/work.mjs check --no-network` -> PASS (0 errors, 0 warnings)
- Device verification on Android emulator (Pixel 8):
  - Relaunched app and updated yields across sessions.
  - Tapped "Save Milk Collection" / "Submitted".
  - Logcat confirms zero `SQLiteErrorException: Error code 5: database is locked` errors and clean synchronization.
