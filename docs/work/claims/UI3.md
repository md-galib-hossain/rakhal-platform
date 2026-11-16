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
