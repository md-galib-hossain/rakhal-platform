---
id: UI8
title: "Platform & Mobile: Multi-select & bulk actions (record event, change shed, add to group, dispose) across API, Web, and Mobile"
status: done
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

## Scope & Implementation Notes

1. **Backend Verification & Enhancements (`apps/api`)**:
   - Enhanced `apps/api/src/modules/health/application/events/health-events.handler.ts` to sanitize and normalize sickness/illness conditions (string trimming, uppercase mapping, fallback to `'OTHER'`, note preservation) and priority casing (`LOW` | `MEDIUM` | `HIGH` | `CRITICAL`) within the `POST /animal-events/bulk` pipeline.
   - Verified `POST /animal-events/bulk` (sickness, vaccination, deworming, weight), `POST /cattle/bulk` (change shed, dispose), and `POST /animal-groups/:id/members`.

2. **Web Verification & Fixes (`apps/web`)**:
   - Fixed RBAC permission mapping for `ILLNESS` in `apps/web/features/events/catalogue/events.ts` to `'healthcare.report-sickness'` so worker role users can record sickness events without permission denied errors.

3. **Mobile Implementation (`apps/mobile`)**:
   - Multi-select capability on `CattleCard` / `CattleList` (select mode toggle button in header, card checkboxes, long-press to enter select mode, select all / deselect all).
   - Bottom `CattleBulkDock` floating bar with selection counter, Select All / Deselect All, Dismiss / Cancel, and 4 bulk action buttons:
     - `Record event` -> `BulkEventModal` (Illness, Vaccination, Deworming, Weight batch logging with date, notes, condition/medicine/kg).
     - `Change shed` -> `BulkChangeShedModal` (assign all selected animals to a selected shed).
     - `Add to group` -> `BulkAddToGroupModal` (assign all selected animals to an existing animal group).
     - `Dispose` -> `BulkDisposeModal` (batch disposition: Sale, Cull, Death with reason and notes).
   - Full bilingual support in `apps/mobile/src/i18n/messages.ts` (Bangla and English) with zero drift verified.
   - Strict ADR-007 compliance: zero drop shadows, 1px border separation, 48dp touch targets.

4. **Verification & Delivery**:
   - API build: green (`nest build` passed).
   - API animal-events unit tests: green (4 suites, 30 tests passed).
   - Web typecheck: green (`tsc --noEmit` passed).
   - Mobile typecheck: green (`tsc --noEmit` passed).
   - Mobile eslint: green (0 errors).
   - Mobile shadow check: green (5 tests passed, 0 violations).
   - Mobile node tests: green (336 tests passed, 0 token drift).
   - Mobile Jest tests: green (46 suites, 556 tests passed).
   - `scripts/work.mjs check --no-network`: green (0 errors, 0 warnings).
