---
id: UI4
title: "Mobile: Unified white canvas, app header modernization & language settings"
status: done
agent: forma
harness: antigravity
branch: feat/mobile-milk-border-separation
paths:
  - apps/mobile/src/milk/MilkScreen.tsx
  - apps/mobile/src/milk/MilkScreen.test.tsx
  - apps/mobile/src/milk/useMilkScreen.ts
  - apps/mobile/src/milk/MilkCowCard.tsx
  - apps/mobile/src/milk/MilkAnalyticsView.tsx
  - apps/mobile/src/navigation/AppHeader.tsx
  - apps/mobile/src/navigation/TabsShell.test.tsx
  - apps/mobile/src/more/MoreScreen.tsx
  - apps/mobile/src/more/MoreScreen.test.tsx
  - apps/mobile/app/(tabs)/_layout.tsx
  - apps/mobile/src/assets/icons/NotificationIcon.tsx
  - apps/mobile/src/assets/icons/RakhalLogo.tsx
  - apps/mobile/src/assets/icons/index.ts
  - apps/mobile/src/assets/logo-mark.svg
  - apps/mobile/src/auth/AuthGate.tsx
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
- App Brand & Logo Integration:
  - Vector `RakhalLogo.tsx` created from `logo-mark.svg` with `colors.foreground` wordmark and `colors.primary` horn mark & dot.
  - App header renders `RakhalLogo` (height 22) on the left, with bottom border divider removed for a seamless canvas flow.
  - AuthGate loading / open screen renders `RakhalLogo` (height 32) above the ActivityIndicator on `colors.card` background with generous breathing room.
- Notification Icon Stroke Refinement:
  - Refined bell stroke from heavy 2dp to 1.5dp with 20dp sizing for a delicate, modern aesthetic.
- Eliminate Line Clutter in Milk Top Section:
  - Removed container bottom borders from Header, Mode Tabs, and Controls Bar.
  - Re-engineered Mode Tabs (`Collection | Analytics`) into an iOS-grade segmented pill control (`colors.muted` pill container with `colors.card` active segment and crisp 1px border).
  - Maintained crisp 1px borders on Date pill, Search input, and Filter button as distinct tactile controls.
- Language Settings in More Screen:
  - Add Settings / Language card (`more-language-section`) in `MoreScreen.tsx`.
  - 2-segment pill control with short toggle labels "বাং" and "EN", reflecting active state with `colors.primary` and `colors.primaryForeground` and resting state with `colors.card` and `colors.foreground`.
- ADR-007 compliance: strictly zero drop shadows; 1px borders and theme tokens only.

## Verification results

- `pnpm.cmd --filter @rakhal/mobile exec tsc --noEmit`: 0 errors.
- `pnpm.cmd --filter @rakhal/mobile exec eslint .`: 0 warnings, 0 errors.
- `pnpm.cmd --filter @rakhal/mobile run test:node`: 326 tests passed (326/326).
- `pnpm.cmd --filter @rakhal/mobile exec jest --ci`: 46 suites passed, 551 tests passed (551/551).
- `node scripts/work.mjs check --no-network`: 13 claims, 0 errors, 0 warnings.
- Device testing:
  - Verified on Pixel 8 Android emulator (API 34).
  - Background is unified white (`colors.card`) across the Milk canvas and top header without divider line clutter.
  - Header displays brand logo on left and refined 1.5dp notification bell on right.
  - Collection / Analytics switcher updated from pill/stadium radius to squarish `tokens.radius.md` matching Save button & inputs.
  - Fluid horizontal swipe navigation enabled between Collection <-> Analytics and bottom navigation tabs (/cattle and /tasks).
  - Mode tabs render as a modern segmented pill control without stacked dividers.
  - Language toggle relocated to MoreScreen with 2-segment pill control switching between "বাং" and "EN".
  - Fixed search input layout shift: locked input dimensions with constant paddingRight, replaced dynamic 48dp IconButton with absolute-positioned clear button, and applied 200ms debouncer with bilingual digit matching.

