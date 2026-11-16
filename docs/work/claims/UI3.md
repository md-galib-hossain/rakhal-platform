---
id: UI3
title: Mobile Milk UI/UX Overhaul
status: active
agent: forma
harness: antigravity
branch: feat/mobile-milk-ui-ux
paths:
  - apps/mobile/app/(tabs)/milk.tsx
  - apps/mobile/src/milk/**
  - apps/mobile/test/milk-*.test.ts
  - apps/mobile/src/components/picker/**
shared:
  - apps/mobile/src/i18n/messages.ts
depends_on: []
blocked_by: []
resolved: []
started: 2026-11-16
updated: 2026-11-16
---

## Scope

Mobile Milk page UI/UX overhaul:
1. Date picker integration with missed-entry red status dots (`GET /milk/log/calendar?month=YYYY-MM`) and `Today` quick action.
2. Session locking and configuration (e.g. 2-session farms locking Noon and Night).
3. Live reactive total milk collection counter (updating instantly as yield is entered).
4. Tank routing indicator and selector (reading from offline cached milkTanks).
5. Ergonomic mobile milking input card (compact card, direct numeric input + quick increment chips, replacing bulky stepper).
6. Docked action bar with Save Draft and Submit Session.

## Links

- Design Plan: `milk_ui_ux_overhaul_plan.md`
- PRD: Section 10 (Milk Log)

## Notes

- 2026-11-16: Claim created and approved by user.
- 2026-11-16: Implemented full mobile milk UI/UX overhaul:
  - DatePickerSheet & DateRangePicker: calendar status red dots for missing dates (`GET /milk/log/calendar`) & Today jump shortcut. Fixed infinite re-render loop on un-passed range default.
  - SessionConfigSheet: farmers can lock/unlock milking sessions (e.g. 2 sessions for Morning & Evening).
  - TankSelectorSheet: reads offline cached milkTanks, displays active destination tank chip with auto-routing notice for withheld milk.
  - Reactive live total collected summary: real-time totals, sellable and withheld breakdowns, logged cow count.
  - Ergonomic MilkCowCard: direct numeric input with decimal support, quick increment chips (+0.5, +1.0, +5.0), withheld medication locked state with tank routing indication.
  - Docked footer bar: live totals, Save Draft batch save and Submit Session action buttons.
  - All tests passing: node unit tests (326 passed), jest component tests (528 passed), tsc clean, eslint clean, work claims check clean.
