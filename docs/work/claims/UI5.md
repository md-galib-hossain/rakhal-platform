---
id: UI5
title: "Mobile: Redesign Animals page matching Milk page design patterns and web metrics"
status: done
agent: forma
harness: antigravity
branch: feat/mobile-cattle-screen-redesign
paths:
  - apps/mobile/src/cattle/**
  - apps/mobile/app/(tabs)/cattle.tsx
  - apps/mobile/src/offline/pull.ts
  - apps/mobile/test/offline-pull-sender.test.ts
  - apps/mobile/test/cattle-model.test.ts
shared:
  - apps/mobile/src/i18n/messages.ts
depends_on: []
blocked_by: []
resolved: []
started: 2026-11-19
updated: 2026-11-19
---

## Scope

Full redesign of the mobile Animals (Cattle) tab:
1. Match the Milk page visual architecture:
   - Clean white background canvas with thin 1px border separation for cards and inputs.
   - Strict ADR-007 compliance (zero drop shadows).
   - Modern top header with Rakhal logo branding.
2. Highlights & Summary section:
   - Surface key metrics inspired by the web Animal page (Total Animals, Avg Herd AQR, Breeding Ready, Milking Cows).
   - Category filter pills with counts (All, Cows, Heifers, Calves, Weaned, Male, Female, Pregnant, In Milk, Dry, Fresh, Open, Needs Care).
3. Rich Animal Cards matching the Milk page item cards:
   - Tinted avatar with cow initial and deterministic `avatarTint`.
   - Name in bold, gender glyph (♂ / ♀), tag number, breed name.
   - Key attributes: Age, Weight, Shed, AQR Score box, Next Event badge (if present).
   - Status badges: Lactation stage, Reproduction status, Health status.
   - Tapping an animal card opens the animal detail screen.
4. Search & Filter:
   - Search bar with debounced input (tag number or name) and clear button.
   - Quick category filtering chips.
5. Full accessibility & i18n:
   - Both Bangla and English strings.
   - High contrast, >=48dp touch targets, responsive font scaling.

## Verification results

- `pnpm.cmd --filter @rakhal/mobile exec tsc --noEmit`: PASS (0 errors)
- `pnpm.cmd --filter @rakhal/mobile exec eslint .`: PASS (0 warnings, 0 errors)
- `pnpm.cmd --filter @rakhal/mobile run test:node`: PASS (331 tests passed, 0 failures, 0 token drift)
- `pnpm.cmd --filter @rakhal/mobile exec jest --ci`: PASS (46 test suites, 553 tests passed)
- `node scripts/work.mjs check --no-network`: PASS (0 errors, 0 warnings)
- Device verification on Android emulator (`emulator-5554`): Captured live screen `cattle_redesign_device.png` showing Highlights KPI bar (7 Total, 59 Avg AQR, 2 Breeding Ready, 5 Active Milking), horizontal Category Pills (All 7, Cows 5, Heifers 1, Calves 0...), Search bar, and rich animal cards (Lokkhi ♀ with AQR 80 /100, 4y 3m age, 111 kg weight, 11d overdue task, Sick, Late lactation, Bred awaiting check badges). Zero visual regressions, 100% compliant with ADR-007.
