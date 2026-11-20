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
3. Rich Animal Cards with Web-Parity Next Event Pill Chip & Expandable Details:
   - Tinted avatar with cow initial and deterministic `avatarTint`.
   - Layout & Hierarchy:
     - Line 1: Cow Name in bold font (`Lokkhi ♀` / `Shundori ♀` / `Bhola ♂`) with gender symbol.
     - Line 2: Tag number (`GALIB_DAIRY_1-001`) · Category pill (`Cow`) · Breed (`Holstein Friesian` or omitted if none).
     - Fixed-width AQR score box (`XX /100`) with zero text collision.
   - Key metrics row: Age, Weight, Shed with icons.
   - Default (Collapsed) state: Clean, compact and focused, surfacing key status badges (Health: `Healthy`/`Sick`, Production: `Milking`/`Dry`) and Next Event pill chip / no-event chip.
    - Fluid accordion animation for card details (`CattleCard.tsx`):
      - Smooth Animated height interpolation (0 to dynamic measured height) and opacity fade (0 to 1).
      - Expand curve: 220ms with cubic deceleration `Easing.bezier(0.2, 0, 0, 1)`.
      - Collapse curve: 180ms with `Easing.inOut(Easing.ease)`.
      - Instantaneous (0ms) when `prefers-reduced-motion` is active.
      - Seamless 180° chevron rotation (`rotate: 0deg -> 180deg`) synchronized with accordion progress.
      - Dynamic height measurement via `onLayout` supporting any font scale and Bangla/English text lengths.
      - Accessible: `aria-hidden` and `pointerEvents="none"` when collapsed, >=48dp touch target on toggle button.
   - Expanded status table: Unifies all operational dimensions in a structured table:
     - Health status badge (`Healthy` / `Sick` / `In Treatment`)
     - Production status badge (`Milking` / `Dry`)
     - Lactation stage badge (`Fresh`, `Early`, `Mid`, `Late`, `Dry period`)
     - Reproduction status badge (`Open`, `Pregnant`, `Bred, awaiting check`, etc.)
     - Next Event: Interactive chip with kind icon, title, and overdue days that opens the `UpcomingEventsSheet` on tap.
   - Navigation safety: Tapping expand toggle expands/collapses in-place WITHOUT navigating. Tapping card top area navigates to `/cattle/[id]`.
4. Upcoming Events Bottom Sheet Modal (`UpcomingEventsSheet.tsx`):
   - Strict ADR-007 compliance: 1px border separation, zero drop shadows, scrimColor backdrop.
   - Header with `UPCOMING EVENTS`, count badge, and animal title (`Name (Tag)`).
   - Event list with circular urgency tone icon, event title, overdue/scheduled date, and kind label.
   - Fetches live events via `client.get('/cattle/:id/upcoming-events')` with graceful fallback to cached events.
   - "View animal" button navigating to `/cattle/[id]` and dismissible via close button or backdrop tap.
5. Search & Filter:
   - Search bar with debounced input (tag number or name) and clear button.
   - Quick category filtering chips.
6. Full accessibility & i18n:
   - Both Bangla and English strings with exact placeholder parity.
   - High contrast, >=48dp touch targets, responsive font scaling.

## Verification results

- `pnpm.cmd --filter @rakhal/mobile exec tsc --noEmit`: PASS (0 errors)
- `pnpm.cmd --filter @rakhal/mobile exec eslint .`: PASS (0 warnings, 0 errors)
- `pnpm.cmd --filter @rakhal/mobile run test:node`: PASS (334 tests passed, 0 failures, 0 token drift)
- `pnpm.cmd --filter @rakhal/mobile exec jest --ci`: PASS (46 test suites, 555 tests passed)
- `node scripts/work.mjs check --no-network`: PASS (0 errors, 0 warnings)
- Device verification on Android emulator (`emulator-5554`):
  - Verified card header hierarchy: Bold animal name + gender glyph on primary line, tag number & breed on subtitle line; zero overlap or collision with the fixed-width AQR box.
  - Verified compact Next Event pill chip: Correct urgency styling, kind icon, real task title (`Missing milk-log session — Lokkhi`), and relative time (`· 12d overdue`).
  - Verified tapping Next Event pill chip opens the Upcoming Events bottom sheet modal without navigating.
  - Verified the bottom sheet modal: `UPCOMING EVENTS` uppercase header with count badge (`5`), animal title, list of 5 real events with icons and relative/absolute dates, and "View animal" button at the bottom.
  - Verified dismissal via close button and backdrop tap.
  - Strictly ADR-007 compliant: 1px borders, zero drop shadows.
