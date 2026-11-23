---
id: PERF1
title: "Performance: Optimize milk save latency (dirty-session save, reload debouncing, parallel AQR)"
agent: nexus
harness: antigravity
branch: main
status: done
started: 2026-11-23
updated: 2026-11-23
paths:
  - apps/mobile/src/milk/useMilkScreen.ts
  - apps/api/src/modules/milk/application/services/milk.service.ts
shared: []
depends_on: []
blocked_by: []
resolved: []
---

## Scope & Implementation Notes

Optimized milk collection saving latency across mobile client and backend API:
1. **Mobile (`useMilkScreen.ts`)**:
   - Save only sessions that have active unsaved edits / dirty overrides, skipping unedited sessions that already match the server.
   - Debounced sync snapshot subscriber (`150ms`, immediate on initial mount) during outbox draining bursts so SQLite is not queried 15+ times consecutively through the single promise mutex.
   - Clears local in-memory draft overrides upon queuing in outbox.
2. **Backend (`milk.service.ts`)**:
   - In `MilkService.submit()`, parallelized AQR `applyEvent` calls using `Promise.all` across pending cattle entries instead of a serial sequential database loop.

## Verification

- `pnpm --filter mobile exec tsc --noEmit`: 0 errors.
- `pnpm --filter mobile exec eslint src/milk/useMilkScreen.ts`: 0 errors.
- `pnpm --filter @rakhal/api build`: 0 errors.
- `pnpm --filter @rakhal/api exec jest src/modules/milk`: 5/5 suites passed, 32/32 tests passed.
- `pnpm exec jest src/milk/MilkScreen.test.tsx`: 13/13 tests passed.
- `pnpm exec jest src/milk/MilkAnalyticsView.test.tsx`: 2/2 tests passed.
- `pnpm run test:node`: 357/357 tests passed (zero drop-shadows & token drift checks passed).
- `node scripts/work.mjs check --no-network`: 36 claims, branch main, 0 errors, 0 warnings.
