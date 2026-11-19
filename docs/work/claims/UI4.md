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
