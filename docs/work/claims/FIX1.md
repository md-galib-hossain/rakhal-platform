---
id: FIX1
title: "Mobile: Resolve SQLite database locked error on milk collection save"
status: active
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
2. Add a promise-based transaction serialization queue (`txMutex`) in `openExpoSqliteDb` to serialize concurrent `withExclusiveTransactionAsync` executions.
3. In `useMilkScreen.ts`, ensure `saveCollection` handles batching of session save and session submit gracefully without lock contention.

## Verification results
