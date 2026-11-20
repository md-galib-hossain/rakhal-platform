---
id: UI7
title: "Mobile: Animals page white card background, header count cleanup, and single-row search filters groups"
status: active
agent: forma
harness: antigravity
branch: feat/mobile-cattle-ux-refinement
paths:
  - apps/mobile/src/cattle/**
  - apps/mobile/test/**
shared:
  - apps/mobile/src/i18n/messages.ts
depends_on: []
blocked_by: []
resolved: []
started: 2026-11-20
updated: 2026-11-20
---

## Scope

1. **Card Backgrounds to White (`colors.card`)**:
   - In `CattleCard.tsx`, ensure the card and its inner metric boxes and unified status table match the clean white styling from the Milk page (`colors.card`), removing unnecessary `colors.muted` grey backgrounds.
   - Set the `CattleList` container and flat list backgrounds cleanly to match the design pattern.
2. **Remove Redundant "All Animals" Label**:
   - Remove the redundant "All Animals" text before the count indicator in the section header, leaving the clean count (e.g. `Animals (7)` or `7 animals`).
3. **Single Row for Search, Filters, and Groups**:
   - Place the Search input, Filters button, and Groups button side-by-side in a single row, optimizing screen real estate and UX navigation.
4. **Verification**:
   - Verify with tests (`test:node`, `jest`, `tsc`, `eslint`, `no-shadows`).
   - Check on Android emulator with screencap.
