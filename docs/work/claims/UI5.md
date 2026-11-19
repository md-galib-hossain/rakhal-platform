---
id: UI5
title: "Mobile: Redesign Animals page matching Milk page design patterns and web metrics"
status: active
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
   - Surface key metrics inspired by the web Animal page (Total Animals, Avg Herd AQR, Breeding Ready, Today's Yield).
   - Category filter pills with counts (All, Cows, Heifers, Calves, Milking, Dry, Pregnant, Sick).
3. Rich Animal Cards matching the Milk page item cards:
   - Tinted avatar with cow initial or photo.
   - Name in bold, gender icon (♂ / ♀), tag number, breed name.
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
