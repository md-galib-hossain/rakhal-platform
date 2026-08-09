# Frontend — Current State

## RAKHAL-316-F/318-F — Return-to-heat dialog + heat-on-pregnant conflict toast (2026-08-09)
Frontend companions to backend MILESTONE 19. New "Return to Heat" action on the Reproduction page's
"Pregnancy Check Due" panel (opens a small dialog, calls the new `POST
/reproduction/breeding-events/:id/return-to-heat`); `createHeatEvent`'s dialog now shows a warning
toast instead of a plain success toast when the response flags `activePregnancyConflict`. Full
writeup: `docs/IN_FLIGHT.md` Recently Done (agent-m19f). **Remaining from this milestone**:
RAKHAL-317-F (calculated-vs-expected calving date badge) blocked on no edit-dialog surface existing
in this frontend yet; RAKHAL-319-F (intake form "Bred / AI given" + "Currently in heat" sections)
not started. Backend side (RAKHAL-313→319) is fully `DONE` — see
`D:\Projects\Rakhal\docs\PROJECT_PROGRESS.md` MILESTONE 19.

## RAKHAL-287 — MilkDisposition + MilkEligibility types (blocked on missing backend routes) (2026-08-06)
Backend's "cattle status model rewrite" (RAKHAL-269…280) shipped two new Milk-module domain
concepts with **no read-side wiring**, confirmed by reading the backend source directly (not
guessed): `MilkDisposition` (RAKHAL-277, `src/modules/milk/domain/milk-disposition.ts`) is computed
and stored on `MilkLogEntry.disposition` at `saveLog()` write time, but `GET /milk/log`
(`MilkService.logTable()`) never selects/returns it — the response shapes one row per cow per day
and has no per-entry `disposition` field, and no other route exposes raw `MilkLogEntry` rows either.
`MilkEligibility` (RAKHAL-278, `MilkService.getMilkEligibility(farmId, cattleId)`) is fully
implemented server-side but has **zero HTTP route** — `milk.controller.ts` has no `eligibility`
endpoint, and the service method's own doc comment says so explicitly ("no new controller route
since the ticket's acceptance criteria don't ask for one"). Grepped the whole backend `src/` for any
caller of `getMilkEligibility` — none exists.

Per the hard rule ("never guess API shapes — unclear → stop and note it"), did **not** fabricate a
route or fake data. Delivered only what's honestly implementable: `MilkDisposition`/
`MilkEligibilityStatus`/`MilkRestrictionReason`/`MilkEligibility` types added to `features/milk/types.ts`
(doc-commented as not-yet-wired, ready for when the backend route ships), plus i18n labels for all 6
disposition values and 4 eligibility `primaryStatus` values + 6 restriction reasons
(`milk.log.dispositionOptions`, `cattle.detail.milkEligibility(Options)`,
`cattle.detail.milkRestrictionReasonOptions`, bn+en). No API call, hook, log-entry chip, or cattle-
profile-card wiring was added — there is nothing real to call. Logged in
`docs/PROJECT_PROGRESS.md`'s backend-gaps table; needs a `GET /milk/eligibility/:cattleId`-shaped
route (or similar) plus `logTable()`/`saveLog()` returning `disposition` before this ticket's UI can
actually be built.

**Step 6 reconciliation (dashboard withholding count) — confirmed NOT broken.** RAKHAL-279 dropped
`WITHHOLDING` from `DerivedHealthStatus` (the per-cow health badge), but `DashboardService.herdStatus()`
(`src/modules/dashboard/application/services/dashboard.service.ts`) never depended on that enum value —
its `healthBreakdown.withholding` count is computed independently via
`prisma.safetyWithdrawal.count({ where: { farmId, status: ACTIVE } })`, the same underlying fact
`MilkEligibility`/`activeMilkWithholdingCattleIds()` also read. `features/dashboard/types.ts`'s
`healthBreakdown.withholding` and `herd-status-donut.tsx`/`production-summary-card.tsx` are correct
as-is — no frontend change made. Also confirmed `features/cattle/types.ts`'s
`HealthStatusFilter` still lists `"WITHHOLDING"` as a list-filter value — intentional per backend
ADR-020 (`?healthStatus=WITHHOLDING` filter kept even though the derived badge value was dropped),
not stale.

Gate: `pnpm typecheck` (0) / `pnpm lint` (0 errors, same 10 pre-existing
`react-hooks/incompatible-library` warnings) / `pnpm build` (0, all 37 routes) / `pnpm test`
(18 passed) — all green. Files: `features/milk/types.ts`, `i18n/messages/{en,bn}.json`
(`milk.log.dispositionOptions`, `cattle.detail.milkEligibility*`/`milkRestrictionReasonOptions`),
`docs/{CURRENT_STATE,PROJECT_PROGRESS,IN_FLIGHT}.md`.

## Export buttons: Cattle/Milk/Finance/Healthcare + Dashboard PDF (2026-08-02, user request)
Frontend half of the backend Reports-engine export work (backend: `rakhal-backend` `docs/CURRENT_STATE.md`'s
matching dated entry). Reused the existing `features/reports/` generate/poll/download implementation
(RFE-041) rather than building a new mechanism — exported `GenerateReportDialog` with a loosened prop
type (`GenerateReportDialogDef`), new `report-defs.ts` (static metadata for the 5 new backend report
ids), new `ReportExportButton` (gated on `reports.create` + the `reports.generate` Pro feature) wired
into each page's existing action slot. Full narrative + live-verification notes: `docs/IN_FLIGHT.md`'s
"Recently Done" entry.

## Onboarding wizard — RFE-047, PRD-spec (no Figma) (2026-07-27, user request)
Fixed the real beta-blocking bug: a first-login user with zero farms created a farm via
`CreateFarmForm` and landed straight on `/dashboard` with zero sheds/cattle/team and no way back
into any setup flow — `app/(onboarding)/onboarding/layout.tsx`'s gate redirected any real `farmId`
away unconditionally. New 3-step wizard (`features/onboarding/**`): Configure (sheds + milking
sessions + milk unit, `POST /onboarding/configure`) → Add cattle (reuses `CattleFormDialog`/
`CattleImportDialog` from `features/cattle`, no bespoke create flow) → Invite team (`POST
/settings/team/invite`, called directly since Settings' own Team tab isn't built yet, RFE-045).
Every step independently skippable; "Finish setup" calls `POST /onboarding/complete` then redirects
to the dashboard. The layout gate now fetches live `GET /onboarding/status` and only redirects to
`/dashboard` once `has_completed_onboarding` is true, in both directions (re-visiting `/onboarding`
post-completion correctly bounces back out). New `OnboardingShell` (wider than `AuthShell`'s 453px
card — the sheds list needs more room). **Live-verified end-to-end** against a real farm-scoped
session (412 real seeded cattle): Configure → skip → Cattle (real count shown) → skip → Team →
Finish → real `POST /onboarding/complete → 201` → real Dashboard render. **Caught and fixed a real
bug live**: the Configure step's default one-blank-shed row failed `name` validation silently (no
error shown), permanently blocking "Continue" — fixed by defaulting to zero sheds + relaxing the
form-level schema to drop blank rows client-side instead of rejecting them. `tsc`/`eslint` clean.
**Known gap, flagged not hidden**: a user who abandons the wizard and logs back in via the normal
single-farm auto-login path lands on `/dashboard` without resuming (that path doesn't re-check
onboarding status) — acceptable for a once-ever wizard; full fix needs a status check in the
hottest shared layout in the app for a low-frequency edge case. `next build` was blocked this
session by an unrelated in-progress file (`app/invite/[token]/page.tsx`, another agent's active
claim) — verified via `tsc`+`eslint`+live dev-server click-through instead. Full detail:
`docs/PROJECT_PROGRESS.md` RFE-047 entry.

**Last updated:** 2026-07-27 · **Completion:** Phase 0 done (RFE-001…010) + RFE-100 marketing landing +
Phase 1 RFE-020 (Dashboard) + RFE-021 (Cattle list) + RFE-022 (Cattle add/edit) + RFE-023 (Cattle detail)
+ RFE-025 (Milk log) done · **Inventory tab now has all 5 categories built** (Medicine/Feed/Semen/Milk/Others —
Feed is a unified tab with Purchased/Prepared segments as of 2026-07-19, see the entry below)
· **Finance (RFE-035) 5 tabs + Wallet + Record wizard done** — Master Ledger/Receivables/Payables/
Liabilities/Asset Distribution + Wallet hub (Add Funds/Withdraw) + the 4-type Record transaction
wizard, all Figma-perfect; only the record-payment/void/create-asset modals remain (no Figma yet).

