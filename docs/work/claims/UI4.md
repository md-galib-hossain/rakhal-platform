---
id: UI4
title: "Mobile: Unified white canvas, app header modernization & language settings"
status: active
agent: forma
harness: antigravity
branch: feat/mobile-milk-border-separation
paths:
  - apps/mobile/src/milk/MilkScreen.tsx
  - apps/mobile/src/milk/MilkCowCard.tsx
  - apps/mobile/src/milk/MilkAnalyticsView.tsx
  - apps/mobile/src/navigation/AppHeader.tsx
  - apps/mobile/src/navigation/TabsShell.test.tsx
  - apps/mobile/src/more/MoreScreen.tsx
  - apps/mobile/src/more/MoreScreen.test.tsx
  - apps/mobile/app/(tabs)/_layout.tsx
  - apps/mobile/src/assets/icons/NotificationIcon.tsx
  - apps/mobile/src/assets/icons/index.ts
shared:
  - apps/mobile/src/i18n/messages.ts
depends_on: []
blocked_by: []
resolved: []
started: 2026-11-19
updated: 2026-11-19
---

## Scope

Owner-directed UI/UX experiment on the Milk screen & App Shell:
- Replace grayish background (`colors.background`) with uniform whitish (`colors.card`) across the entire Milk screen canvas and top header layout.
- Top Header Redesign:
  - Remove farm name / farm switcher button from the top header (farm switching is housed in More tab).
  - Left: Display the app brand name `<Text role="h2" style={{ fontWeight: '800', fontSize: 18 }}>{t('common.appName')}</Text>`.
  - Right: Add notification bell button (`header-notifications`) with a clean 24dp Lucide-style bell icon (`NotificationIcon.tsx`), 40dp circular touch surface, 1px border (`colors.border`), background `colors.card`.
  - Remove language toggle from the top header.
- Language Settings in More Screen:
  - Add Settings / Language card (`more-language-section`) in `MoreScreen.tsx`.
  - 2-segment pill control with short toggle labels "বাং" and "EN", reflecting active state with `colors.primary` and `colors.primaryForeground` and resting state with `colors.card` and `colors.foreground`.
- ADR-007 compliance: strictly zero drop shadows; 1px borders and theme tokens only.

## Verification results

- `pnpm.cmd --filter @rakhal/mobile exec tsc --noEmit`: 0 errors.
- `pnpm.cmd --filter @rakhal/mobile exec eslint .`: 0 warnings, 0 errors.
- `pnpm.cmd --filter @rakhal/mobile run test:node`: 326 tests passed (326/326).
- `pnpm.cmd --filter @rakhal/mobile exec jest --ci`: 46 suites passed, 549 tests passed (549/549).
- `node scripts/work.mjs check --no-network`: 13 claims, 0 errors, 0 warnings.
- Device testing:
  - Verified on Pixel 8 Android emulator (API 34).
  - Background is unified white (`colors.card`) across the Milk canvas and top header with 1px border separation (`colors.border`).
  - Header displays brand name on left and circular 40dp notification bell icon on right.
  - Language toggle relocated to MoreScreen with 2-segment pill control switching between "বাং" and "EN".

