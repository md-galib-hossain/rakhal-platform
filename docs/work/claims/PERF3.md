---
id: PERF3
title: Modern hybrid milk collection (in-memory typing + atomic on-tap save without pullAll lock contention)
status: done
agent: nexus
harness: antigravity
branch: main
started: 2026-11-23
updated: 2026-11-23
paths:
  - apps/mobile/src/milk/useMilkScreen.ts
  - apps/mobile/src/milk/MilkScreen.tsx
  - apps/mobile/src/milk/MilkCowCard.tsx
  - apps/mobile/src/offline/sync-engine.ts
  - apps/mobile/src/i18n/messages.ts
  - apps/mobile/src/milk/MilkScreen.test.tsx
---

# Claim PERF3: Modern Hybrid Milk Collection

## Completed Work
1. **In-Memory Draft Updates**: Converted `updateYield` in `apps/mobile/src/milk/useMilkScreen.ts` to be completely synchronous and in-memory. Typing yield updates local React state immediately (0ms latency, zero SQLite outbox writes or background network kicks on keystrokes).
2. **Atomic On-Tap Save**: Tapping "Save Collection" saves all dirty entries in a single atomic `sync.enqueueBatch` call with immediate optimistic feedback (`t('milk.saveSuccess')`), and does not duplicate submission for sessions already submitted.
3. **Decoupled Outbox Drain from Heavy `pullAll`**: In `apps/mobile/src/offline/sync-engine.ts`, outbox drain kicks pass `{ drainOnly: true }`, ensuring simple write drains do not trigger the 6-table entity pull (`pullAll`), preventing SQLite lock contention.
4. **Already Submitted Session Feedback**: Added `t('milk.alreadySubmitted')` message so tapping an already submitted session without dirty edits provides clear immediate user feedback.
5. **Full Suite Verified**: All 582 Jest tests and 357 node tests pass. Tested and verified on live Android emulator (`emulator-5554`).