## Calves module — RFE-033, self-designed (no Figma) (2026-07-27, user request)
User asked to complete the Calves module with no Figma frames available, following the established
widget-grid UI pattern — same precedent as RFE-030 Reproduction. `features/calves/**` and
`app/(app)/calves/**` were both empty (RFE-033 was `TODO`) — the `/calves` nav route existed but
rendered the generic `RouteStub` placeholder. Built end-to-end against the real backend
(`calf.controller.ts`/`calf.service.ts`, verified from source). 4-KPI row (Total Calves/Fed Today/
Health Concern/Weaning Due This Week) from `GET /calves`'s `meta.kpis` (same extended-cursor-meta
convention as `TaskListPage`); cursor-paginated `DataTable` (name/tag, age, dam, stage, weight,
health, fed-today, weaning-due). Calf-profile drawer (`?view=`, same `Sheet` shape as
`CattleDetailSheet`) with 6 URL-synced tabs (Overview, Colostrum, Milk & Feeding, Weight, Starter
Feed, Tasks) — each of the 5 log actions (colostrum/milk-feeding/weight/starter-feed) is a
`FormDialog` triggered from inside its own tab (mirroring `OverviewTab`'s `RecordWeightDialog`
pattern), not table row actions, since a per-row 5-item sub-menu would be worse UX. Wean lives in the
profile header (`calf.update`-gated) — irreversible: flips the row's `purpose` away from `CALF`,
moving it into the Cattle module and out of this list; the dialog carries explicit warning copy and
the hook invalidates the list on success so the calf disappears on the next fetch. No `calf.create`
route exists (calves originate only from Reproduction's calving-event flow), so deliberately no "Add
Calf" button anywhere on this page. Weight tab reuses `features/cattle/components/detail/charts/
trend-chart-inner.tsx` (dynamic-imported, generic chart primitive — cross-feature reuse, not
duplication). `qk.calves.{list,detail}` appended to `lib/query/keys.ts`; `calves` i18n namespace
appended to both `en.json`/`bn.json`, borrowing `dashboard.herdStatus.calves.*`'s stage wording
(duplicated per the app's established per-feature convention, not cross-referenced). Gate:
`tsc`(0)/`eslint`(0 new)/`next build`(0). **Live-verified** (demo owner, real backend): list+KPIs
render real seeded data (4 calves, 1 health concern), the detail sheet opens with full profile data,
tab switching works, and a real `POST /calves/:id/milk-feeding` write succeeded (201 Created) with
the new row appearing immediately via cache invalidation; both locales (bn default + en) confirmed
rendering correctly. Full detail: `docs/PROJECT_PROGRESS.md` RFE-033 entry / `docs/IN_FLIGHT.md`
Recently Done.

## Reproduction module — RFE-030, self-designed (no Figma) (2026-07-26, user request)
User asked to complete the Reproduction module with no Figma frames available, following the
established widget-grid UI pattern from Milk/Cattle. `features/reproduction/**` and
`app/(app)/reproduction/**` were both empty (RFE-030 was `TODO`) — the `/reproduction` nav route
existed but rendered the generic `RouteStub` placeholder. Built end-to-end against the real backend
(`reproduction.service.ts`/`repro-protocol.service.ts`, verified from source — the aspirational
`Rakhal_API.md` §5 lists stale route names like `/reproduction/ai`/`/dryoff` that don't exist).
Dashboard (4 KPI `StatCard`s, 5 action panels, 30-day calving forecast, open-cows `DataTable`) from
`GET /reproduction/dashboard`; unified events feed (cow/type/date filters) from `GET
/reproduction/events` (both RAKHAL-051). Create dialogs (`FormDialog` + react-hook-form + zod,
mirroring `ReportSicknessDialog`'s no-Figma pattern): heat, breeding/AI (semen-batch picker → real
`GET /inventory/semen/batches`, decrements a straw on the backend), pregnancy diagnosis, calving
(`useFieldArray` calves[], each ALIVE calf becomes a real `Cattle` record server-side), abortion. A
RAKHAL-214 protocols panel (protocol cards + apply-to-cows dialog + per-instance record-AI/record-
outcome/close actions). `components/shared/cattle-picker.tsx` gained an optional `gender` filter
(backward-compatible) so the female-only/bull pickers can't submit a cow the backend would 400 on.
**Known gaps, flagged not hidden:** dry-off has no backend route (`DryPeriod` is schema-only) — its
dashboard panel is informational only; protocol instance rows show `cattle_id` only (the backend's
`mapInstance` doesn't join cattle name/tag). Full file list and API surface: `docs/PROJECT_PROGRESS.md`
RFE-030 entry / `docs/IN_FLIGHT.md` Recently Done. **Live-verified** (demo owner, real backend): full
dashboard/action-panels/forecast/open-cows/events-feed/protocols render with real seeded data, a
breeding/AI dialog opens correctly pre-filled from an action-panel row. Caught and fixed one real bug
during that pass — `GET /reproduction/events` actually returns its `{items, meta}` through the
backend's cursor-envelope interceptor (`data` = the items array, not `{items, meta}` nested inside
`data`), same convention `apiFetchPage` already models; `reproductionApi.events()` was calling plain
`apiFetch` and expecting the nested shape, throwing "Cannot read properties of undefined (reading
'length')" in `ReproductionEventsFeed`. Switched to `apiFetchPage`, fixed two more latent
`data?.items.length`-without-`items?.` spots (events feed, protocols instances list).

## Migrate Cattle + Feed Formulator bulk bars onto the shared floating dock (2026-07-21, user request)
Follow-up to the row below: after auditing every module for dock fit (2 parallel Explore agents),
user picked Cattle + Feed Formulator next — both already had full inline bulk-action bars (Cattle:
change shed/change feed-group/mark sold/export CSV; Feed Formulator: bulk-delete concentrations),
just rendered inline instead of the new floating dock. **Pure relocation, zero new backend
endpoints** — every action/dialog/mutation preserved exactly. Both `*-bulk-actions-bar.tsx` files
deleted, logic folded directly into `cattle-table.tsx`/`feed-view.tsx` (matches how every Inventory
`*-view.tsx` owns its own dock wiring). **Cattle**: `enableRowSelection` changed from an ungated
`true` to `useCan("cattle.bulk")`-gated (fixes a pre-existing checkbox-visible/bar-hidden
mismatch); `useTableBulkSelection` adoption added a "Select all N" button Cattle didn't have before
(new `cattle.bulk.selectAll` key, en+bn); change-shed/change-feed-group keep their own custom
dialogs (bare `onRun`, the exact case `BulkActionDock`'s doc comment calls out); mark-sold became a
`requiresConfirm` dock action; export unchanged (sync, no confirm, doesn't clear selection).
**Feed Formulator**: the two independent section selections (Concentrate Mixer/TMR) migrated from
a private `useSectionSelection` hook onto the shared `useGridBulkSelection` (which was itself
originally promoted from this exact hook — closes the loop). Solved "two simultaneous floating
docks" (nothing stopped both sections having a selection at once under the old inline layout, but a
floating dock is always fixed bottom-center) via **mutual exclusion** — selecting in one section
clears the other — verified live, not just claimed. Gate: `tsc`(0)/`eslint`(0 new)/`vitest`(18/18)/
`next build`(0). **Verified live** (demo owner + demo worker): Cattle's full action set confirmed
correct; Feed Formulator's mutual exclusion proven via DOM inspection (selecting a TMR card flipped
a selected Mixer card's checkbox back off); a real bulk-delete on leftover E2E-debris confirmed
end-to-end. Also fixed an unrelated dev-environment port mismatch (`.claude/launch.json`'s backend
port didn't match the backend's own `.env`) found while restarting the preview stack. Full
narrative: `docs/IN_FLIGHT.md` / `D:\Projects\Rakhal\docs\CHANGELOG.md`.

## Shared bulk-select + bulk-delete "dock" — Inventory pilot (2026-07-21, user request)
User asked for a UX analysis of adding bulk-select + bulk-delete across every module's list views,
specifically floating the idea of a dock panel anchored bottom-center of the screen. Research found
`components/shared/data-table.tsx` already fully supports row selection (only Cattle used it) and two
existing bulk-action bars (Cattle, Feed Formulator) that both render **inline**, not floating — no
shared floating pattern existed. Locked 3 decisions via `AskUserQuestion`: pilot on **Inventory's 4
tabs** (Medicine/Equipment/Feed Item/Feed Stock) first; a **generic** `BulkAction[]`-shaped dock (not
delete-only) so it can later absorb Cattle's/Feed's existing bars; **always-visible checkboxes** (no
new "select mode"). Backend half (4 new bulk-delete routes) in `D:\Projects\Rakhal\docs\CURRENT_STATE.md`.
New shared `components/shared/bulk-action-dock.tsx` (fixed bottom-center, portaled to `document.body`,
enter-animation only), `lib/hooks/use-bulk-selection.ts` (`useTableBulkSelection` wraps TanStack's
`RowSelectionState`; `useGridBulkSelection` promotes `feed-view.tsx`'s private `Set<string>` selection
hook into a shared one), `components/shared/selectable-card-overlay.tsx` (corner-checkbox wrapper
anchored to a card's outer div, avoiding collision with each card's own inner-image overlays). Wired
into all 4 tabs' table + grid components; each view gates the checkbox itself via
`useCan("inventory.delete"` or `"feed.delete")`, not just the dock, so an unauthorized role never sees
a checkbox. Selection resets on pagination/filter change via a render-time key comparison (not
`useEffect`, to avoid this repo's `react-hooks/set-state-in-effect` lint gate). New i18n `<feature>.bulk`
blocks (en+bn) per module. Gate: `tsc`(0)/`eslint`(0 new)/`vitest`(18/18)/`next build`(0). **Verified
live** (demo owner + demo worker, real backend): full select/select-all/cancel/real-delete cycle on
Medicine (table+grid) and Feed Stock (table); RBAC confirmed — worker sees zero checkboxes anywhere.
Fixed one bug caught live: the dock's `ConfirmDialog` wasn't passing a localized `cancelLabel`. Not in
this pass: Cattle/Feed Formulator's own inline bars, Sick Bay (hand-rolled `<table>`). Full narrative:
`docs/IN_FLIGHT.md` / `D:\Projects\Rakhal\docs\CHANGELOG.md`.

## Feed/Forage taxonomy unification (2026-07-19, user request)
User asked for a first-principles review: feed is the umbrella term (forage/concentrate/mineral/
vitamin/additive are classes of feed, not separate categories), but Inventory had it backwards — the
"Forage" tab was the real feed warehouse, a sibling "Feed" tab (added the session before) held only
manufactured TMR batches. Backend half in `D:\Projects\Rakhal\docs\CURRENT_STATE.md` (new
`FeedClass`/`FeedSubType` enums, `Forage`→`FeedItem` rename + real `ingredientId` FK to
`FeedIngredient` fixing two bugs — a bag-unit item never decremented on a feed log, and a price
change never refreshed Feed Formulator costs). This is the frontend half. Inventory collapses to
**5 tabs**; the new unified **Feed** tab (`feed-view.tsx`) has a **Purchased**/**Prepared** segmented
control (`?segment=`) over the renamed `FeedItemView` (10 components renamed from `Forage*`) and the
pre-existing `FeedStockView`. The create/edit form gained a required "Linked Ingredient" field
(reuses `features/feed`'s `IngredientPicker`, cross-feature import) that auto-fills Feed Class from
the picked ingredient. `ingredient-picker.tsx`'s category grouping reordered to match how a
nutritionist builds a ration (Forage→Concentrate→Mineral→Vitamin→Additive). Full i18n (en+bn).
Gate: `tsc`(0)/`eslint`(0 errors)/`vitest`(18/18). Not verified live in the browser this pass — see
`docs/IN_FLIGHT.md` for the full verification note. Full narrative: `D:\Projects\Rakhal\docs\CHANGELOG.md`.

## Prepared feed tab: table/grid parity + deeper metrics (2026-07-19, user follow-up)
Follow-up on the row above: the Prepared segment was still a bespoke flat list, not the shared
table/grid the rest of Inventory uses, and had only 3 stats. New `feed-stock-metrics.ts` (cost/kg,
consumed kg, remaining %, a 3-tier status) + `feed-stock-columns.tsx`/`feed-stock-table.tsx`/
`feed-stock-grid.tsx` mirroring the Purchased tab's `FeedItemColumns`/`Table`/`Grid` shape.
Each row/card now shows source name + a Concentrate Mixer/TMR badge, produced date, produced/
remaining/consumed qty, cost/kg, and total cost; the grid adds a remaining-vs-produced progress
bar. `feed-view.tsx` now threads the table/grid toggle into both segments, not just Purchased.
Gate: `tsc`(0)/`eslint`(0)/`vitest`(18/18). **Verified live** (demo owner, real backend) — both
views render correct real data and math; caught + fixed a duplicate "Deleted formula" display bug
in the grid during verification. Full narrative: `docs/IN_FLIGHT.md`.

## Concentrate Mixer must not create inventory + FeedStock deletable (2026-07-19, user correction)
The Prepared-tab screenshot above surfaced a conceptual bug: a **Concentrate Mixer** is a virtual
recipe/calculator (unlimited, zero inventory impact); only a **TMR** (`FEED_MIXTURE`) finalize
should produce real `FeedStock`. Backend half in `D:\Projects\Rakhal\docs\CURRENT_STATE.md` fixed
`finalize()` to only produce stock for TMR, and added `FeedStock` soft-delete (`DELETE
/feed/stock/:id`, `feed.delete`). This is the frontend half: `FinalizeConcentrationResult.stock`
retyped `FeedStock | null`; new `useArchiveFeedStock()` hook; delete icon added to both the
Prepared table (`feed-stock-columns.tsx`) and card grid (`feed-stock-grid.tsx`), wired through
`feed-stock-view.tsx` with a `ConfirmDialog` + toast. i18n (en+bn) updated to drop the false
"produces a stock batch" claim for Concentrate Mixer and add delete-flow strings.
Gate: `tsc`(0)/`eslint`(0)/`vitest`(18/18). **Verified live** (demo owner, real backend): Prepared
table now shows zero Concentrate Mixer rows (all TMR); delete confirmed in both table and grid
view. Full narrative: `docs/IN_FLIGHT.md`.

## Milk page follow-ups: relock, Space wrap, per-cow tank selection, caret fix (2026-07-19, user request)
4 more gaps reported on the just-shipped Milk page: (1) could unlock Noon/Night but not lock back —
new `SessionActiveControl` mirrors the unlock control on active headers (Owner-only), same
`PATCH /settings/modules/milk-sessions` with the session removed. (2) Space at a row's last active
column used to no-op — now wraps to the next row's first active column. (3) Tank column was a static
label — new backend `MilkLogEntry.tankId` (migration `milk_log_tank_selection`) lets a header popover
set a bulk default tank per SELLABLE/WITHHOLDING type, with each row's own real `Select` (reusing
Inventory's existing `useMilkTanks()` hook) able to override individually; `submit()` now routes volume
into the specific named tank instead of always grabbing "first active tank of the type." (4) Fixed an
oversized yield-input caret (`leading-none`, was inheriting a 20px line-height into a 36px pill) and
confirmed the "All Sheds" blank shed column is real data (no `shedId` on the seeded demo cattle), not a
bug. **Verified LIVE**: both lock directions fired real `PATCH → 200`s with correct header swaps; Space-
wrap confirmed via focus-index checks; tank header default applied to all 8 visible rows then a row
override correctly diverged; caret line-height confirmed via computed style. Same known `loading.tsx`
reveal-hang hit and worked around (temporary rename during verification, restored after). Gate green:
typecheck/lint (0 errors, same pre-existing warnings); backend milk e2e 8/8. Full writeup: `IN_FLIGHT.md`
Recently Done.

## Milk page: configurable sessions (owner-locked) + keyboard navigation (2026-07-18, user request)
User asked to improve the Milk Log page — farms milk 2/3/4×/day but Noon/Night had no way to enable,
and 10+ row × per-session entry was all-mouse. Backend (see `D:\Projects\Rakhal\docs\IN_FLIGHT.md`)
added an owner-only `PATCH /settings/modules/milk-sessions` + write-time enforcement. Frontend:
`milk-log-table.tsx` now always renders all 4 session columns — a locked one (Noon/Night by default)
shows a lock icon; the Owner gets a click-to-unlock `Popover` (`useCan("settings.milk-sessions-manage")`),
everyone else sees a static label. Added spreadsheet-style keyboard nav on focused yield inputs:
**Enter** → next row, same session; **Space** → next active session, same row (locked columns skipped
automatically since they have no input). `components/ui/input.tsx` gained ref-forwarding (React 19
ref-as-prop, additive-only). **Verified LIVE** end-to-end (demo owner): default Morning/Evening-editable
+ Noon/Night-locked rendering confirmed, unlock popover opened with correct Bangla copy, real
`PATCH → 200` enabled Noon and made it editable while Night stayed locked, then restored to defaults;
Enter/Space navigation confirmed correct including no-op edge cases; normal typing unaffected. Hit the
same `loading.tsx`/Turbopack Suspense reveal-hang the Feed Formulator Phase 11 entry below already
documented (pre-existing, unrelated to this change) — resolved itself once an unrelated navigation
occurred; confirmed app logic was correct throughout via direct fetch calls. Gate green:
typecheck/lint (0 errors, same pre-existing warnings). Full writeup: `IN_FLIGHT.md` Recently Done.

## Finance — Record wizard's Revenue/Sale step, fixed to its own real Figma frames (2026-07-16, user follow-up)
Same pattern as the Inventory Purchase fix below: Revenue/Sale's Step 2/3 had been extrapolated from
Operating Expense's shape; user supplied the real 6 frames. Revenue/Sale turned out the most
structurally different type of the four — "Sales Type" is a real tab-pill bar (Milk/Animal/Manure/
Others), not a dropdown, and **each sub-type has its own non-overlapping field set**: Milk (Liters
Sold × Price Per Unit → computed Total Cost, no Entity Name), Animal (`CattlePicker` + Amount, no
Entity Name), Manure (Amount only), Others (Entity Name + Amount — the only sub-type with an entity
field). Rebuilt `record-transaction-dialog.tsx`'s `REVENUE` branch with a `selectRevenueSubType`
handler that clears every other sub-type's field on switch (real stale-value bug this fixes, not
cosmetic) and a local `selectedCattleLabel` for the Step 3 summary. **Coordinated with a concurrent
same-file edit** — another agent was simultaneously rewriting the same file's Debt/Loan branch;
re-`Read` before every edit, confirmed via diff neither session clobbered the other. **Verified LIVE**:
all 4 Sales Type tabs render their correct distinct fields with zero cross-contamination, Milk's
Total Cost auto-computed correctly (30L × ৳65 = ৳1,950.00), a real submit posted (`201`). Gate green:
typecheck/18 unit tests. Full writeup: `IN_FLIGHT.md` Recently Done.

## Finance — Record wizard's Inventory Purchase step, fixed to its own real Figma frames (2026-07-16, user follow-up)
The Record wizard's `INVENTORY_PURCHASE` branch had been extrapolated from Operating Expense's frame
(no Inventory Purchase frame existed yet); user supplied the real 4 (Step 2 full/partial-payment +
Step 3 summary, Step 1 reused). The real field set turned out meaningfully different: no category/
subType select, no Entity/Vendor Name field, and a **read-only computed Total Cost** (`quantity ×
costPerUnit`, synced into the form's `amount` field via a small `useEffect`) instead of a typed
Amount field. Rebuilt `record-transaction-dialog.tsx`'s Inventory Purchase Step 2/3 to match exactly;
`schemas.ts`'s `subType` went from required to conditionally-required so the wizard doesn't block on
a field this type never collects. **Verified LIVE**: Quantity 50 × Cost Per Unit ৳45 auto-computed
Total Cost ৳2,250.00, Step 3 summary matched the real row order, and a real submit posted
(`POST /finance/transactions → 201`, Operating Margin recomputed 11.71%→11.5%). Gate green:
typecheck/lint/18 unit tests. Full writeup: `IN_FLIGHT.md` Recently Done.

## Finance — Wallet + Add Funds/Withdraw + Record transaction wizard, Figma-perfect (2026-07-16, user follow-up)
Follow-up to the tabs pass below — user supplied 7 more Figma links: Wallet hub, Add Funds, Withdraw,
and the 4-type "Record" wizard (Step 1 type-picker + Step 2 full/partial-payment variants + Step 3
summary, all one Operating-Expense-shaped 3-step wizard, not 4 separate flows). New
`features/finance/schemas.ts` + `components/{wallet-dialog,add-funds-dialog,withdraw-dialog,
record-transaction-dialog,finance-header-actions}.tsx`; the header's "Wallet"/"Record" buttons are
now real, wired to `GET /finance/wallet` and `POST /finance/{wallet/add-funds,wallet/withdraw,
transactions}`. The wizard mirrors `CreateTransactionDto`'s real side effects for all 4 types
(cattle-sale status update, inventory auto-increment, loan create/EMI-payment) — only Operating
Expense has a real Figma frame, the other 3 types' field sets are extrapolated from it (flagged in
`record-transaction-dialog.tsx`'s doc comment). **Caught and fixed a real bug**: giving Wallet/Add
Funds/Withdraw each their own `<Sheet>` broke step navigation (Radix's outside-click detector on a
newly-mounted `Sheet` fired against the click that opened it) — fixed by sharing one `<Sheet>` across
all three steps. **Verified LIVE end-to-end**: a real withdraw and a real 3-step Operating Expense
transaction both posted (`201`s) and showed up immediately in the Wallet balance/Master Ledger table
without a manual refresh. Gate green: typecheck/lint/18 unit tests. Full writeup: `IN_FLIGHT.md`
Recently Done.

## Finance — Master Ledger/Receivables/Payables/Liabilities/Asset Distribution, Figma-perfect (2026-07-16, user request)
`app/(app)/finance/page.tsx` was a plain `RouteStub`; now a full `PageCard`+`FinanceView` against 5
real Figma links (file `SCfMPdxP6vgW1uTxfqCtz7`, node ids in `IN_FLIGHT.md`'s Recently Done entry),
wired to the real `finance.controller.ts`/`finance.service.ts`. My Highlights KPI row (available
liquidity/cost-per-litre/herd market value/survival runway) sits above a 5-tab bar: **Master
Ledger** (Financial Performance Over Time chart + Operating Margin/Debt-to-Asset stats, search/
category filter, transaction table, honest-frontier pagination), **Receivables**/**Payables** (3
stat tiles, search/status filter, settlement table — one shared presentational component,
parametrized by `kind`), **Liabilities** (Total Debt/Monthly EMI + Loan Portfolio table),
**Asset Distribution** (Asset Allocation donut + legend + Total Net Worth, Fixed Asset Depreciation
grouped bar chart). **Real gaps flagged, not faked** — see `features/finance/types.ts`'s doc
comment for the full list (no `FinanceLoan.dueDate`, no per-litre margin/AQR, `herdMarketValue`
always ৳0 server-side, no CSV export route, no ledger `type` filter). **Deferred to a follow-up
pass per the user's own instruction**: the 4-type transaction wizard, record-payment/void/
create-asset modals, and the Wallet sub-page — header buttons render disabled. **Fixed a real
hydration bug found live-verifying**: `FinanceHighlights`' `KpiTile` wrapped `value` in a `<p>`
that couldn't legally contain the Survival Runway tile's `<div>` — fixed to a `<div>` wrapper.
Verified LIVE against the real backend (all 5 tabs, real seeded data, zero console errors). Gate
green: typecheck/lint/18 unit tests. Full writeup: `IN_FLIGHT.md` Recently Done.

## Healthcare — Health Plan tab, Figma-perfect (2026-07-16, user request)
Health Plan segment of the Health Management Center (previously a plain list, no Figma frame) is now
built against 5 corrected Figma links the user supplied after 4 of their original 6 links turned out
to be decorative "Screen Dimer" overlay layers, not real dialog content (byte-identical screenshots
caught it, confirmed via `md5sum`). `HealthPlanCard` (title/planType chip/collapsible Action Sequence,
dropped the mock's unbacked "Currently Active/Success Rate" footer), `CreateHealthPlanDialog` (3-step
wizard, create+edit), `ApplyHealthPlanDialog` (2-step wizard — **no bulk-apply endpoint exists**, so
"Confirm Schedule" loops a real create-case + apply-plan call per selected animal, flagged not faked).
**Found + fixed a severe pre-existing backend bug while live-verifying**: `POST /health/cases` was
500ing for every animal on Demo Farm — `HealthService#nextCaseCode`'s string-sort caseCode lookup broke
once the demo seeder added `HC-SEED-*` rows (they sort ahead of `HC-00008` alphabetically), causing a
permanent P2002 collision. Fixed in `rakhal-backend/src/modules/health/application/services/health.service.ts`
(now computes the max suffix by regex over all `HC-`-prefixed codes, ignoring non-conforming ones) — this
was silently breaking Report Sickness too, not just this new flow. **Verified LIVE end-to-end**: created
a real plan, applied it to Golapi (RKL-020) through the full wizard, both `POST /health/cases` and
`POST /health/cases/:id/apply-plan` fired 201 (network-trace confirmed), Sick Bay count and Herd Health
Score updated live on the dashboard. Full writeup in `IN_FLIGHT.md` Recently Done.

## Inventory — Others/Equipment tab, Figma-perfect (2026-07-16, user request)
New `features/inventory/equipment-*.tsx` (last unbuilt `INVENTORY_TABS` entry, now `implemented: true`)
matched to Figma "Inventory - Other - Table View" (`732:23402`) + "Add New Equipment" side modal
(`734:26462`), built by mirroring the already-shipped Medicine tab 1:1 against the real
`equipment.controller.ts`/`equipment.service.ts`. **Real gaps vs the mock, flagged not faked**:
`Equipment` has no `imageUrl`/`location`/`warrantyExpiry` columns at all — static tinted-`Wrench`-icon
fallback (no photo upload), Location/Warranty fields dropped entirely; mock's "Category" dropdown maps
to the real `type: EquipmentType` enum. **Caught + fixed a real `MISSING_MESSAGE` i18n bug** during live
verification (the type-filter's `typeOptions` translations weren't duplicated under `filters`, unlike
Medicine's own already-correct pattern). **Verified LIVE**: table + grid views render 5 real seeded
equipment rows, Add New Equipment sheet renders all sections with correct `rounded-2xl` photo-placeholder
radius (no border-radius regression), type filter shows correct Bangla options post-fix, zero console
errors. Gate green: typecheck/lint/18 tests. Full writeup: `IN_FLIGHT.md` Recently Done.

## Healthcare — Figma-perfect (2026-07-15, user request)
New `features/health/**` + `app/(app)/healthcare/page.tsx` (was a stub). Dashboard/sick-bay page
matched to Figma `734:35601` (Key Metrics KPI card, Morbidity Trend chart, Health Management Center's
Sick Bay/Task Hub/Health Plan tabs — only Sick Bay has a Figma frame, the other two are plain real
lists, flagged) + the Case Management sheet's 4 tab states (`734:37459`/`38378`/`39319`/`40144` — Log
Treatment/Health Update/Close Case/Log Mortality), all against the real
`health.controller.ts`/`health.service.ts`. "Report Sickness" and the header "Log Treatment" shortcut
have no Figma frame — small non-Figma pickers instead of dead buttons. New `Chip` `purple` variant.
**Verified LIVE** (real 10-case sick bay list, 63% herd health score, correct progress rings/diagnosis
chip colors) via DOM text extraction (screenshot tool down). **Not fully verified**: the Case sheet's 3
submit flows — the shared dev server hung app-wide (`/cattle` too) partway through this session's
click-through testing, flagged as shared-server contention, not a code defect (full writeup +
stack-trace evidence in `IN_FLIGHT.md`'s Recently Done entry). Gate green: typecheck/lint/18 tests.

## Healthcare — Task Hub tab, Figma-perfect (2026-07-15, follow-up user request)
The Task Hub tab (previously a plain list, no Figma frame) is now built against 4 frames the user
supplied: main layout `734:40931`, "Record Vaccination" batch drawer `734:43007`, "Task Reschedule"
`734:44187`, "Task List" day drill-in `734:45177`. Real `HealthTask` rows (one per animal) are grouped
client-side into per-plan "Scheduled Task Cards" (new `features/health/task-grouping.ts`) since the
backend has no multi-animal batch-task record — every aggregate shown is real, not fabricated. New
calendar strip (`GET /health/tasks/calendar`, real overdue/pending dot indicators), filter tabs
(All/Overdue/Today/Upcoming, real counts), reschedule dialog (loops `POST /health/tasks/:id/reschedule`),
and a batch-record dialog (loops the real `POST /health/cases/:id/log-treatment`, one call per selected
animal — the same endpoint Case Management's own Log Treatment tab uses, which server-side completes
the task and fires the real AQR event). Fixed a real cache-invalidation bug found while building this:
completing a task via Case Management never refreshed the Task Hub's own queries. **Also fixed a real
pre-existing hydration bug** (button-in-button) in `features/inventory/components/semen-tank-card.tsx`,
spotted via console while verifying this page. **Verified LIVE end-to-end**: tab counts sum correctly,
a real reschedule and a real batch treatment both round-tripped and updated the UI live — full writeup
in `IN_FLIGHT.md` Recently Done. Gate green: typecheck/lint/18 tests.

## Inventory — Semen tab, Figma-perfect (2026-07-15, user request)
Full LN2-tank + straw-batch CRUD (`features/inventory/semen-*`) matched to the real Figma frames
("Inventory - Semen" 732:20158, "Add New Tank" 732:21955, "Tank Details" 732:22640, "Add Straw"
732:23249, file `SCfMPdxP6vgW1uTxfqCtz7`), backed by the real `semen.controller.ts`/`semen.service.ts`
+ `SemenTank`/`SemenBatch` Prisma models — a tank's straw stock is derived from its batches, not a
tank-owned field. `INVENTORY_TABS.semen.implemented` flipped to `true`. **Real gaps vs the mock,
flagged not faked**: no "Straw in Stock" field on tank create (derived-only); "Tank Details"'
"Adjust Straw Stock" repurposed into a real "Update Readings" (temp/LN2) quick-form since stock has
no tank-level endpoint; "Add Straw" gained a required Batch/Straw Name field the mock didn't picture;
no tank-edit/archive UI (matches Milk's own precedent). **Verified LIVE end-to-end** against the real
backend: real seeded `LN2 Tank 1` (42/120 straws, 3 batches incl. one correctly rendering in
destructive red for low straw count) plus a real created-then-archived test tank (`POST` 201 →
`DELETE` 200) — full writeup in `IN_FLIGHT.md` Recently Done, including a caught-and-fixed browser-pane
tunnel leak to the real `farm.rakhal.app` staging site (caused by this session's own new proxy.ts
marketing→farm-host redirect, not a bug — just required a local `.env` override to test against
localhost). Gate green: typecheck/lint/18 unit tests.

## Inventory — Milk tab, Figma-perfect (2026-07-13, user request)
Full tank CRUD + volume-sync + audit log (`features/inventory/milk-*`) matched to the real Figma
frames ("Inventory - Milk" 734:27903, "Add New Tank" 734:30564, "Sync to Physical" 734:31364, file
`SCfMPdxP6vgW1uTxfqCtz7`), backed by the real `milk-tank.controller.ts`/`milk-tank.service.ts`
(list/create/update/archive + the audited `adjust-volume` endpoint, never a plain volume field edit)
+ `GET /inventory/milk-tanks/audit-log` (cursor, same honest-frontier `Pagination` pattern as
Medicine/Forage). `INVENTORY_TABS.milk.implemented` flipped to `true`. **Real gaps vs the mock,
flagged not faked**: no `coolingType` field exists on `CreateMilkTankDto`/`UpdateMilkTankDto` at all
— the mock's dropdown renders disabled/decorative, never submitted; the mock's "Statistics" KPIs
("Own Herd Production"/"Outsourced Purchase" split, "Calf Feed Pool") have zero backing data anywhere
in this schema — replaced with a real Sellable/Withholding volume breakdown of the same `Total Milk
Stock` sum instead of inventing numbers. The bottle-fill gauge is a plain data-driven div (real
`fillPct` per tank), not a re-hosted copy of Figma's exported bottle asset (those URLs expire in 7
days and had one fixed mock fill baked in, not a real per-tank percentage). "Route/Sell"/"Route/Resolve"
are bare `/buyers` deep links (no tank-preselection flow exists there yet). Operator names on the
audit log resolve via a best-effort `GET /settings/team` fetch (`team.read`-gated — may not be
granted to a Worker role; falls back to a tinted-initial avatar + generic label rather than blocking
the page on a 403). **Verified LIVE end-to-end** against the real backend (2 real seeded tanks — Main
Sellable Tank 220/500L, Withholding Tank 18/100L): create → 201 (new tank appears immediately, correct
blue/amber ribbon + bottle fill), Sync to Physical → 201 `adjust-volume` + correct audit row, archive
→ real cleanup after testing — zero console errors, dark theme confirmed via computed styles (info/
warning tokens resolve correctly in both themes). Caught and fixed one real bug during live
verification: the sync dialog's composition-changed check (`values.fatPct !== tank.fatPct`) compared
`undefined` against `null` and fired a spurious no-op `PATCH` on every sync even when Fat/Protein/SNF
were untouched — fixed by normalizing both sides to `null` before comparing, confirmed via network
trace that only `adjust-volume` fires now. Also fixed the audit log's "Storage" column losing a tank's
name once that tank is archived (name resolution now fetches `includeArchived: true` separately from
the active-only tank grid). Gate green: typecheck/lint/18 unit tests (`next build` skipped — another
agent's live `next dev` shared the same `.next/`, same precedent as the Forage-tab entry below). Full
writeup: `IN_FLIGHT.md` Recently Done.

## Inventory — Forage tab, Figma-perfect (2026-07-12, user request)
Full CRUD tab (`features/inventory/forage-*`) matched to the real Figma frames (list, grid, Add/Edit
side modal, "Item Details" view modal), backed by the real `forage.controller.ts`/`forage.service.ts`
(cursor list/detail/create/update/archive/restore — no separate adjust-stock endpoint, unlike
Medicine). `INVENTORY_TABS.forage.implemented` flipped to `true`. Two real gaps vs Medicine, flagged
not faked: `Forage` has no photo column/endpoint at all (static placeholder tile, tinted-icon
fallback everywhere) and no audited stock-adjust route (new small `ForageStockUpdateDialog` PATCHes
`currentStock` directly, matching what the backend allows). **Verified LIVE end-to-end** against the
real backend (6 real seeded forage rows in both table/grid view): create → 201, view details → 200,
stock update → 200 (reactively reflected in the open detail sheet), edit prefill (confirmed
`currentStock` stays editable), archive → 200 — zero console errors; the test row created during
verification was archived afterward to keep demo data clean. Gate green: typecheck/lint/18 unit
tests (`next build` skipped — another agent's live `next dev` shared the same `.next/`). Full
writeup: `IN_FLIGHT.md` Recently Done.

## Cattle — pixel-perfect pass + reusable Pagination (2026-07-12, user request)
Pulled the real Figma "Cattle" + "Cattle (Details - Overview)" frames live and matched them exactly.
New **reusable** `components/shared/pagination.tsx` (`Pagination` — numbered pills, prev/next, "Page
[N] of total" jump select) replaces the cursor "Load more" footer everywhere it's used on `/cattle`,
backed by a new `useCattlePagedList` adapter that turns the backend's keyset-only `GET /cattle` (no
`total`/offset) into numbered pages honestly — caches the cursor trail as pages are visited, never
fetches by a fake offset, `totalPages` is the discovered frontier (grows by one each time a new page
is reached). New `components/ui/chip.tsx` (outline-pill status style) for the table's Status/Health
columns; gender glyphs (`Mars`/`Venus`, new `--accent-pink` token) in the name cell; rebuilt
`CattleHighlightsBar` as its own elevated "Cattle Highlights" card; added the "All Cattle View"
section heading with search/filter/`CattleAddButton` grouped in one row. New `CattleDetailSheet`
right-side drawer (row-action "View Details") — reuses RFE-023's profile card + 5 tabs as-is, the
`/cattle/:id` route stays the deep link. **Verified LIVE** against the real backend (27 real seeded
cattle, 2 real pages): genuine `?cursor=` network requests on page navigation, gender/status colors
confirmed via computed style, "View Details" → real drawer with live chart data → "Edit Profile"
handoff, zero console errors. Gate green: typecheck/lint/build/18 unit tests. Full writeup:
`IN_FLIGHT.md` Recently Done, `PROJECT_PROGRESS.md` RFE-021.

## RFE-025 — Milk log page (2026-07-11)
Built in parallel with another agent's RFE-023 (cattle detail) — deliberately picked a zero-overlap
module (`features/milk/**`/`app/(app)/milk/**` vs their `features/cattle/**`/`app/(app)/cattle/[id]/**`)
per the user's "make sure no conflict" instruction; confirmed both compile together in the same
`pnpm build`. Overview KPIs + 30-day trend (`GET /milk/overview`, one query shared by both widgets),
session tabs from the farm's real `sessionConfig` (not a hardcoded 4) wrapping an editable per-cow
yield grid (`GET/POST /milk/log`, `POST /milk/submit`), and an anomaly review list (`GET /milk/anomalies`,
`POST /milk/anomalies/:id/review`) — all real backend routes verified directly against
`milk.controller.ts`/`milk.service.ts`. New local `MilkCard` chrome (didn't reach into
`features/dashboard`'s `DashboardCard` — no public `index.ts` there per the import-boundary rule).
**Hit + fixed a real `set-state-in-effect` error**: restructured the session-switch draft re-seed from a
`useEffect` into a `key`-remounted child component (`MilkSessionTable`), reusing the same remount-key
pattern `CattleFormDialogBody` already established in this codebase. **Verified LIVE end-to-end**: real
overview totals/session-status dots, trend chart, session tabs correctly show only the farm's 2
configured sessions, switching sessions correctly resets drafts to that session's own values, a real
`POST /milk/log` save (`201`, toast, auto-refetch confirmed via network log), dark theme + mobile (no
overflow). Gate green: lint/typecheck/build/18 unit tests. Full writeup: `PROJECT_PROGRESS.md` RFE-025.

## RFE-023 — Cattle detail (5 tabs) (2026-07-11)
`app/(app)/cattle/[id]/page.tsx` — Overview/Reproduction/Health/Finance/Ancestry, all live against
real backend endpoints (`cattle-detail.service.ts` + reproduction/health `*-summary`). Built as a
plain page, not the Figma drawer (D-2 — no intercepted-route precedent yet). Health's vaccination
timeline and Ancestry's canvas pedigree diagram simplified to cards/grid (PRD-spec gaps already
flagged in `rakhal-ui-analysis.md`). Cattle list rows now link to the detail page. **Not built this
pass**: BCS/weight record-entry dialogs (Overview only displays history, doesn't add new records).
See `IN_FLIGHT.md` Recently Done for the full write-up. Next: RFE-024 (CSV import).

## RFE-022 — Add/Edit cattle + photo + status flows (2026-07-11, incl. pixel-exact follow-up)
Cattle create/edit (`CattleFormDialog`, one dialog for both), status-change dialog, archive dialog
(sold/deceased/archived), and a per-row actions menu — all live against the real backend. See
`IN_FLIGHT.md` Recently Done for the full write-up, incl. two app-wide infra bugs found+fixed along
the way (no multipart upload path existed yet; `useCan()` never matched the backend's `["*"]` Owner
wildcard). **Follow-up pass**: rebuilt to pixel-match the real Figma "Add New Cattle" modal (620px,
dashed separators, muted section bands, square photo dropzone, stacked-label fields via new shared
`components/ui/labeled-field.tsx`) — photo is now staged locally and uploaded in the same "Save
Cattle" click right after create/update, instead of being edit-only. **R2 `AccessDenied` flagged in
the earlier pass is now resolved** (user granted bucket write access) — photo upload verified LIVE
end-to-end (create → 201 → photo → 201, real R2 thumb renders in the list). Next: RFE-023 (detail
page) or RFE-024 (CSV import, depends on this ticket).

## Named shadow token (2026-07-11, user request)
The one repeated arbitrary-value shadow (`shadow-[0px_0px_3px_rgba(0,0,0,0.1)]`, duplicated in
`DashboardCard` and the new `PageCard`) is now a real design token: `--shadow-card` in `app/globals.css`
(`:root` value + `@theme inline` mapping, same two-step pattern as `--radius-sm/md/lg/full`), which
Tailwind v4's `--shadow-*` namespace auto-generates into a `shadow-card` utility class — both components
now use `shadow-card` instead of the raw bracket value. (`auth-shell.tsx`'s `shadow-[0px_12px_16px_
rgba(0,0,0,0.12)]` is a different value used only once, left alone — not "repetitive" yet.) **Verified
via a fresh production build**, not the dev server: `grep`'d the compiled CSS chunk and confirmed
`.shadow-card{--tw-shadow:var(--shadow-card);box-shadow:...}` compiles with the exact right value. The
already-running dev server (owned by another agent's session, reused rather than restarted) showed
`box-shadow: none` for a few checks — a known Turbopack dev-HMR staleness limitation for `@theme` block
changes (confirmed via `document.styleSheets` — no `.shadow-card` rule existed in the served dev CSS at
all, yet `--shadow-card` the *variable* resolved correctly, and the same build compiles the utility
correctly from a clean `.next`) — not a code defect, didn't restart someone else's server to chase it.
Gate green: lint/typecheck/build/18 unit tests.

## Frosted-glass topbar scroll scrim (2026-07-11, user request)
`AppShell` is not its own scroll container — the page/document scrolls, and `Topbar`/`Sidebar` are
`sticky`, not `fixed`, so the `p-2.5` gutter above them is normal flow, not fixed chrome. Once scrolled,
`main`'s own content was what showed in that gutter — a hard, unpolished edge. Fixed with a new
`pointer-events-none fixed` scrim in `app-shell.tsx` (blur + a `background`→transparent gradient, pinned
to the viewport top, `lg:left-[16.25rem]` to start exactly where `Topbar` does — math in the file's
header comment) so scrolled content fogs out before reaching the topbar instead of cutting off sharply.
`Topbar` itself went from opaque `bg-background` to a translucent `bg-card/80 backdrop-blur-md` glass
card so it reads as one continuous frosted surface with the scrim, not two different treatments stacked;
`Sidebar` got an explicit `z-30` (matching `Topbar`'s) so its stacking order relative to the scrim's
`z-20` is unambiguous. Verified live via computed-style + `getBoundingClientRect` probes (screenshot
tool still down this session): pixel-exact alignment (`scrim.left === topbar.left === 260px` at 1280px
width, `scrim.left === 0` below the `lg` breakpoint where the sidebar is hidden), `backdrop-filter:
blur(12px)` applied, correct gradient color in both light (`rgb(242,243,245)`) and dark
(`rgb(16,21,26)`) theme, no console errors. Gate green: lint/typecheck/build.

## Shared "parent card" page wrapper (2026-07-11, user request)
New `components/shared/page-card.tsx` (`PageCard`) — every module page's title (+ optional `actions`
slot, e.g. a date pill) and all of its child cards now sit inside one large card instead of the title
floating on the bare page background above independent cards. **Not a Figma-sourced pattern** — the
Dashboard frame's equivalent container node (`732:1714`) has no fill/shadow of its own, confirmed live
via the Figma plugin; reuses `DashboardCard`'s already-established chrome (`rounded-2xl bg-card` +
`shadow-[0px_0px_3px_rgba(0,0,0,0.1)]`) instead of inventing a new visual style. Wired into `/dashboard`
(title + `TodayDatePill` in the `actions` slot — `OverviewHeader` reduced to just that pill, `PageCard`
now owns the title row) and `/cattle` (title only). **Intended for every module page going forward** —
future pages should wrap their content in `PageCard` from the start rather than a bare `PageHeader` +
floating grid. Verified live via computed-style probes (light `rgb(255,255,255)` / dark card bg, 16px
radius, correct shadow, no console errors, no horizontal overflow at 375px) — this session's screenshot
tool was down, so no image capture, DOM/style verification used instead. Gate green: lint/typecheck/build.

## Dashboard / Morning Briefing (RFE-020 — done)
All 9 real widgets against the live `GET /dashboard/*` endpoints (the aspirational `Rakhal_API.md` §3
lists a 10th "activity-feed" widget the real backend doesn't implement — matched the real 9 instead,
per `dashboard.controller.ts`). New `features/dashboard/{types,api,hooks,components}` — types read
directly from `dashboard.service.ts`'s real return shapes; one `useQuery` per widget (`staleTime` 60s)
so each widget owns its own loading/error/empty/success state instead of a shared React ErrorBoundary
(the same fault isolation, no new error-handling pattern). Two chart widgets (`recharts` via
`next/dynamic`, the app's first real chart usage) for herd status (donut, 4 tabs) and livestock state
(bar). **Real bug caught before merge**: `sessions` on the production-summary widget was first typed
against the API doc's richer shape; cross-checking `MilkService#sessionStatuses` found the real shape is
a flat `session -> status` string map — fixed, confirmed against the real network response. New
`dashboard.*` i18n namespace (bn+en). **Verified live**: full render against the real backend, all
widgets with real data, light+dark, desktop+mobile, no console errors. Gate green. Full writeup:
`PROJECT_PROGRESS.md` RFE-020 entry.

**Pixel-exact layout pass (2026-07-11 follow-up)** — user flagged the layout didn't match the real
Figma "Dashboard" frame; pulled per-widget design context (metadata for the whole content area was
still too large, fetched each card individually) and rebuilt the grid to Figma's 3-per-row card rhythm.
New `dashboard-card.tsx` (shared card chrome, pixel-matched) + `period-select.tsx` (real dropdown,
replaces the old `Tabs`, now also wired to `LivestockStateChart` which previously had none). `KpiBar` →
2×2 icon-tile grid; `HerdStatusDonut` → single donut + legend (was 4 tabs; Figma's own legend is a
sex/age split — cows/heifers/bulls — this backend doesn't track, so kept the real `productionBreakdown`
categories instead of faking one); `LivestockStateChart` → hand-built horizontal bars (closer to Figma
than the recharts version, and the real `states` data lines up with Figma's rows exactly). **Three
Figma widgets have no real backing endpoint — not built as fakes**: "Financial Performance Over Time"
(12-month trend), "Production vs Feedcost", "Conception Rate" all need data outside the 9 real
`GET /dashboard/*` routes; those grid slots carry real widgets instead (`FinancialSnapshotCard`,
`PrioritiesPanel`, `CalvingForecastCard`, `FeedStockAlertsCard`) in the same new chrome. Gate green
(lint/typecheck/build) — **live browser verification not completed this session**: hit a tool-permission
outage, then a stale orphaned `next dev` process holding the dev-server lock (user-approved kill), then
the browser tool itself switched to the Chrome-extension path mid-session, which isn't connected here.
Flagged, not claimed as verified — owed on the next session with working browser tools.

## Subscription context + gating (RFE-008 — done)
`features/subscription/` (real `GET /subscription`, mirrors `features/profile/`'s pattern) +
`hooks/use-subscription-gates.ts` (`useHasFeature`/`useIsReadOnly`/`useIsEligibleForUpgradeAd`, mirrors
`lib/auth/permissions.tsx`'s `useCan()`). Drives three real pieces: `sidebar-nav.tsx`'s pre-existing
`premiumFlag` scaffold (Scoreboard) now actually locks (Lock icon, `/subscription` redirect, tooltip)
when a feature isn't in the farm's plan; `upgrade-ad.tsx`'s eligibility is real (usable status + missing
the Pro-only `reports.scheduled`) instead of hardcoded `true`; new `read-only-banner.tsx` (in
`app-shell.tsx`) mirrors the backend's own `SubscriptionGuard` for PAST_DUE/EXPIRED/CANCELLED/NONE.
**Backend gap**: `Rakhal_API.md` has no §31 subscription/plans section at all — verified live against
the real controllers instead. **Verified live, all 3 states** without touching the shared demo DB (real
ACTIVE+Pro data, then EXPIRED/Free and ACTIVE/Starter simulated via a temporary dev-only `queryClient`
window exposure, added/used/fully removed). Gate green. Full writeup: `docs/IN_FLIGHT.md`'s Recently
Done entry.

## CI + Lighthouse gate (RFE-010 — done)
`.github/workflows/ci.yml`: `checks` job (lint/typecheck/test/build, every push/PR) + `lighthouse` job
(`treosh/lighthouse-ci-action@v12` against `/` and `/login` per `lighthouserc.json` — perf ≥98,
a11y/BP/SEO =100, error-level, matching `ARCHITECTURE.md` §7). Handles the repo's Windows-path `.npmrc`
gotcha (`--store-dir ~/.pnpm-store` CLI override). **Scoped down from the ticket's AC, flagged not
guessed:** only the two backend-independent public routes are Lighthouse-audited — `/dashboard`/`/cattle`
and the Playwright e2e suite both need a live backend (a separate repo, `rakhal-backend`, with its own
Postgres/Redis + seed data) that this workflow doesn't stand up; that's real infra work for a follow-up,
not something to fake. PR-preview deploys skipped — hosting is still unconfirmed (see below). **Not
verified:** an actual GitHub Actions run — no Chrome available in this session's sandbox to dry-run
Lighthouse, so real scores are unconfirmed until the first push-triggered run. Full writeup:
`PROJECT_PROGRESS.md` RFE-010 entry.

## Testing harness (RFE-009 — done)
Playwright E2E layer built against RFE-006's real auth pages — the first pages with real logic to test.
`tests/e2e/utils.ts` (`loginViaUi()` drives the real multi-farm-picker login flow, `formLevelAlert()`,
a locale-pinning `en` fixture since the app defaults to `bn`), `tests/e2e/axe.ts`, `tests/e2e/auth.spec.ts`
(10 specs: login smoke, error mapping, register/forgot/reset/verify-email flows, protected-route redirect,
a11y). `playwright.config.ts` tuned (`workers:1`, `timeout:60_000`) after diagnosing that full parallelism
reliably timed out against `next dev`'s on-demand Turbopack compilation. **9/10 passing live against the
real dev backend**; the 10th is a genuine WCAG AA finding on `/login` (color-contrast on the `#00a86b`
brand green + missing `<main>` landmark) — left red on purpose rather than weakened, background task
spawned for the fix (owned by whoever picks up `app/globals.css`/`auth-shell.tsx` next). Gate green
(lint/typecheck/build/18 unit tests). RFE-010 (Lighthouse CI) can build on this Playwright setup.

## Auth pages (RFE-006 — done)
All 5 public auth pages built against the **real backend contract** (email+password + token-link email
verification/reset — not the PRD's aspirational phone/OTP flow, same gap RFE-003 already flagged):
`/login` (redesigned with real UI primitives, farm-picker for multi-farm accounts), `/register`
(→ "check your email"), `/forgot-password` (→ always-success, no enumeration), `/reset-password`
(`?token=`), `/verify-email` (`?token=`, auto-verifies on mount). Shared `AuthShell` (split branding+form
panel, built PRD-spec since no Figma auth frames exist) + a new `components/shared/locale-toggle.tsx`.
**Verified live end-to-end** against the real backend for every flow incl. error/invalid-token/missing-
token states, dark theme, and mobile. Gate green (lint/typecheck/build/18 unit tests).
**Found + fixed two live backend bugs while verifying** (backend `IN_FLIGHT.md`/`TECH_DEBT.md` have the
full writeup — not duplicated here): a Prisma enum gap that crashed the **entire backend process** on
every forgot-password request (migration `email_template_password_reset`), and a `proxy.ts` gap where
`/verify-email` wasn't in the public-paths allowlist (fixed in this repo). Filed **RD-034** for the
underlying systemic issue (event listeners with no error boundary) and spawned a background task for it.
Playwright E2E for these flows is deferred to whichever ticket builds the harness (RFE-009, not started).

**Pixel-exact visual pass (2026-07-10)** — Figma access landed (official plugin, user OAuth'd). Rebuilt
all 5 auth pages against the real "Sign In"/"Sign Up"/"Reset Password"/"Set New Password" Figma frames
(file `SCfMPdxP6vgW1uTxfqCtz7`): `AuthShell` form panel moved to the **left** (Figma order — was right),
exact 453px card chrome, new `components/ui/floating-input.tsx` (floating-label inputs), real hero
photo/wordmark downloaded to `public/auth/**` (Figma asset URLs expire in 7 days), a `confirmPassword`
field added to reset-password to match Figma's two-field layout. **Confirmed the real brand primary is
`#00A86B`/`#00774C`** — swapped app-wide in `app/globals.css` (was the RFE-002 eye-sampled `#16a34a`). No
Figma frame exists for verify-email (prototype uses OTP, this backend doesn't) — left on shared chrome
only. Full writeup: `PROJECT_PROGRESS.md` RFE-006 entry + `DESIGN_SYSTEM.md` §4. **Verified live**:
light/dark theme × bn/en locale × desktop (1280px)/mobile (375px), no console errors. Gate green
(lint/typecheck/build/18 unit tests).

## Profile & session self-service (RFE-007 — done, rescoped)
Real `/profile` page wired to the actual backend, not `Rakhal_API.md`'s aspirational shape — verified
against `auth.controller.ts` directly. **Backend gap found:** `PATCH /auth/me` (generic), `PATCH
/auth/me/on-duty`, `PATCH /auth/me/pin`, and `POST /auth/switch-organization` don't exist server-side at
all (zero matches grepping `src/`); only `PATCH /auth/me/language` is real, alongside `GET /auth/me`,
`GET /auth/sessions`, `DELETE /auth/sessions/:id`, `POST /auth/logout-all`. Built: account-info card,
a language card that persists to the backend and flips the local UI-locale cookie together, and a
sessions card (list/revoke/logout-all, current-device badge from the session's JWT `sessionId`).
Logout-all needed a new bespoke `/api/auth/logout-all` BFF route (CSRF+cookie dance, mirrors
`/api/auth/logout`) since it needs `CsrfGuard` and the generic `/api/backend` proxy doesn't attach CSRF
tokens. The shell's on-duty switch (`user-menu.tsx`) stays disabled — there is genuinely nothing to wire
it to. Gate green (lint/typecheck/build/test); **live browser smoke test not done this session** — RFE-006
held the Next.js dev-server lock on this tree throughout, so verification is still owed once that frees up.

## App shell (RFE-005 — done)
`(app)/layout.tsx` now wraps every authenticated route in a real `AppShell` (`components/layout/**`):
desktop fixed Sidebar (OrgSwitcher + 15-item module nav + Upgrade banner) that becomes a Sheet-based
mobile drawer via the topbar's hamburger button, Topbar (⌘K search palette placeholder, notification
bell placeholder, theme toggle, avatar menu with on-duty switch/profile/settings/language-toggle/logout).
All 18 module route folders got a stub `page.tsx` + `loading.tsx` + `error.tsx`; root + in-shell
`not-found.tsx`. **Verified live** against the real backend: login → farm picker → dashboard inside the
real shell → navigated into `/cattle` (stub renders) → dark theme toggle → resized to mobile, opened the
Sheet nav, closed it — no console errors anywhere. **OrgSwitcher is read-only for now** — flagged, not
guessed: the backend only returns the farm list during the login bootstrap step, there's no confirmed
"list my farms while logged in" GET endpoint (only `POST /auth/switch-organization`, which needs an id we
don't have post-login). **Local-dev gotcha found while verifying:** `rakhal-backend`'s `.env` now has
`PORT=5000`, not the `3000` every doc (including `.env.example`) still assumes — this repo's `.env`
`API_BASE_URL` was pointed at `:5000` to match; someone should reconcile the backend docs/env.

**Pixel-exact visual pass (2026-07-10)** — pulled the real Figma "Dashboard" frame's Navbar (`732:1659`)
and topbar (`732:1695`) and rebuilt `AppShell`: sidebar + topbar are now two separate floating rounded
cards on a shared page gutter (was flush full-bleed). Dark-green sidebar pixel-confirmed `#055640`
(was eye-sampled `#0b5137`), white pill `OrgSwitcher`, MENU/OTHERS nav sections (`nav-items.ts` gained a
`section` field — the Figma prototype only pictures 9 of our 15 modules, Buyers/Reproduction/Calves/
Reports slotted into MENU rather than dropped), pill active-state, white circular topbar icon buttons.
**Also fixed the RFE-009-flagged WCAG AA contrast finding**: swapped `text-primary` (3.23:1, fails) to
`text-primary-hover` (5.53:1, passes — matches Figma's own text-vs-button color split) on auth link text,
and added the missing `<main>` landmark to `AuthShell`. Verified live: full login flow, light/dark,
desktop/mobile incl. Sheet nav, route navigation with correct active-state, no console errors. Gate green.
Full writeup: `PROJECT_PROGRESS.md` RFE-005 entry + `DESIGN_SYSTEM.md` §4.

**Sidebar/topbar UX pass (2026-07-10, user design feedback)** — grouped the flat 15-item nav into 7
task-oriented sections (Overview/Herd Management/Production/Business/Insights/Workspace/System,
`nav-items.ts`); `OrgSwitcher` now shows the real farm name/slug via a new `features/farm/` (`GET
/farms`, matched by JWT `farmId`) instead of the old bug of displaying the *user's* name; active nav is
now a soft `bg-primary/25` fill + left accent bar (was a strong white pill); `UpgradeBanner` replaced by
`UpgradeAd` — a periodic slide-up-from-bottom ad (`motion/react`) on a local-constant cadence
(`upgrade-ad-config.ts`, real cadence/eligibility still needs RFE-008's `GET /subscription`), with a new
persistent sidebar account row (`UserMenu` gained a `sidebar` variant) as its resting state; topbar search
placeholder + OS-aware `Ctrl K`/`⌘ K` hint, bigger tooltipped notification/theme/profile controls (new
`TooltipProvider`). Verified live end-to-end incl. bn locale, dark theme, mobile Sheet. Gate green
(lint/typecheck/build/18 unit tests/10 e2e). Full writeup: `docs/IN_FLIGHT.md`'s Recently Done entry.

**Collapsible sidebar groups (2026-07-10 follow-up)** — the 7 groups above are now independently
collapsible (any subset at once, not an accordion): `sidebar-nav.tsx` group headers are real
`aria-expanded` buttons, state persists in `localStorage` via `useSyncExternalStore`, collapsed groups
get `inert` (removed from tab order + a11y tree, not just visually shrunk), the active route's group
auto-expands once on mount. Uses a plain CSS `grid-template-rows` collapse, not `motion/react` —
`AnimatePresence`+`height:"auto"` was tried first but never completed its exit animation in this
session's preview tool (root-caused as likely rAF throttling on a backgrounded tab, not a logic bug).
Gate green. Full writeup: `docs/IN_FLIGHT.md`'s Recently Done entry.

**Duplicate account menu removed (2026-07-10 follow-up)** — the sidebar-footer `UserMenu` variant
added above (as the upgrade ad's resting state) duplicated the topbar's account menu; user flagged it.
Kept the topbar one only (conventional, always-visible location); `UserMenu`'s `variant` prop is gone,
back to a single implementation. `UpgradeAd` now anchors directly to the sidebar's own bottom edge
(`inset-x-4 bottom-4`) instead of overlaying a removed account row. Gate green.

## UI primitives + shared composites (RFE-004 — done)
Full `components/ui/**` inventory built on top of the existing `button.tsx`: Input, Textarea, Label,
Select, Checkbox, RadioGroup, Switch, Dialog, Sheet, DropdownMenu, Popover, Tooltip, Tabs, Badge, Card,
Table, Avatar, Progress, Separator, Skeleton, Calendar (`react-day-picker`), Combobox, Command (`cmdk`),
and a `sonner` `Toaster` (now the single source of truth — replaced the inline `ThemedToaster` that used
to live in `providers/app-providers.tsx`, which also now wires `NuqsAdapter` since FilterBar/DataTable need
it). All semantic-token-only, no raw hex. `components/shared/**`: DataTable (TanStack Table, cursor "load
more" pagination, URL-synced single-column sort via nuqs, row selection for bulk ops, mobile
card-collapse, all 4 states), PageHeader, StatCard, ChartCard, EmptyState/ErrorState/TableSkeleton/
CardSkeleton, ConfirmDialog, FilterBar (300ms-debounced search + select filters, URL-synced), FileUpload
(drag/drop, type/size validation, image preview, upload progress), FormDialog/FormSheet (dialog/sheet
chrome only — the caller owns its own RHF+zod form), MoneyText/DateText (locale-aware, wrap
`lib/format.ts`), CattlePicker (search-select over `GET /cattle`). 11 component tests (DataTable,
FormDialog, FilterBar) all green using `nuqs/adapters/testing`. **Axe/Lighthouse checks deferred** — no
real pages or Playwright e2e harness exist yet to run them against meaningfully (RFE-005/009 build those);
flagged rather than faked. Gate green: lint (0 errors, 1 known non-blocking TanStack-Table React-Compiler
warning) / typecheck / test / build all pass.

## Auth / API / session layer (RFE-003 — done)
Full BFF auth flow **verified live in the browser against the real running backend**: login (bootstrap
farmId → farm picker, demo owner has 5 farms) → farm select → httpOnly session cookies on our own domain
(`rk_at`/`rk_rt`/`rk_user`, never the backend's tokens directly) → `/dashboard` renders real session data
+ a real backend fetch → logout → gate redirects to `/login` again. See `lib/auth/session.ts`,
`lib/auth/refresh-core.ts` (shared by `next/headers`-based Route Handlers and `proxy.ts`'s
`NextRequest`/`NextResponse` cookies — different APIs, same HTTP logic), `lib/api/client.ts` (client fetch
→ generic `/api/backend/[...path]` proxy) + `lib/api/server-fetch.ts` (RSC direct-to-backend fetch).
**Real backend contract differs from the cross-repo template docs** — flat error envelope, no per-field
validation `details[]`, cursor meta shape — all documented in `types/api.ts`'s header comment and
PROJECT_PROGRESS.md's RFE-003 entry. **Both backend gaps found here are now fixed (2026-07-10, RAKHAL-259/260,
fixed directly in `rakhal-backend` this session):** `GET /auth/me` no longer leaks `passwordHash`, and now
returns a real `permissions: string[]`. `<Can/>`/`useCan()` consume it via `/api/auth/session` →
`serverFetch('/auth/me')` — **verified live** as `["*"]` for the demo owner.

## Marketing landing page (RFE-100 — done)
`/` now serves a full cinematic landing page (`app/(landing-page)/**`): hero w/ floating glass cards,
animated counters (placeholder numbers — TODO wire to a public stats endpoint), problem/solution story,
7-feature showcase w/ sticky rail, onboarding steps, dark parallax dashboard preview, testimonials,
pricing (TODO source from `GET /plans`), native-`<details>` FAQ + FAQPage JSON-LD, final CTA, footer.
Server Components + thin `motion` client wrappers; bn/en copy complete; reduced-motion safe.
Domain plan: `rakhal.app`=landing · `farm.rakhal.app`=consumer app (host rewrites in `proxy.ts` later) ·
`admin.rakhal.app`=separate project. `/login` + `/register` are placeholders until RFE-006.

## Where things stand
- Repo bootstrapped per `ARCHITECTURE.md` §3: `features/`, `components/{ui,shared,layout}/`, `lib/`,
  `i18n/`, `providers/`, `types/`, `tests/` all created; full RFE-001 dependency set installed.
- **Design tokens + theme + fonts + i18n are live** (RFE-002 done): `app/globals.css` has the full semantic
  token set (light + derived dark), `next-themes` toggle works, `Noto_Sans_Bengali`/`Plus_Jakarta_Sans`
  fonts render correctly, `next-intl` serves `bn` (default) and `en` via a cookie (no URL routing — see
  DESIGN_SYSTEM.md §4). All 4 combinations (light/dark × bn/en) verified live via preview screenshots.
- Full plan + ticket board: [`PROJECT_PROGRESS.md`](PROJECT_PROGRESS.md) (RFE-001…093).
- Engineering rules: [`ARCHITECTURE.md`](ARCHITECTURE.md) (distilled from `D:\Projects\Templates\` docs 02+04).
- Design: [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) — 75 UI screenshots analyzed in
  `D:\Projects\Rakhal\docs\rakhal-ui-analysis.md`; token values still eye-sampled (not pixel-picked Figma).
- Backend: ready & ~64% MVP-complete at `Repos/rakhal-backend` — all pages in Phases 1–3 have live endpoints
  (Swagger `/api/docs`). Known not-built: milk quality (V1.5), report schedules (V1.5), feed mixtures, mobile sync.

## Next task
Phase 0 is fully done (RFE-001…010). Phase 1 has started: RFE-020 (Dashboard) and RFE-021 (Cattle list)
are done. Remaining Phase 1 daily-driver pages are open, parallel lanes per `PROJECT_PROGRESS.md`:
RFE-022/023/024 (cattle add/edit, detail, CSV import — all depend on RFE-021's feature folder),
RFE-025/026 (milk/buyers), RFE-027 (task hub), RFE-030/031/032/033 (reproduction/healthcare/calves),
RFE-034/035 (inventory/finance), RFE-040/041 (feed formulator/reports). RFE-040's list page + create
wizard (list `1048:33190`, wizard `1065:35227`/`1065:35817`) are now built and live-verified — see
`PROJECT_PROGRESS.md`'s RFE-040 entry for what's covered vs still open (ingredients-table/feed-group
management UI, no Figma frames yet). Real follow-ups flagged (not
started): a CI backend service (Postgres/Redis/seed + cross-repo `rakhal-backend` checkout) so RFE-010's
Lighthouse gate can cover authenticated routes and RFE-009's Playwright suite can run in CI, not just
locally against a manually-started dev backend. Live browser verification of RFE-007 and RFE-021 is
still owed — this session's browser tool couldn't get past the demo owner's 11-farm "select farm" login
step (see `IN_FLIGHT.md`'s RFE-021 entry); verified instead via `curl` against the real backend.

## Known environment issue (this machine — not a code problem)
The shared pnpm store (`D:\.pnpm-store\v10`) has a permission-corrupted file — even `icacls`/`Remove-Item`
as the owning user get **Access Denied**, and it broke hard-linked files inside `node_modules` the same way.
**Workaround in place, do not revert:** this repo's `.npmrc` pins `store-dir=D:/.pnpm-store-rakhal-fe`, a
fresh unaffected store. The original corrupted `node_modules` was renamed (not deleted, couldn't be) to
`node_modules.broken/` — it's gitignored and excluded from `vitest.config.ts`'s test glob; leave it alone,
an admin can `takeown`/delete it later. `pnpm install`/`pnpm add` both work normally now via the new store.

**Port 3001 is permanently occupied by an unrelated project on this machine** (`D:\gcb\gcpay\repos\
gcpay-admin`, a different Next.js app entirely — confirmed via its process command line). `pnpm dev`'s
default `-p 3001` and `playwright.config.ts`'s `webServer` (hardcoded `url: "http://localhost:3001"`,
`reuseExistingServer: true` locally) will silently attach to *that* app instead of this one, producing
nonsense e2e failures that look like real regressions but aren't. **Workaround**: run e2e with
`NEXT_PUBLIC_APP_URL` pointed at whatever port this repo's real dev server is actually on (check with
`curl`/branding, not just "something responds") — found while verifying RFE-008, see
`docs/IN_FLIGHT.md`'s entry for the full trace. Not fixed at the config level (affects every agent,
needs a considered port strategy, not this ticket's call to make unilaterally).

## Blocked / decisions needed
- ~~Figma token extraction~~ **resolved 2026-07-09** — screenshots analyzed; token values are in
  `app/globals.css` now (approximate, pending pixel-confirmation against real Figma access).
- Hosting target (Vercel assumed for PR previews; confirm before RFE-010).
- ~~Bangla numerals vs Latin digits~~ **resolved 2026-07-09** — Latin digits in both locales, lakh money
  grouping in both locales (see DESIGN_SYSTEM.md §4, `lib/format.ts`).
- ~~Locale default/switching~~ **resolved 2026-07-09** — `bn` default, easy topbar switch to `en` (product
  decision); cookie-based (`NEXT_LOCALE`), no URL locale prefix (this is an authenticated app).
- Exact font family match to Figma unconfirmed (ui-analysis.md Q-21) — using Plus Jakarta Sans + Noto Sans
  Bengali as the closest visual match by eye; swap if Figma disagrees.

## Env
Dev backend must run for any data work: Docker Desktop → `rakhal-postgres` + `rakhal-redis` →
`pnpm start:dev` + `pnpm seed` in `Repos/rakhal-backend`. Demo: owner@demo.rakhal.test / DemoPass123,
worker@demo.rakhal.test / WorkerPass123. Swagger: http://localhost:3000/api/docs.
Frontend dev server: `pnpm dev` → `http://localhost:3001` (backend stays on 3000).
