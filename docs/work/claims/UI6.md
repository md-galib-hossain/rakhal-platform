---
id: UI6
title: "Mobile: Animals page filters, animal groups management, and add animal layout button"
status: active
agent: forma
harness: antigravity
branch: feat/mobile-cattle-filters-groups
paths:
  - apps/mobile/src/cattle/**
  - apps/mobile/src/offline/pull.ts
  - apps/mobile/test/**
  - apps/api/src/modules/cattle/**
  - apps/web/features/cattle/**
  - packages/api-client/**
shared:
  - apps/mobile/src/i18n/messages.ts
depends_on: []
blocked_by: []
resolved: []
started: 2026-11-20
updated: 2026-11-20
---

## Scope

1. **Add New Animal button**: Add a clean, mobile-first `+ Add Animal` action button to the Cattle page layout header (placeholder callback ready for future form contents).
2. **Filters & Drilldown Sheet**:
   - Refined mobile filter sheet modal matching user requirements:
     - Production Status (`Milking`, `Dry`)
     - Lactation Stage (`Fresh`, `Early`, `Mid`, `Late`, `Dry Period`)
     - Reproduction Status (`Open`, `Pregnant`, `Bred, awaiting check`, etc.)
     - Health Status (`Healthy`, `Sick`, `In Treatment`, `Quarantine`)
     - Category (`Cow`, `Heifer`, `Calf`, `Bull`, `Steer`)
     - Animal Group
   - Filter count badge on Filters button and active filter dismissible chips.
3. **Animal Groups Sheet & Management**:
   - Animal Groups sheet modal:
     - List groups with member count, search input, and `+ Create Group` button.
     - Select group to filter active herd list.
     - View & manage group members (add/remove animals) via backend `/api/v1/animal-groups`.
4. **Backend & Web Alignment**:
   - Add `lactationStage` filter to backend `ListCattleQueryDto` and `CattleService.findAll`.
   - Update `apps/web/features/cattle/components/cattle-filters.tsx` to align with the refined filters (replacing lifecycle sub-stage with lactation & reproduction stages).
   - Regenerate OpenAPI & `@rakhal/api-client`.
5. **Quality Gates & Merge**:
   - Zero drop shadows (ADR-007).
   - All tests green across mobile, web, and API.
