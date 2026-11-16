---
id: UI1
title: Mobile: no drop shadows, separate surfaces by border and colour only
status: done
agent: claude-sonnet-ui
harness: claude-code
branch: claude/mobile-no-shadows
paths:
  - apps/mobile/src/theme/tokens.ts
  - apps/mobile/src/providers/ThemeProvider.tsx
  - apps/mobile/src/providers/ThemeProvider.test.tsx
  - apps/mobile/src/components/display/Card.tsx
  - apps/mobile/src/components/display/Card.test.tsx
  - apps/mobile/src/components/feedback/Toast.tsx
  - apps/mobile/src/components/feedback/Toast.test.tsx
  - apps/mobile/src/components/feedback/ConfirmSheet.test.tsx
  - apps/mobile/src/components/internal/SheetModal.tsx
  - apps/mobile/src/components/internal/sheet-motion.ts
  - apps/mobile/test/no-shadows.test.ts
  - AGENTS.md
  - docs/decisions/ADR-007-mobile-no-shadows.md
  - docs/mobile/wp3-component-spec.md
  - docs/mobile/ux-brand-plan.md
  - docs/mobile/device-testing.md
shared: []
depends_on: []
blocked_by: []
resolved: []
started: 2026-11-16
updated: 2026-11-16
---

## Scope

Owner rule (2026-11-16): the mobile app has no drop shadows. Sections, cards, sheets and toasts are told apart from the page by a 1px border and a fill that differs from the background (light and dark), the way the reference design does it. Remove `elevation` and every `shadow*` style from the app, keep the scrim colour for modal backdrops, add a test that fails when a shadow or elevation style appears again, and write the rule where Claude and Antigravity agents both read it (`AGENTS.md`, ADR-007).

## Links

- Reference: owner's screenshot (cards on a tinted page, hairline borders, no shadows)
- Rule home: `AGENTS.md` "Mobile conventions", `docs/decisions/ADR-007-mobile-no-shadows.md`

## Notes

2026-11-16 claude-sonnet-ui: removed `elevation` tokens and every shadow style (Card, Toast, SheetModal); the sheet got a 1px `inputBorder` outline (top and sides); `shadowColor` became `scrimColor` (backdrop only). New `apps/mobile/test/no-shadows.test.ts` fails on any shadow/elevation style in `src`/`app` and when card/popover/border stop differing from background. Rule written in `AGENTS.md` and ADR-007. tsc, eslint, node (318) and jest (508) green. NOT checked on a device: the Pixel 8 emulator was in use by another session (`hungry-mirzakhani`), so the owner or a later agent should look at Card, the confirm sheet and a toast in light and dark.
