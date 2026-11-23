---
id: PERF4
title: Optimistic instant milk save with 0ms perceived latency and graceful rollback
status: done
agent: nexus
harness: antigravity
branch: main
started: 2026-11-23
updated: 2026-11-23
paths:
  - apps/mobile/src/milk/useMilkScreen.ts
  - apps/mobile/src/milk/MilkScreen.tsx
  - apps/mobile/src/milk/MilkScreen.test.tsx
  - apps/mobile/src/i18n/messages.ts
---

# Claim PERF4: Optimistic Instant Milk Save with Graceful Rollback

## Completed Work
1. **0ms Optimistic Instant Handoff**: Removed the 440ms blocking button spinner and label flickering (`isSaving || isSubmitting ? t('milk.saving') : buttonLabel`) from `MilkScreen.tsx`. The save button responds instantly like a native shutter on tap.
2. **Immediate Toast & State Transition**: In `apps/mobile/src/milk/useMilkScreen.ts`, clicking Save immediately produces synthetic optimistic outbox rows and renders the success toast (`milk.saveSuccess`) at 0ms perceived latency.
3. **Background SQLite Outbox Persistence**: SQLite batch insertion (`sync.enqueueBatch`) and network drain kicks run asynchronously in the background. On completion, synthetic rows are cleanly swapped for disk rows.
4. **Graceful Rollback on Failure**: If the SQLite write fails (e.g. disk quota or I/O error), optimistic outbox rows are automatically removed, uncommitted user draft numbers (`prevYieldOverrides`, `prevMultiYieldOverrides`, `prevTankOverrides`) are restored back into the input fields so no entries are lost, and an error toast (`milk.saveFailed`) is presented.
5. **Full Test Suite & CI Verification**: Added automated unit tests covering both the 0ms optimistic save and the graceful rollback path. All 584 Jest tests and 357 node tests pass cleanly. Verified on the live Pixel 8 Android emulator (`emulator-5554`).

