---
id: UI8
title: "Platform & Mobile: Multi-select & bulk actions (record event, change shed, add to group, dispose) across API, Web, and Mobile"
status: active
agent: nexus
harness: antigravity
branch: feat/cattle-bulk-actions
paths:
  - apps/api/src/modules/animal-events/**
  - apps/api/src/modules/health/**
  - apps/api/src/modules/cattle/**
  - apps/web/features/cattle/**
  - apps/web/features/events/**
  - apps/mobile/src/cattle/**
  - apps/mobile/test/**
  - packages/api-client/**
shared:
  - apps/mobile/src/i18n/messages.ts
  - apps/web/i18n/messages/**
depends_on: []
blocked_by: []
resolved: []
started: 2026-11-20
updated: 2026-11-20
---

## Scope

1. **Backend Verification & Enhancements (`apps/api`)**:
   - Ensure `POST /animal-events/bulk` works robustly with sickness/illness and common bulk events.
   - Verify permission mappings (`healthcare.report-sickness`) and validation handling for `CreateHealthCaseDto` within bulk event pipeline.
   - Verify `POST /cattle/bulk` (`change_shed`, `dispose`) and `POST /animal-groups/:id/members`.

2. **Web Verification & Fixes (`apps/web`)**:
   - Correct permission check for `ILLNESS` in `events.ts` to `healthcare.report-sickness`.
   - Ensure bulk actions dock and sheets (`BulkEventSheet`, `ChangeShedSheet`, `AddToGroupSheet`, `DisposeSheet`) trigger without error and handle responses properly.

3. **Mobile Implementation (`apps/mobile`)**:
   - Multi-select capability on `CattleCard` / `CattleList` (select mode, item checkboxes, select all toggle).
   - Bottom `BulkActionDock` with:
     - Count of selected items.
     - `Record event` -> modal sheet to batch record sickness, vaccination, deworming, weight, etc.
     - `Change shed` -> modal sheet to assign selected animals to a shed.
     - `Add to group` -> modal sheet to add selected animals to an animal group.
     - `Dispose` -> modal sheet to record sale, cull, or death disposition.
     - `Cancel` -> clear selection.
   - Full bilingual support in `apps/mobile/src/i18n/messages.ts` (Bangla and English).
   - Strict ADR-007 compliance (zero drop shadows, 1px borders, accessible touch targets).

4. **Verification & Delivery**:
   - Run typechecks, unit tests, and lint across API, Web, and Mobile.
   - Test on Android emulator with screenshot verification.
   - Check work claim and merge cleanly to `main`.
