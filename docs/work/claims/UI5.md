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
updated: 2026-11-20
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
3. Rich Animal Cards with Expandable Details:
   - Tinted avatar with cow initial and deterministic `avatarTint`.
   - Category pill prominently displayed at the top of each animal card.
   - Animal Identity: Avatar with tint and bold initial, Name (bold) + Gender glyph (`♀` / `♂`), Tag number & Breed.
   - Health Status: Prominently visible in the card summary (e.g. Healthy, Sick, In Treatment).
   - Key attributes: Age, Weight, Shed with icons.
   - AQR Score Box: Clean score display (`XX /100`).
   - Animal Next Event: Extremely clear display with urgency (overdue, today, in X days), or subtle clean indicator ("No pending events" / "কোনো পেন্ডিং ইভেন্ট নেই") when none.
   - Expandable card control (>=48dp touch target) smoothly expanding in place with `LayoutAnimation` (respecting `prefers-reduced-motion`) to reveal secondary/deep statuses:
     - Production Status (Milking / Dry)
     - Lactation Stage (Fresh, Early, Mid, Late, Dry Period)
     - Reproduction Status (Open, Pregnant, Awaiting Confirmation, etc.)
   - Navigation safety: Tapping expand toggle expands/collapses in-place WITHOUT navigating. Tapping card body navigates to `/cattle/[id]`.
4. Search & Filter:
   - Search bar with debounced input (tag number or name) and clear button.
   - Quick category filtering chips.
5. Full accessibility & i18n:
   - Both Bangla and English strings with exact placeholder parity.
   - High contrast, >=48dp touch targets, responsive font scaling.

## Verification results

- `pnpm.cmd --filter @rakhal/mobile exec tsc --noEmit`: PASS (0 errors)
- `pnpm.cmd --filter @rakhal/mobile exec eslint .`: PASS (0 warnings, 0 errors)
- `pnpm.cmd --filter @rakhal/mobile run test:node`: PASS (331 tests passed, 0 failures, 0 token drift)
- `pnpm.cmd --filter @rakhal/mobile exec jest --ci`: PASS (46 test suites, 554 tests passed)
- `node scripts/work.mjs check --no-network`: PASS (0 errors, 0 warnings)
- Device verification on Android emulator (`emulator-5554`): Captured live screen showing collapsed state with prominent Category pill (`Cow`), Health badge (`● Sick`, `✔ Healthy`), Next event overdue/today or subtle `No pending events` pill, interactive toggle button (`More details ∨` / `Less details ∧`), and smooth in-place expansion revealing the 3-dimension deep status panel (Production, Lactation, Reproduction) without navigating away. Tapping card body navigates to `/cattle/[id]`. Zero drop shadows, strictly ADR-007 compliant.
