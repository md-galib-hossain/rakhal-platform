---
id: FIX2
title: "Mobile: Fix cattle profile milk production card today yield, week total, and 7-day sparkline"
agent: codex
harness: antigravity
branch: main
status: done
started: 2026-11-23
updated: 2026-11-23
paths:
  - apps/mobile/src/cattle/cattle-detail-model.ts
  - apps/mobile/src/cattle/workspace/OverviewTab.tsx
  - apps/mobile/test/cattle-detail-model.test.ts
shared: []
depends_on: []
blocked_by: []
resolved: []
---

## Scope & Implementation Notes

Fix cattle workspace Overview tab Milk Production card:
1. **Date normalization in `cattle-detail-model.ts`**:
   - In `parseOverview`, sliced date strings in `recent_milk_records`, `weight_history`, and `bcs_records` to `YYYY-MM-DD` via `(str(...) ?? '').slice(0, 10)`.
   - In `milkFigures(records, today)`, normalized both `r.date.slice(0, 10)` and `today.slice(0, 10)` into a Map by date.
   - Evaluated `weekTotal` as the sum of records within `[normToday - 6, ..., normToday]`.
   - Resolved `today` via `byDate.get(normToday) ?? null`.
2. **Fixed 7-day sparkline**:
   - In `milkFigures`, constructed the 7-day sparkline `series` for `[normToday - 6, ..., normToday]`, defaulting absent days to 0.
   - In `OverviewTab.tsx`, rendered `milkData.series` directly (exactly 7 items with `flex: 1`, individual heights, and gap 6) with `maxBar = Math.max(...milkData.series, 1)`. Avoided full-width block distortion when only 1 entry exists.
   - Compliant with ADR-007 (strictly zero drop shadows).
3. **Automated node tests**:
   - Updated `apps/mobile/test/cattle-detail-model.test.ts` verifying:
     - `parseOverview` normalizes ISO timestamp strings to `YYYY-MM-DD`.
     - `milkFigures` with full ISO timestamps matches `today` correctly and computes `weekTotal` and `series`.
     - Single-day milk entry produces 7 bars (6 zeros + today's value) with `hasData: true`.
     - Zero records produce 7 zeros, `today: null`, `weekTotal: 0`, and `hasData: false`.

## Verification Results
- `pnpm --filter mobile run test:node`: Pass (357 tests passing, 0 failing)
- `pnpm --filter mobile typecheck`: Pass (0 errors)
- `pnpm --filter mobile lint`: Pass (0 errors)
- `node scripts/work.mjs check --no-network`: Pass (0 errors, 0 warnings)
