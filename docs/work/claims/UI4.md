---
id: UI4
title: "Mobile: Unified white background with thin border separation on milk page"
status: active
agent: forma
harness: antigravity
branch: feat/mobile-milk-border-separation
paths:
  - apps/mobile/src/milk/MilkScreen.tsx
  - apps/mobile/src/milk/MilkCowCard.tsx
  - apps/mobile/src/milk/MilkAnalyticsView.tsx
shared: []
depends_on: []
blocked_by: []
resolved: []
started: 2026-11-19
updated: 2026-11-19
---

## Scope

Owner-directed UI/UX experiment on the Milk screen:
- Replace grayish background (`colors.background`) with uniform whitish (`colors.card`) across the entire Milk screen canvas.
- Unify input, pill, button, and container backgrounds to pure white (`colors.card`).
- Use crisp, modern 1px borders (`colors.border`, `colors.primary` for active/selected items) for structure, hierarchy, and tactile separation.
- Maintain ADR-007 compliance (zero drop shadows).

## Verification results

- `pnpm.cmd --filter @rakhal/mobile exec tsc --noEmit`: 0 errors.
- `pnpm.cmd --filter @rakhal/mobile exec eslint .`: 0 warnings, 0 errors.
- `pnpm.cmd --filter @rakhal/mobile run test:node`: 326 tests passed (326/326).
- `pnpm.cmd --filter @rakhal/mobile exec jest --ci`: 45 suites passed, 548 tests passed (548/548).
- `node scripts/work.mjs check --no-network`: 13 claims, 0 errors, 0 warnings.
- Device testing:
  - Verified on Pixel 8 Android emulator (API 34).
  - Background is unified white (`colors.card`) across the Milk canvas with 1px border separation (`colors.border`).
  - Removed 3 leftover E2E test cattle from database (`Galib Dairy Farm`).
  - Polished cow card headers: eliminated tag duplication in subtitles when animal has no name, and added single-line tail truncation (`numberOfLines={1}`) to prevent awkward mid-word breaks.

