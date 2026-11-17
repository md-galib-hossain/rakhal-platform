---
id: UI2
title: "Mobile: Button loading polish, floating pill toast, and subtle borders"
status: done
agent: forma
harness: antigravity
branch: feat/mobile-ui-refinement
paths:
  - apps/mobile/src/components/actions/Button.tsx
  - apps/mobile/src/components/actions/button-style.ts
  - apps/mobile/src/components/actions/Button.test.tsx
  - apps/mobile/src/components/actions/IconButton.test.tsx
  - apps/mobile/src/components/feedback/Toast.tsx
  - apps/mobile/src/components/feedback/Toast.test.tsx
  - apps/mobile/src/milk/MilkScreen.tsx
  - apps/mobile/src/milk/useMilkScreen.ts
  - apps/mobile/test/button-style.test.ts
shared:
  - apps/mobile/src/i18n/messages.ts
depends_on: []
blocked_by: []
resolved: []
started: 2026-11-17
updated: 2026-11-17
---

## Scope

UI/UX refinement based on user feedback:
1. Button loading & spinner:
   - Fix spinner positioning in `Button.tsx`: Center spinner and label together as a balanced unit (removed `flexGrow: 1` on Text which pushed the spinner to the far left padding).
   - Dynamic loading appearance: Retained the button's variant theme/color with softened disabled styling (`opacity: loading ? 0.65 : 1`) rather than collapsing into a dead full-gray box.
   - Text updates: Show "Saving..." ("সংরক্ষণ হচ্ছে...") while saving, and replaced "Submit" / "Submitted" with "Save" ("সংরক্ষণ করুন") / "Saved" ("সংরক্ষিত").
2. Toast component overhaul:
   - Modern floating pill toast matching user-provided reference UI.
   - Self-centered pill layout (`alignSelf: 'center'`), rounded pill radius (`borderRadius: radius.full`), subtle 1px border (`colors.border` instead of heavy `inputBorder`), compact padding (`paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.lg`), and cohesive icon + label.
3. Project-wide border refinement:
   - Enforce clean, subtle, modern border styling (`colors.border`) across the app.
   - Secondary button border updated to `border` instead of `inputBorder`.

## Verification criteria & Results

- `pnpm exec tsc --noEmit`: PASSED (0 errors).
- `pnpm exec eslint .`: PASSED (0 warnings, 0 errors).
- `pnpm run test:node`: PASSED (322/322 tests passing, 0 token drift).
- `node --test apps/mobile/test/no-shadows.test.ts`: PASSED (5/5 tests passing, zero drop shadows).
- `pnpm exec jest --ci`: PASSED (41 suites, 515 tests passing).
- `node scripts/work.mjs check`: PASSED (0 errors, 0 warnings).
