# Frontend — Current State

## RFE-143 shipped: protocol sheet, Care steps tab removed (2026-10-02)
A protocol card opens a sheet - *Due now* (record / reschedule / skip this protocol's steps), *Animals* (paged), *Steps*, *Results*. The Care steps (Schedule) tab and the Sick Bay Preventive rounds view are gone; the Healthcare page is now **Sick Bay | Protocols | Insights**. Old `?healthTab=schedule` links open Protocols. Backend sliver: reminder links point at Protocols. Gate: frontend typecheck 0, eslint 0, vitest `features/health` 142/142, `pnpm build` 0; backend: tsc 0, eslint 0, jest `health-reminder.service.spec` 14/14, e2e `health-reminders` 9/9. **Not checked live in the browser or at 375px** (the Browser pane has stayed hidden, so the page never hydrates) - render-tested only. MILESTONE 29c is complete. Details: workspace `docs/EPIC_HEALTH_CENTER.md` §12.9.

## RFE-142 shipped: Protocols tab shows what each protocol is doing (2026-10-02)
One card per protocol with live state (animals in progress, steps overdue / due today or the next due day, results), **Apply** first, steps collapsed. Switch **In use | All protocols**; kind / condition / search filter on the server; numbered pager. A deleted protocol with animals still on it stays in In use, flagged. Needed a tiny backend addition, `GET /health/plans?kind=`. Gate: typecheck 0, eslint 0, vitest `features/health` 114/114, `pnpm build` 0; backend sliver: tsc 0, eslint 0 errors, e2e `health-plan-runs` + `health-plan-stats` 43/43. **Not checked live in the browser or at 375px** (the Browser pane was hidden and the session had expired) - render-tested only. Next: RFE-143 (protocol sheet, remove the Care steps tab). Details: workspace `docs/EPIC_HEALTH_CENTER.md` §12.8.

## RAKHAL-470 shipped (backend half of MILESTONE 29c) (2026-10-02)
The routes RFE-142 / RFE-143 build on are live: `GET /health/plans?inUse=` + `stats.stepsDue / stepsOverdue / nextDueDate`, `GET /health/plans/:id/runs`, `GET /health/tasks` filters (`healthPlanId`, `statuses`, `noPlan`, `dueTo`, `sortBy=due`; rows include `healthPlan` / `healthCase`), and sick-bay rows carry `withdrawalDaysLeft` (the web Sick Bay still reads the capped withdrawals list - switch it in RFE-142/143). Details: workspace `docs/EPIC_HEALTH_CENTER.md` §12.7.

## RFE-140 + RFE-141 shipped: Healthcare page simplified (2026-10-02)
The page opens on a one-row stat strip and the Management Center. The attention strip (overdue / due today / withdrawals ending), the Schedule calendar, and the three cards on top are gone; trend + outcomes are the new **Insights** tab. Tabs: Sick Bay / Care steps / Protocols / Insights. The Sick Bay tab shows one paged list at a time: Under treatment, Milk/meat withheld, Preventive rounds (`?view=`). Old reminder links with `&date=` still land on the right bucket. Gate: typecheck 0, eslint 0, vitest `features/health` 93/93, `pnpm build` 0. **Not checked live in the browser or at 375px** (the Browser pane was not available) - render-tested only. Next: RAKHAL-470, then RFE-142 / RFE-143 (merge Care steps into Protocols). Details: workspace `docs/EPIC_HEALTH_CENTER.md` §12.

## RFE-139 shipped: Report Sickness "Several animals" (2026-10-02)
The Report Sickness sheet has a "One animal | Several animals" switch. Several animals: pick by shed, group or search (select all, up to 100), choose one condition and priority, and report them in one go (`POST /health/cases/bulk`). A result card shows the cases opened and the animals skipped because they already had an open case, and offers one protocol for all the new cases. Gate: typecheck 0, eslint 0, vitest 73/73 for health, `pnpm build` 0. **Not checked live in the browser or at 375px** (pane hidden); render-tested in en. Details: workspace `docs/EPIC_HEALTH_CENTER.md` §11.

## RFE-134 shipped (MILESTONE 29): Health Management Center toolbar, attention strip, Sick Bay reshaped (2026-10-02)
The toolbar is two buttons (Report sickness, Record treatment). An attention strip above the tabs shows overdue steps, steps due today and animals whose withdrawal ends within 3 days, each a link into the filtered view. Sick Bay now reads Animal / Condition / Protocol / Next step / Withdrawal / Priority / Day N, with an "Apply protocol" button where no protocol is set, and each case is a card below `md`. Gate: typecheck 0, eslint 0, vitest 60/60 for health, `pnpm build` 0. **Not checked live in the browser or at 375px** (pane hidden); render-tested in en + bn. Details: workspace `docs/EPIC_HEALTH_CENTER.md` §11. Remaining in MILESTONE 29: optional RAKHAL-469.

## RFE-136 shipped (MILESTONE 29): the Protocols tab shows what each protocol achieves (2026-10-02)
Kind filter + condition filter, live result tiles on every card (recovery rate / coverage / steps due, from `GET /health/plans` `stats`), a condition chip, and an **apply preview** with the real dates, milk / meat withdrawal dates and the reminder line. The applied protocol shows as one chip on Sick Bay rows, preventive rounds and the cow's Health tab. The create/edit form has an optional Condition (treatment protocols), and the protocol picker used by Report Sickness, the case Overview and Sick Bay's "Apply protocol" lists condition-matched protocols first ("Suggested"). Live-checked (bn, desktop); not checked on a phone, in `en`, or as a worker. Gate: typecheck 0, eslint 0, vitest 45/45 for health + cattle, `pnpm build` 0. Details: `docs/EPIC_HEALTH_CENTER.md` §11 (workspace). Remaining in MILESTONE 29: RFE-134, optional RAKHAL-469.

## Reproduction: taller Attention/Protocols pair + Cow List pagination (2026-09-30, no ticket #)

User: the Attention + Protocols pair was too short to show a useful amount, and the Cow List needed pagination. The pair
now has `min-h-[34rem]` (544px measured, was 400) and Attention pages 8 rows by default (8/16/24/48) so a real working set
fits. The **Cow List** replaced "Load more" with numbered pages on the same keyset cursor (`useCursorPager` +
`Pagination`, 10/20/50/100 per page, always shown); the status chips reset to page 1. Live-checked at 1440: page 2 ≠ page 1,
pager grows 1→2→3, Pregnant filter returns only pregnant cows on page 1. `useReproductionCows` (infinite query) is now unused
by the page. Gate: `typecheck` 0, eslint 0 errors, vitest 224/224. Not run: `pnpm build`; not re-checked on a phone (only
a min-height and a pager changed).

## Reproduction: Needs-attention + Protocols cards — always-on pagination (2026-09-30, no ticket #)

User: these two cards also need pagination. Attention already paged 5 rows but hid the pager when everything fit one
page, and Protocols used "Load more" with no paging on the library. Now both always show the shared `Pagination`
(page jump + rows-per-page) pinned to the card bottom. **Attention:** 5/10/20/50 per page, reset on tab change.
**Protocols:** *Active* (running + scheduled — a bounded set, every page is fetched then paged client-side, 5/10/20/50);
*Completed / Cancelled / Failed / All* (history, unbounded) use the real server cursor via `useCursorPager` on
`GET /reproduction/protocols/instances`, same as the events feed; the *library* pages 2/4/6 template cards. "Load more"
is gone. Live-checked at 1440 (pair heights 400/400; Completed tab and All tab page from the server; library page 1 = 2 cards,
page 2 = 1 card) and 375 (no overflow). Known trade-off: the Protocols card's height changes between a full and a short
library page (708 → 506) and the Attention card stretches with it. Gate: `typecheck` 0, eslint 0 errors, vitest 224/224.
Not run: `pnpm build`; not exercised: paging past page 2 of a server tab (dev data has ≤2 instances per tab).

## Reproduction page — regrouped layout, related cards side by side (2026-09-30, no ticket #)

User: keep the Cow List full width, but the other sections were needlessly wide — pair related ones and match their
layouts. The page now reads **Overview → Do now → Herd → Timeline**: KPIs; **Attention | Protocols** (cows awaiting their
next step / cows on a synchronisation protocol); **Cow List** full row (7-column table); **Events | Calving Forecast**
(what happened / what is coming). Each pair is a `minmax(0,1.35fr) / minmax(0,1fr)` grid from 56rem of page width
(stacked below), stretched to equal height, every card fills its cell with its pager pinned to the bottom. To keep the
pairs balanced: Events defaults to 5 rows per page (5/10/20/50) with its detail chips on ONE clipped line (rows a uniform
66px instead of 66–118px), and the Forecast pages 8 at a time. Events filter row: pickers flex but are capped (cow 15rem,
dates 10rem), inline from 28rem of card width (folds behind "Filters" below that — at 1280 the events card is ~532px, so
it stays inline). Measured: 1440 → 334/334 and 770/770; 1280 → 418/418 and 790/790 (filters on one row, no toggle);
1024 and 375 stacked, no horizontal overflow. `Forecast` blank space under a short list is expected (card stretches
to its partner). Gate: `typecheck` 0, eslint 0 errors, vitest 224/224 (see below for the re-run). Not run: `pnpm build`.

## Reproduction events feed — real pagination + better filters (2026-09-30, no ticket #)

**Follow-up same day:** user did not want the quick-range chips (Any time / 7 / 30 / 90 days / This year) or the
Newest/Oldest sort chips, and found the cow and date pickers far too big. Both chip rows removed (sort is no longer a
UI control; the API still supports `sortOrder`). Pickers are now compact: 36px high, cow 15rem, each date 10rem on
one wrapping row; on a phone the cow is full width and the two dates sit side by side. Measured 1440px: 240×36 and
160×36 (were ~600×44); 375px: no overflow. The `range.any/d7/d30/d90/year` and `sort.*` i18n keys are now unused.

User: the events section needs pagination and better filter UX. The feed was a client-side pager over ONE fetch
capped at the newest 100 (the endpoint ignored `cursor`), so older events were unreachable. **Backend twin**: `GET
/reproduction/events` now takes a real keyset cursor over the merged five-table stream (see the backend board).
Frontend moved to the standard `useCursorPager` + `Pagination` (page size 10/20/50/100, always shown when there are
rows). **Filters in three tiers:** the event-type chips stay one tap away; cow + date range (quick chips: Any time /
7 / 30 / 90 days / This year, plus custom from–to) + sort (newest/oldest first, now honoured by the server) sit in a panel
that is open on a wide card and behind a "Filters (n)" button on a narrow one; everything applied shows as removable
chips ("Applied: Heat · Bina · 1 Sep – 30 Sep") with Clear all, and an empty-filtered result offers Clear filters.
Also fixed: a "to" date sent as bare `YYYY-MM-DD` excluded that whole day's events — now the local day's real start/end
instants go to the API. Live-verified against the running backend in bn at 1440 + 375: page 2 ≠ page 1, type chip,
30-day range, oldest-first, applied chips, collapsed-by-default panel on a phone with badge count, no overflow.
The cattle-detail Reproduction tab still uses the old one-shot `useReproductionEvents` (still valid). Gate: `typecheck`
0, eslint 0 errors, vitest 224/224. Not run: `pnpm build`; not exercised: editing a row from page 2+.

## Reproduction: attention + forecast cards — equal height, pagination (2026-09-30, no ticket #)

User: the two cards' heights didn't match and a long "needs attention" list needed pagination. Both cards now page
5 rows at a time with the shared `Pagination` (client-side; the dashboard returns every row), the grid stretches so
heights match (verified 488px/488px and 520px/520px across pages), rows share a 60px min height, and the pager is
pinned to the card bottom. `ATTENTION_PAGE_SIZE` is exported from `reproduction-action-panels.tsx` and reused by the
forecast. Verified with a patched dashboard response (13 ready-for-AI cows → 3 pages, next works); the real dev
data only has 2. Gate: typecheck 0, eslint 0, vitest 224/224 (one transient failure on the first run, green on rerun).

## Reproductive Protocols section — UX redesign (2026-09-30, no ticket #)

User: the section "is not good enough, there are ux issues". Frontend-only. Root problems found and fixed:
(1) a protocol applied with a **future start date is `SCHEDULED`**, but the default "In Progress" tab never listed
it — new **Active** tab merges `IN_PROGRESS` + `SCHEDULED` (two list calls, the endpoint takes one status);
(2) rows said "Day 0" for every cow (`current_step_day` is the first step's day and never advances) — now a real
"Day 7 of 10" + progress bar from `start_date` and the template's `duration_days`, "Starts in N days" for scheduled;
(3) three equal-weight buttons per row, "Cancel/Fail" beside the primary action — now ONE next-step button
(Record AI → Record outcome) + a ⋯ menu (Timeline, Cancel/Fail, permission-gated); (4) templates and live work were
one long card — now two views, **Cows on protocol** (default) and **Protocol library**; (5) library cards were
`role="button"` with nested edit/delete (a11y) and gave no hint they were clickable, plus "0 applied / —% conception"
pills — now a stat strip, explicit "View steps" + one-tap **Apply** (Apply dialog gained an optional
`defaultProtocolId`), Edit/Delete in a ⋯ menu; the null conception rate shows "—" (or is hidden in the steps sheet).
Library auto-loads every template page (no "Load more"). Live-checked in bn at 1280 + 375 (no overflow): views,
chips, menu items, Apply preselect, steps sheet. Not exercised live: submitting Apply/Record AI/Cancel, and a
SCHEDULED row (no such data; the merge logic is unit-simple but untested). Gate: `typecheck` 0, eslint 0, vitest 224/224.

## Reproduction page — full UI/UX redesign + fluid responsive (2026-09-30, no ticket #)

User: the page's UI/UX was poor; redesign it fully and make it fluid-responsive. Frontend-only, no backend
change, dialogs untouched. The five header buttons became one "Record event" menu (each item permission-gated;
per-cow buttons stay the fast path). The five "cows needing action" cards became one tabbed panel with a count
badge per tab (opens on the first non-empty list, "Show N more" past 5 rows). Calving forecast is a date-tile
list tinted by urgency ("in 4 days" / overdue). The cow list has server-side status chips (`?status=`), a table
from `@3xl` and per-cow cards below it, plus a gestation progress bar. The events feed groups by day (Today /
Yesterday / date) with detail chips and a scrollable event-type chip strip. Protocol cards/instance rows wrap.
**Fluid without viewport breakpoints:** every card is an `@container` (Tailwind v4 container queries), KPI
tiles are `auto-fit`, padding/gaps use `clamp()`. New: `reproduction-cow-identity.tsx`. Verified live at 375 /
768 / 1280 (no horizontal overflow, table↔cards switch), bn + en (plural strings), menu → sheet → close
restores pointer events. Gate: `typecheck` 0, eslint 0 errors, vitest 224/224. Not run: `pnpm build`.

## Feeding Grid — one table for every cow (2026-09-25, no ticket #)

User: applying a feed plan showed a second, differently-shaped table; "i want only one table". The grid is
now a single table where each cow is a row of feed lines — plan lines pre-filled and editable, a TMR /
concentrate as one line, or anything added by hand — with program groups as divider rows, one bulk toolbar
and one Save/Confirm bar. Every kg input is capped to remaining inventory (shared across ticked cows).
Frontend-only; same `POST /feed/grid/{draft,confirm}` multi-line payload. `program-section.tsx` deleted,
logic split into `features/feeding/grid-model.ts` (pure, 16 tests), `hooks/use-source-stock.ts`,
`components/{feed-line-cell,feed-source-picker}.tsx`. Full writeup: `docs/IN_FLIGHT.md` Recently Done.

## RFE-043 follow-up — Notification preferences: in-app only for now (2026-09-21)

User: "avoid the sms for now we just working with notifications in app." RFE-043 (shipped earlier
today by a concurrent agent) had per-event channel checkboxes for push/sms/whatsapp/telegram/email,
none of which are actually reachable from this web app yet (no provider for sms/whatsapp/email;
telegram needs a bot token + an unbuilt linking flow; push has a real FCM provider but the frontend
never registers a device token). Emptied the checkbox list — an enabled event now shows an
"In-app only for now" note instead. No backend/data change. Gate green; verified via direct `fetch()`
since `/settings` hits this board's own documented Suspense-stuck harness quirk. Full writeup:
`docs/PROJECT_PROGRESS.md`'s RFE-043 entry, `docs/IN_FLIGHT.md` Recently Done.

## RFE-119 — Feeding Grid: confirmed vs carried-over, real user bug (2026-09-20)

User-reported bug (screenshot attached): fed a cow yesterday, didn't feed her today, grid still
showed the identical "1kg" with no way to tell whether today's feeding had actually happened. Backend
twin RAKHAL-440/RD-099 added exact-date-scoped `confirmed_offered_kg`. Each grid row now shows one of
3 distinct states (green "Confirmed", blue "Draft", amber "Carried over" with an explanatory tooltip)
instead of one undifferentiated quantity cell, plus a matching colored border on the input itself.
User chose to keep the row editable even once confirmed. Live-verified against 92 real carried-over
cows on the shared demo farm. **New debt found while verifying, not fixed**: RD-100 — `confirm()`'s
whole-grid fallback scope means a "Confirm (1)" click can silently sweep far more cows than its own
count implies. Full writeup: `docs/PROJECT_PROGRESS.md`'s RFE-119 entry, `docs/IN_FLIGHT.md` Recently
Done, backend `docs/TECH_DEBT.md` RD-099/RD-100.

## RFE-044 — Global search (⌘K) wired to real results (2026-09-20)

Backend (`GET /search?q=`, RAKHAL-257) was already fully built — farm-scoped Postgres trigram search
across cattle/tasks/suppliers/buyers/sheds/medicines. RFE-005 had already shipped the topbar
trigger + ⌘K/Ctrl-K toggle + an empty `CommandDialog`; this ticket wired the missing half. New
`features/search/{types.ts,api.ts,hooks/use-search.ts}`; `GlobalSearch` now renders one
`CommandGroup` per non-empty category and navigates via `router.push(hit.link)` on select. Widened
`components/ui/command.tsx`'s `CommandDialog` with an optional `shouldFilter` passthrough (additive,
only this one caller uses it) so results stay server-scored instead of being re-filtered client-side
by cmdk's own fuzzy matcher. Live-verified: real query → grouped results → selecting one navigates to
the exact backend-provided link. Full writeup: `docs/PROJECT_PROGRESS.md`'s RFE-044 entry,
`docs/IN_FLIGHT.md` Recently Done.

## RFE-117 — Tier 0 search wiring, closes MILESTONE 25 (2026-09-20)

**MILESTONE 25 (Feeding Favourites) fully closed, backend + frontend.** Last ticket: both the
Feeding Grid toolbar's item picker and RFE-115's per-row `RowSourceCell` were capped at page 1 (20
items) and filtered client-side — a farm with 21+ feed items couldn't reach item #21. Both now use
real server-side search (`useFeedItemPagedList({ search })`); the per-row picker's search fetch is
split into a separate component that only mounts (and only fetches) while that row's popover is
open, since the grid can run to thousands of cow rows and can't fire a live search per row
unconditionally. Found and fixed a real regression along the way: once a picker's fetch depends on
search text, an already-picked item can drop off the visible page — both trigger labels now resolve
via `useFeedItemDetail(id)` (precise, deduped) instead of trusting a possibly-stale page. Live-
verified: a deep-catalog item (well past page 1) is now searchable and selectable, trigger shows its
real name; only ~31 detail requests fired across a 1900+-row grid, not one per row. Full writeup:
`docs/PROJECT_PROGRESS.md`'s MILESTONE 25 section, `docs/IN_FLIGHT.md` Recently Done.

## RFE-116 — Feed Group settings: default-feed-source field (2026-09-20)

MILESTONE 25 (Feeding Favourites) frontend twin, follows RFE-115. `GroupRow` on `/feeding`'s Feed
Groups section gains a second "Default feeding source" Select beside the existing "Default ration"
one — mirrors that control's exact shape and PATCHes the same `/settings/feed-groups/:id` route
with RAKHAL-433's 3 new fields. Hit and fixed a real environment issue while verifying: this
session's long-lived dev server on port 3005 wasn't picking up `i18n/messages/*.json` edits through
Turbopack's watcher — killed the stale process, restarted via a properly tracked `preview_start`.
Live-verified: `PATCH /settings/feed-groups/:id` round-trips the picked item, cleared back to "None"
afterward. RFE-117 (Tier 0 search) is the only ticket left in MILESTONE 25. Full writeup:
`docs/PROJECT_PROGRESS.md`'s MILESTONE 25 section, `docs/IN_FLIGHT.md` Recently Done.

## RFE-115 — Feeding Grid: per-row source cell + bulk-apply (2026-09-20)

MILESTONE 25 (Feeding Favourites) frontend twin — backend RAKHAL-429…434 all done, epic docs:
`../../docs/EPIC_FEEDING_FAVOURITES.md`. Each cow row on `/feeding` now has its own source picker
(new `RowSourceCell`, same picker shape `batch-link-picker.tsx` established), pre-filled from the
row's own staged draft or the backend's `default_source` resolution ladder — no longer one source
for the whole grid submission. New "Apply source to selected" bulk action stamps the toolbar's
picked source onto every selected row. Live-verified: real `POST /feed/grid/draft → 201` round-trips
the exact per-row source picked, `GET /feed/grid` now returns `default_source` on every cow.
RFE-116 (Feed Group settings default) / RFE-117 (Tier 0 search) next. Full writeup:
`docs/PROJECT_PROGRESS.md`'s MILESTONE 25 section, `docs/IN_FLIGHT.md` Recently Done.

## RFE-048 — Support feedback widget (2026-09-18)

Real, previously-unclaimed `TODO` ticket — backend `POST /feedback` (RAKHAL-242) already existed
fully built, this shipped the frontend-only widget: a `FeedbackDialog` (category/message/optional
screenshot) opened from the account (avatar) menu's new "Send Feedback" item. `apiUpload()`
widened with an optional file + extra form fields (additive, all 4 existing callers unaffected).
Live-verified: real `POST /feedback → 201 Created`, sheet auto-closes on success. Also shipped
today: RFE-118 (missed-entry calendar on Milk Log + Feed Grid, frontend twin of backend
RAKHAL-434) — see its own IN_FLIGHT.md Recently Done row for detail. Full writeups:
`docs/IN_FLIGHT.md` Recently Done.

## RFE-114 — Generalize the finalize dialog's purchase preview to the Concentrate Mixer (2026-09-15)

Closes RD-090's frontend half — MILESTONE 8c (RAKHAL-421…428 + RFE-111…114) now fully closed, both
repos. Backend RAKHAL-428 made a Concentrate Mixer's unlinked cost pay the same way a TMR's does;
`FinalizeTmrDialog`'s hooks were already kind-agnostic (only ever needed an id), so the fix was purely
kind-conditional copy — Concentrate now shows its own title/description/toast strings instead of the
TMR ones, no new i18n keys. `feed-view.tsx`'s Concentrate section opens this same dialog now instead of
a plain confirm; the now-dead local finalize handler was removed. Gate: `typecheck`(0)/`eslint`(0 on
both changed files)/`build`(0, 45 routes)/`test`(174/174). Full writeup: `PROJECT_PROGRESS.md`.

## RFE-110 — Safety Withdrawals becomes a filter, not a fourth tab (2026-09-15)

Last ticket of the Healthcare IA rework — closes RFE-106…110 end to end. `safety-withdrawal-tab.tsx`
(orphaned since RFE-107 dropped its render call) repurposed into `SafetyWithdrawalSection`, now a
third section inside `TreatmentsTab` below Preventive Rounds, reached via a "Withholding"/"All"
segmented toggle instead of a peer tab — default view `activeOnly=true` (RAKHAL-420's own param).
`SafetyWithdrawalTable` gained the medicine/case columns and a days-remaining countdown RAKHAL-420's
`getSafetyWithdrawals` now returns (`medicineName`/`caseCode`/`{milk,meat}DaysRemaining`), replacing
bare withdrawal dates; any row still `ACTIVE`/`READY_FOR_RELEASE` gets a red "Withholding" badge.
Refresh + per-row Release carried over unchanged, just relocated. Gate: `typecheck`(0)/`eslint`(0 on
6 files)/`build`(0, 39 routes)/`test`(174/174), both locales valid. Full writeup:
`docs/PROJECT_PROGRESS.md`'s RFE-110 entry, `docs/IN_FLIGHT.md` Recently Done.

## RFE-107 — Merge Sick Bay + Active Plans into one "Treatments" tab (2026-09-15)

The "3 tabs, not 4" fix — third and final currently-unblocked ticket of the Healthcare IA rework
this pass. `HEALTH_MANAGEMENT_TABS` goes `sickBay`/`taskHub`/`healthPlan`/`safetyWithdrawals` →
`treatments`/`schedule`/`protocols`. New `TreatmentsTab` merges the unchanged `SickBayTable`
(curative cases) with a new "Preventive Rounds" section reading RAKHAL-415's real
`GET /health/plan-applications` (grouped one row per round, not per cow) — replacing the removed
`GET /health/cases/applied` and the `ActivePlansSection`/`EditAppliedPlanDialog` components that
called it (deleted outright, confirmed zero remaining importers). **Real, deliberate gap**: the
`safetyWithdrawals` tab is gone from the nav until RFE-110 (still blocked on backend RAKHAL-420)
folds it back in as a filter chip — the data/route are untouched, only this tab bar's reachability.
Gate: `typecheck`(0)/`eslint`(0/0 in 7 files)/`build`(0, 39 routes)/`test`(174/174), both locales
valid. Full writeup: `docs/PROJECT_PROGRESS.md`'s RFE-107 entry, `docs/IN_FLIGHT.md` Recently Done.
Only RFE-110 remains in this set, still blocked.

## RFE-108 — Quick Treat: log a treatment without opening a case (2026-09-15)

Second implemented ticket of the Healthcare IA rework. New `QuickTreatDialog` ("Quick Treat" button
beside "Log Treatment") logs a treatment for one or more animals with no case id anywhere in the
form — the Herdwatch-parity flow the backend investigation named as the target. One call to the
real bulk `POST /health/treatments` (RAKHAL-416, confirmed already live server-side); the backend
reuses each animal's open case or creates a lightweight one, never orchestrated client-side.
Withdrawal-hold preview and the payment-account gate are both computed client-side by mirroring the
backend's own `resolvedCost`/`createSafetyWithdrawalIfNeeded` logic exactly (read from source, not
guessed). Gate: `typecheck`(0)/`eslint`(0/0 in 7 files)/`build`(0, 39 routes)/`test`(174/174), both
locales valid. Full writeup: `docs/PROJECT_PROGRESS.md`'s RFE-108 entry, `docs/IN_FLIGHT.md` Recently
Done. Remaining open lanes in this set: RFE-107/110 stay blocked on backend RAKHAL-415/417/420.

## RFE-106 — Sick Bay: attach a protocol to an existing case + bulk-apply rewrite (2026-09-14)

First implemented ticket of the Healthcare IA rework (RFE-106…110). New "Apply Protocol" row action
on `SickBayTable` (inline `ApplyProtocolDialog`, plan picker + start date, `healthcare.update`-gated)
attaches a plan to a case that already exists — no UI path did this before; the only Apply flow
always created a duplicate second case. `ApplyHealthPlanDialog`'s "Confirm Schedule" step dropped
its old per-animal `createCase`→`applyToCase` loop (2N sequential requests) in favor of the real
bulk `POST /health/plans/:id/apply` (RAKHAL-414, confirmed already live server-side) — toast now
reports the actual applied/skipped split instead of a bare count. Gate:
`typecheck`(0)/`eslint`(0/0 in 5 files)/`build`(0, 39 routes)/`test`(174/174), both locales valid.
Full writeup: `docs/PROJECT_PROGRESS.md`'s RFE-106 entry, `docs/IN_FLIGHT.md` Recently Done. Next open
lane in this set: RFE-108 (Quick Treat, needs only RAKHAL-416 which is done) — RFE-107/110 stay
blocked on RAKHAL-415/417/420.

## RFE-113 — Finalize dialog: shortfall blocking + owned-vs-purchased cost split (2026-09-14)

MILESTONE 8c frontend twin — **closes out all three frontend tickets (RFE-111/112/113)**; only
backend RAKHAL-425 remains open on the epic. New `useConcentrationFinalizePreview` mirrors the
backend's `resolveBatchDeductions` split exactly (unlinked cost exact, linked-batch shortfall
precise where a kg conversion exists, "not checked" where it doesn't). **Real pre-existing bug
found and fixed**: the dialog unconditionally required a `financialAccountId` — exactly the gate
RAKHAL-424 already relaxed server-side for an all-linked finalize; now conditional on
`unlinkedCostTk > 0`. Confirm hard-blocks on any named shortfall instead of surfacing a bare 400.
Also fixed two more stale "Concentrate Mixer never touches inventory" claims (copy + code comment)
RAKHAL-421 made false. Gate: `typecheck`(0)/`eslint`(0/0 in 3 files)/`build`(0)/`test`(174/174). Full
writeup: `docs/PROJECT_PROGRESS.md`'s RFE-113 entry, `docs/IN_FLIGHT.md` Recently Done.

## RFE-112 — Recipe builder: per-line source choice, catalogue ingredient vs inventory batch (2026-09-14)

MILESTONE 8c frontend twin. New `BatchLinkPicker` lets a `FeedMixtureTable` line name a specific
`FeedItem`/`FeedStock` to consume on finalize, identical for Concentrate Mixer and TMR. **Real gap
found**: `GET /feed/ingredients` never exposes `source_concentration_id`, so a `FeedStock` link can't
be matched precisely client-side — narrowed to `kind === 'CONCENTRATE_TEMPLATE'` with stock, backend
validates the exact match at save. Fixed a real bug along the way: the Normalize flow silently
dropped any batch link on every call (its response doesn't echo one back) — now merged back by
`ingredientId`. New debt **RD-090**: a Concentrate Mixer finalize with real unlinked cost never
requires payment or posts a journal, unlike a TMR's — needs a product call. Gate:
`typecheck`(0)/`eslint`(0 in the 5 touched files)/`build`(0)/`test`(174/174). Full writeup:
`docs/PROJECT_PROGRESS.md`'s RFE-112 entry, `docs/IN_FLIGHT.md` Recently Done.

## RFE-111 — Inventory: concentrate batches move to the Prepared segment (2026-09-13)

MILESTONE 8c frontend twin, backend rationale in `../../docs/EPIC_PREPARED_FEED.md`/ADR-025. Most of
this ticket was already correct pre-`RAKHAL-421`: the Purchased/Prepared segmentation and the `kind`
badge in `feed-stock-columns.tsx`/`feed-stock-grid.tsx` needed zero code change once concentrate
finalize stopped producing a `FeedItem` and started producing a `FeedStock` instead. Real gaps found
and fixed: `FeedStock` type gained `kind` (`features/feed/types.ts`, backend already returned it);
`feed.stock.{subtitle,empty,emptyDescription}` in **both** locales literally told the farmer only a
TMR produces stock — corrected to name both Concentrate Mixer and TMR; same false claim fixed in two
code comments (`feed-stock-view.tsx`, `use-feed.ts`). Gate: `typecheck`(0)/`lint`(0 in touched
files)/`build`(0, 38 routes)/`test`(174/174). Full writeup: `docs/PROJECT_PROGRESS.md`'s RFE-111 entry,
`docs/IN_FLIGHT.md` Recently Done.

## (no ticket) Healthcare IA rework specced: RFE-106…110, companion to backend MILESTONE 24 (2026-09-11)

User asked whether Healthcare's 4 tabs (Sick Bay / Treatment Schedule / Health Plan / Safety
Withdrawals) are real dairy needs and whether the UX holds up. Backend investigation (MILESTONE 24 on
the backend board, 2026-09-10) found every feature has real demand but the decomposition is wrong —
`HealthCase` is a mandatory wrapper, no UI path attaches a protocol to an existing case (both frontend
callers of apply-plan create a duplicate case first), and applying a plan to a herd is 2N sequential
requests. Target IA: 3 tabs (**Treatments** / **Schedule** / **Protocols**) instead of 4, Safety
Withdrawals demoted to a filter chip rather than a fourth destination. 5 frontend tickets written
(RFE-106…110, `PROJECT_PROGRESS.md`), each gated on its backend RAKHAL-41x twin — **none started**.
RFE-109's Overdue-count/default-month fixes need no backend change and can go first.


## (no ticket) Date & date-time picker UX overhaul (2026-09-03)

**Problem (user-reported, with screenshots):** the Record Breeding/AI dialog rendered the browser's
own blue `<input type="datetime-local">` panel — off-theme inside a Rakhal sheet; the calendar's nav
arrows sat on the popover's own border (`nav` was `absolute inset-x-0 top-0` while its nearest
positioned ancestor was the popover, not the calendar), day cells were 36px and hard to hit, and
picking a range "did nothing" on the first click.

**Shipped**
- `components/ui/calendar.tsx` — nav is an in-flow row now (`« ‹ September 2026 › »`, 36px buttons,
  real padding, month label inside the row for single-month calendars); `months` is no longer
  `sm:flex-row` (that put the arrows *beside* the grid once the nav left absolute positioning);
  40px day cells; custom `Day`/`DayButton` components so range start/middle/end and `today` resolve
  in JS instead of fighting Tailwind class order (an in-progress range used to render as one solid
  green block).
- **New `components/ui/date-time-picker.tsx`** — themed replacement for `<input type="datetime-local">`:
  the shared `Calendar` plus hour/minute/AM-PM columns and a `Now`/`Clear`/`Done` footer. Same
  `"yyyy-MM-dd'T'HH:mm"` value shape, so zod schemas and API payloads are untouched.
- `components/ui/date-picker.tsx` — `Today`/`Clear` footer, optional `clearable` (the inline ✕ is a
  *sibling* of the trigger, never a nested button).
- `components/shared/date-range-picker.tsx` — draft state so the first click of a two-click range
  highlights immediately, plus `resetOnSelect` (react-day-picker otherwise only ever *extends* the
  committed range — that is what the "multiple date select" report was about). "Custom" carries a
  hint line.
- `components/ui/popover.tsx` — `z-50` → `z-[60]`: popovers opened from a dialog/sheet (also z-50,
  portalled later) were painted over by their own opener, so the date popover looked transparent.
- **Every native date control in the app is gone** — 34 `<input type="date"|"datetime-local">` call
  sites across cattle, calves, reproduction, health, milk, feed, finance, purchasing and buyers moved
  to `DatePicker`/`DateTimePicker` (RHF `register()` → `Controller`; `dry-off-form-fields`'s
  uncontrolled ref became state; `task-reschedule`'s read-only "current date" became plain text).
- i18n: `common.{today,clear,now,done,time,hour,minute}` + `period.presets.customHint`, en + bn.

**Verified live** against the running dev stack: the Record Breeding/AI date-time popover (day +
hour + minute + PM → trigger reads "14 সেপ, 2026 · 5:30 PM") and the Sales period picker's two-click
custom range (Aug 5 → Aug 12 committed, chart axis followed). Gate: `typecheck` 0 new errors,
`eslint` 0 errors on touched files, `vitest` green. `pnpm build` is blocked by two **pre-existing**
errors owned by other lanes (`features/cattle/components/detail/pedigree-tab.tsx` —
`openCattleDetail` undefined, committed; `components/shared/confirm-dialog.tsx` — half-migrated
Dialog→Sheet imports, another agent's uncommitted work).

## RAKHAL-394 — Dead-code sweep + empty-state/copy pass (2026-09-01)
Phase F closeout, MILESTONE 22. `features/finance/api.ts` trimmed from 12 `financeApi` methods to 3
(`liabilities`/`assets`/`createAsset`, the only ones with a real consumer); `hooks/use-finance.ts`
trimmed to exactly `useLiabilities`/`useAssets`/`useCreateAsset`, deleting 10 zero-consumer V1 hooks
whose backend routes were dropped in RAKHAL-354. Deleted `ledger-filters.tsx` (zero importers). Found
and fixed a real defect while verifying the PRD's "delete the literal 'Not yet available' string"
mandate: `rakhal-balance-card.tsx`'s position block read `data.receivablePayable`, a field
`GET /finance/balance` stopped returning entirely once RAKHAL-371 shipped — permanently stuck on
"Not yet available". Replaced with real links to the now-live Receivables/Payables tabs (RAKHAL-386).
Empty-state CTA/consequence-copy AC scoped to the Lane's literal `empty-state.tsx` consumers (3 small
read-only summary panels, correctly minimal as-is); the PRD's full consequence-teaching pattern across
the 9 `DataTable`-driven Business IA tables was **not** rolled out — flagged as a real remaining gap,
not claimed done. `knip`/`ts-prune` not installed in this repo — verified manually via targeted grep
instead. Gate: `typecheck` 0 new (1 pre-existing unrelated error), `eslint` 0 on all touched files,
both locales parse clean.

## RAKHAL-393 — Close RD-066: `AccountPicker` everywhere, frontend half (2026-09-01)
Phase F closeout, MILESTONE 22. `features/feed/components/finalize-tmr-dialog.tsx` fully rewritten
off its hardcoded `PAYMENT_METHODS` `Select` (still carried the deleted V1 `WALLET` value) onto the
shared `AccountPicker` + `financialAccountId`. `features/reproduction/components/dialogs/
breeding-event-form-fields.tsx`'s `PaymentMethodField` replaced with a new `AccountField` (same
`AccountPicker`, bound via `Controller` to `financialAccountId`), wired across all 3 cost-entry call
sites (AI from farm inventory, AI from a manual source, NATURAL/EMBRYO_TRANSFER). `features/
reproduction/schemas.ts`'s `withBreedingCostValidation` now requires `financialAccountId` whenever a
real cost is submitted; both breeding-event base schemas gained the field. `breeding-event-dialog.tsx`
/`breeding-event-step.tsx` needed no submit-handler change (both spread `...values`, so the new field
flows through). `lib/types/payment.ts`'s doc comment corrected — it previously named these two forms
as blocked from the WALLET-less union pending RAKHAL-354; both are now fully off V1 payment methods.
Backend half (deletes `resolve-account.ts`'s stopgap, requires `financialAccountId` on both routes)
done in the same pass — see `rakhal-backend`'s own `docs/IN_FLIGHT.md`. Gate: `typecheck` 0 new (1
pre-existing unrelated error in `features/cattle/components/detail/pedigree-tab.tsx`), `eslint` 0 on
all 5 touched files, both locales updated same commit.

## RAKHAL-392 — Source-reference drill-through + Posted/Voided chips + void flows (2026-08-31)
Last Phase E ticket, MILESTONE 22 — closes the nine-way-parallel screen-ticket wave (383-392 all
done). New `components/shared/source-reference.tsx` (one shared `Link`-or-text renderer, now used
by `TransactionsTable`'s reference column) + `features/finance/components/void-document-dialog.tsx`
(one dialog for Sale cancel/refund + Purchase/Expense void — surfaces the backend's own real
rejection message verbatim when a document has allocated payments, never a client-side guess).
Wired Voided badges + void/cancel/refund row actions (`finance.reverse`-gated) into Sales Invoices,
Purchasing Purchases, and Purchasing Expenses; added the previously-untyped `Purchase.status`/
`Expense.voidedAt` fields to back them. Deliberately skipped Receivables/Payables (derived
settlement status, not a document's own Posted/Voided state) and per-document detail pages for the
backend's `TRANSACTION_SOURCE_REGISTRY` hrefs (none exist yet — a real backend/routing gap, flagged
not faked). Gate: `typecheck` 0 in every touched file (repo-wide run's only remaining error is
pre-existing/unrelated), `lint` 0 per-file, `test` 174/174.

## (no ticket) Buyers: archived-buyer list/summary mismatch + BuyerPicker + right-side Add Buyer sheet (2026-08-31)
Full writeup: `docs/IN_FLIGHT.md`'s matching Recently Done row, same date. Fixed `buyers-view.tsx` fetching
the list without `includeArchived` (defaulted `false`) while `GET /buyers/summary` counts archived buyers
too — a deactivated buyer showed "Total Buyers: 1" over an empty table. New `BuyerPicker` (search-select +
inline "+ Add new buyer" opening the real `BuyerFormDialog`, auto-selects on create) replaces the plain
`<Select>` in Record Dispatch and Record Sale's Milk step. `BuyerFormDialog`/`RecordDispatchDialog`
converted from centered `Dialog` to the app's right-side `Sheet` chrome (`EquipmentFormDialog` precedent).

## RAKHAL-389 — Buyers: list + summary + detail page + Buyer Groups (2026-08-31)
Ninth Phase E screen ticket, MILESTONE 22 — last of the nine-way-parallel screen tickets to land.
List columns `Buyer Name | Phone | Outstanding | Total Purchased | Last Purchase | Actions` +
4-stat Buyer Summary (`GET /buyers/summary`), off `GET /buyers` v2's server-computed aggregates
(RAKHAL-372). New buyer detail page (`/buyers/:id`): header (back link + name + Edit + 3 stats) +
tabs `Overview | Sales & Invoices | Dispatches | Payments | Balance`. `Buyer Groups` tab replaces
the deleted global "Dispatch History" tab (moved to Sales, RAKHAL-388) — `Buyers | Buyer Groups`,
off `GET /buyers/groups`, no new model. Payments/Balance tabs reuse existing Finance/Buyers
components as-is (`ReceivablesTable`, `useBuyerStatement`) rather than duplicating logic. **Caught
+ fixed 2 real pre-existing bugs**: `Buyer.isActive` never matched the schema (`MilkBuyer`
soft-deletes via `deletedAt`, not `isActive` — every buyer silently rendered "Inactive"), and
`BuyerListFilters` sent `includeInactive` where the DTO field is `includeArchived`. Also fixed 2
real bugs in RAKHAL-388's own code once typecheck finally cleared an unrelated repo-wide blocker
this session (`InvoicesView`'s `status`→`paymentStatus` filter, a recharts Tooltip type mismatch).
Gate: `typecheck`/`lint` clean in this lane (repo-wide runs still show pre-existing unrelated
errors elsewhere, one flagged as a separate background task); `test` unaffected; `build` blocked
repo-wide by a second unrelated pre-existing error, also flagged separately.

## RAKHAL-388 — Sales module: Overview + Invoices + Dispatches (2026-08-31)
Eighth Phase E screen ticket, MILESTONE 22 (largest remaining — Critical/XL). New `/sales` module:
**Overview** (4 KPIs+changePct, Sales Trend line chart with By Day/Week/Month toggle, Sales by
Product donut, Recent Sales table, Top Buyers list, off `GET /sales/summary`), **Invoices**
(status tabs All/Unpaid/Partial/Paid → `?paymentStatus=`, the AC's exact columns, reuses
`AgingSummaryStrip` for the 4-tile Aging Summary), **Dispatches** (status tabs
All/Pending/Delivered/Cancelled → `?status=` on `GET /buyers/dispatches` v2, Confirm Receipt +
Cancel row actions, Dispatch Summary panel). `isSaleFlowWired` deleted — Manure/Inventory sale
types are now wired for real (`POST /sales/manure`/`/sales/inventory`); Inventory gained a real
`ItemPicker` (reused from Purchasing) replacing the old free-text placeholder. New `+ New Sale ▾`
split button (5 sale types, one shared wizard) gates on `sales.create` **or** `finance.create`
since its submit paths span both permission resources. `app/(app)/sales/page.tsx` now mounts the
real `SalesView` (was RAKHAL-357's bare wizard-trigger scaffold). Gate: `lint` clean scoped to
`features/sales/**`; `test` 87/87 unchanged. **`typecheck`/`build` not independently confirmed**
this session — blocked repo-wide by an unrelated pre-existing parse error in
`features/health/components/record-batch-dialog.tsx`, left uncommitted by a different concurrent
agent (confirmed outside this ticket's lane); flagged as its own background task, not fixed here.
Re-verify once that lands.

## RAKHAL-391 — Purchasing overhaul + Record Purchase modal (2026-08-29)
Seventh Phase E screen ticket, MILESTONE 22 (second Purchasing-module ticket). Tabs reordered to
**`Purchases | Expenses`** (was `Expenses | Purchases`), Purchases now the default tab — mockup 1's
`Purchases | Suppliers` superseded now that Suppliers is its own module (RAKHAL-390). New "This
Month Summary" 4-stat panel (`GET /purchasing/summary?from&to`, RAKHAL-375) + a shared payment-status
+ `DateRangePicker` filter bar driving both tables. Rewrote `api.ts`/`hooks/use-purchasing.ts` onto
RAKHAL-375's cursor+filter list routes — `usePurchasesList`/`useExpensesList` are `useInfiniteQuery`
+ `DataTable` "load more", replacing the old plain-array `usePurchases`/`useExpenses`. `PurchasesTable`
now the AC's exact columns `Reference | Supplier | Date | Total | Paid Amount | Status | Due Date`
(`Supplier` joined client-side from `/settings/suppliers` by the real FK RAKHAL-365 promoted).
Record Purchase modal: new `SupplierPicker` replaces the old free-text Supplier field (now required
client-side per spec, DTO stays optional server-side); Payment Type switched `Switch`→radio `Paid
Now`/`Buy on Credit`. The atomic `POST /purchasing/purchases` call itself was already correct
(RAKHAL-348/359's `$transaction`) — no backend change. Deleted dead `payable-status-badge.tsx`.
Gate: `typecheck`(0)/`lint`(0 new)/`build`(0, 45 routes unchanged)/`test`(87/87 unchanged). No live
click-through — same documented pre-existing Suspense-stuck harness quirk prior rows note.

## RAKHAL-390 — Suppliers module (2026-08-29)
Sixth Phase E screen ticket, MILESTONE 22 (first Purchasing-module ticket). New `features/
suppliers/**` — aggregate-driven directory off `GET /purchasing/suppliers`/`.../summary`
(RAKHAL-373): `Supplier Name | Phone | Total Purchases | Payable | Last Purchase | Actions` + a
4-stat summary (Total/Active Suppliers, Total Purchases, Total Payable). Write side (create/edit/
deactivate) reuses the existing `/settings/suppliers` CRUD as-is (`useCreateSupplier`/
`useUpdateSupplier`/`useDeleteSupplier`, `supplierFormSchema` — `features/settings/**` untouched,
read-only reuse). Caught + fixed a real permission-gate bug pre-ship: first draft gated Actions/Add
on a non-existent `purchasing.update` (catalogue only has `purchasing.read`/`purchasing.create`) —
the real write routes are `settings.update`, fixed to match. New `useInvalidateSuppliersV2()`
bridges the two query-cache namespaces (settings mutations don't know this read-model view exists).
Mounted at `/suppliers` (was RAKHAL-381's coming-soon scaffold). Gate: `typecheck`(0)/`lint`(0 new)/
`build`(0, 45 routes unchanged)/`test`(87/87 unchanged). No live click-through — same documented
precedent as prior rows on this board.

## RAKHAL-387 — Finance Reports tab (2026-08-28)
Fifth Phase E screen ticket, MILESTONE 22. New `features/finance/components/reports/**` — a
4-segment tab (own `report` URL param): **P&L** off `GET /finance/reports/profit-loss?from&to`
(rows already farmer-facing category names, never a ledger code); **Cash Flow** off `GET /finance/
reports/cash-flow?from&to` (opening/inflow/outflow/closing per `FinancialAccount`); **Receivable/
Payable Aging** reuse RAKHAL-386's `AgingSummaryStrip` as-is. P&L/Cash Flow share one
`DateRangePicker`+`usePeriod()`, period-keyed cache. **Trial Balance deliberately has no client at
all** — Owner-only, `finance.accounting`-gated, URL-reachable only, per ADR-022/§9.2's explicit
"do not restore" instruction. Mounted as the `reports` tab in `FinanceView` and standalone at
`/finance/reports`. Gate: `typecheck`(0)/`lint`(0 new)/`build`(0, 45 routes unchanged)/`test`(87/87
unchanged). No live click-through — same documented precedent as prior rows on this board.

## RAKHAL-386 — Receivables + Payables screens on aging + real party names (2026-08-28)
Fourth Phase E screen ticket, MILESTONE 22. New shared `aging-summary-strip.tsx` — one component,
`kind` prop picks `GET /finance/receivables/aging` (`finance.read`) or `GET /purchasing/payables/
aging` (`purchasing.read`), both RAKHAL-369; bucket labels/amounts come straight off the API. Party
names fixed: `ReceivablesTable` swapped `useSalesLookup()` (narrow, no `customer` field) for
`useSalesV2()`'s full `Sale` shape to render real `customer.name` (`Sale.customerId` a real
`MilkBuyer` FK since RAKHAL-364); `PayablesTable` added a `useSuppliers()` join keyed on
`Payable.supplierId` directly (a real `Supplier` FK since RAKHAL-365) — covers both Purchase- and
Expense-sourced payables in one lookup. Added the required "Receive Payment settles an invoice..."/
"Make Payment settles a bill..." copy lines. Gate: `typecheck`(0)/`lint`(0 new)/`build`(0, 45 routes
unchanged)/`test`(87/87 unchanged — `PaymentStatusBadge`'s 5-test guard still passes). No live
click-through — same documented precedent as prior rows on this board.

## RAKHAL-405 frontend twin (scoped) — Task Hub: status visibility + cancel action (2026-08-28)
First slice of the Task Hub redesign, after a user critique of the live screenshot (no visible
lifecycle, tasks looked identical regardless of status, no cancel action). Scoped to wiring the
backend fields RAKHAL-405 just shipped into the existing Figma-locked components — the bigger
date-filter/grouping/KPI restructure from that critique has no Figma frame and is deferred as its
own ticket (this repo doesn't redesign ahead of Figma). `Task` gained `scheduledAt`/`completionNote`/
`cancelledAt`/`cancelledById`; `TaskStatus`/`TaskDisplayStatus` gained `CANCELLED`/`cancelled`; new
`useCancelTask()` (mirrors `useReopenTask()`). Every `TaskCard` now shows a status chip + muted/
strikethrough when closed (previously zero status indicator existed on the card at all — the exact
gap the user reported). `TaskDetailsSheet` gained a status chip, a "Cancel Task" button with an
optional-reason panel, and completed/cancelled metadata display. Gate: `typecheck`(0)/`lint`(0 new)/
`build`(0, 45 routes unchanged). Live-verified via direct `fetch()` (Suspense-stuck harness quirk
blocked `/tasks` click-through, same pre-existing limitation other rows document): create with
`scheduledAt` + cancel with a note both round-trip exactly. Full writeup: `docs/IN_FLIGHT.md`.

## RAKHAL-385 — Transactions screen (2026-08-28)
Third Phase E screen ticket, MILESTONE 22. New `features/finance/components/transactions/**` — a
unified, filtered, cursor-paginated feed off `GET /finance/transactions` (RAKHAL-370), columns
`Date | Type | Reference | Party | Account | Amount | Status`. `All Types ▾` filters on the real
`TRANSACTION_SOURCE_REGISTRY` keys (SALE/PURCHASE/EXPENSE/FINANCE_PAYMENT/FINANCE_TRANSFER/
OTHER_INCOME/FEED_MIXTURE_FINALIZE/FINANCIAL_ACCOUNT_OPENING_BALANCE) — the mockup's finer
sub-type breakdown (Milk/Animal/Manure/Inventory Sale, Payment Received/Made as separate entries)
has no backend column to filter on, flagged rather than faked. `+ New Transaction ▾` reuses the
same 4 destinations RAKHAL-383's Quick Actions established. Deleted `ledger-view.tsx` + its 4
segment tables + 2 test files (confirmed no other importer, confirmed no live `LedgerAccount`
import existed per ADR-023). Mounted as the `transactions` tab in `FinanceView` and standalone at
`/finance/transactions`. Gate: `typecheck`(0)/`lint`(0 new)/`build`(0, 45 routes unchanged)/
`test`(87/87 — down from 93, the 2 deleted test files' 6 tests correctly gone). No live
click-through — same documented precedent as prior rows on this board.

## RAKHAL-384 — Accounts screen (2026-08-28)
Second Phase E screen ticket, MILESTONE 22. `account-list.tsx` rewritten from a card grid to a real
`DataTable`: `Account Name | Type | Account No / Info | Current Balance | Status | Actions`, one row
per `FinancialAccount` (never one aggregate MFS row — a farm with 3 banks + 2 MFS wallets renders 5
rows). `Current Balance` joined client-side by `id` from `useRakhalBalance()`'s existing `accounts[]`
(same cached `GET /finance/balance` call `RakhalBalanceCard` above the table already makes, no new
request). `Type` shows the MFS provider name (bKash/Nagad/...) when known instead of the literal enum.
`Status` renders "Active" for every row today — neither list endpoint is called with `includeArchived`
from the frontend, so an archived account simply isn't in either list; the column is real per the AC,
not a placeholder. Edit/Archive actions unchanged. Gate: `typecheck`(0)/`lint`(0 new)/`build`(0, 45
routes unchanged)/`test`(93/93 unchanged). No live click-through — same documented precedent as prior
rows on this board.

## RAKHAL-383 — Finance Overview screen (2026-08-28)
First Phase E screen ticket, MILESTONE 22. Rebuilt Row A/B on the real `GET /finance/summary`
(RAKHAL-371) — the literal "Not yet available" receivable/payable text is gone. Row A
(`usePositionSummary()`) and Row B (`usePeriodSummary(range)`) are two separate queries with two
separate cache keys specifically so Row A never refetches when the `DateRangePicker` (RAKHAL-380)
changes period — a query-cache-level guarantee, not just a backend behavior. Quick Actions narrowed
to 4 (Record Expense/Receive Payment/Make Payment/Transfer Money), Record Sale + Other Income
removed with "Go to Sales →"/"Go to Purchasing →" links in their place. New Outstanding Receivables
panel reuses the already-cached `useSalesV2()` list (has buyer name + `INV-` number + due date/amount
in one place) rather than the joinless `GET /finance/receivables`. New Recent Transactions panel off
`GET /finance/transactions` (RAKHAL-370), signed by `cashAmount` when non-zero. The former
always-visible-above-every-tab highlights/actions row is now Overview-tab-exclusive content. Gate:
`typecheck`(0)/`lint`(0 new)/`build`(0, 45 routes unchanged)/`test`(93/93 unchanged). No live
click-through — same precedent as 380/381/382.

## RAKHAL-382 — Flatten Finance to one tab bar; relocate V1 survivors (2026-08-28)
Third frontend ticket of MILESTONE 22 Phase D, closes the phase. `features/finance/types.ts`'s
`FINANCE_TABS` is now `Overview · Transactions · Receivables · Payables · Accounts · Reports` (was
`Ledger · Receivables · Payables · Liabilities · Assets`) — `finance-tabs.tsx`'s icon map and both
`.withDefault(...)` calls updated to match. `finance-view.tsx`: `Accounts` tab mounts the real
`AccountsView` (same component `/finance/accounts` already used standalone); `Overview`/
`Transactions`/`Reports` are `EmptyState` placeholders since their real content (383/385/387) all
depend on this ticket landing first; `Receivables`/`Payables` unchanged. The old stacked `?doc=`
segment bar inside Master Ledger is gone — `LedgerView`/`LiabilitiesView`/`AssetDistributionView`
are unmounted from the tab bar (`ledger-view.tsx` + its 4 tables left on disk, deletion is
RAKHAL-385's own lane). New `LegacyTabRedirect` sends stale `?tab=liabilities`/`?tab=assets`/
`?tab=ledger` bookmarks to their new homes. `app/(app)/finance/{liabilities,assets}/page.tsx`
(RAKHAL-381's scaffolds) now mount the real `LiabilitiesView`/`AssetDistributionView` in place of
the placeholder shell. Gate: `typecheck`(0)/`lint`(0 new)/`build`(0, 45 routes unchanged)/
`test`(93/93 unchanged). No live click-through — same precedent as 380/381. Unblocks 383, 384, 385,
386, 387, 392 (all nine-way-parallel Phase E screens).

## RAKHAL-381 — Sidebar IA restructure + route scaffolds (2026-08-28)
Second frontend ticket of MILESTONE 22 Phase D (no backend dependency). `components/layout/nav-items.ts`:
new `NavGroupKey` `"finance"` ordered right after `"business"`; Business group narrowed+reordered to
`Sales · Buyers · Purchasing · Suppliers · Inventory` (new `sales`/`suppliers` nav entries); the existing
`finance` nav item moved from the `business` group into its own new `finance` group. 5 new route scaffolds
(`page`+`loading`+`error`): `/suppliers`, `/finance/transactions`, `/finance/reports`, `/finance/liabilities`,
`/finance/assets` — each a `PageCard`+`EmptyState` shell off a new shared `common.comingSoonTitle`/
`comingSoonDescription` i18n pair, with a doc comment pointing at the real Phase-E ticket that replaces its
content (390 Suppliers, 385 Transactions, 387 Reports, 382 relocates Liabilities/Assets). `/sales` already
had `page`/`loading`/`error` from RAKHAL-357's stub — just gained a nav link, no file changes. Gate:
`typecheck`(0)/`lint`(0 new, 1 pre-existing error on an untouched file)/`build`(0, 45 routes, 5 new)/
`test`(93/93, unchanged). No live click-through — pure static nav config + scaffold shells, full gate green
is the verification (same precedent RAKHAL-355/380). Unblocks 382, 388, 389, 390, 391.

## RAKHAL-380 — `DateRangePicker` + `usePeriod` + period-keyed `qk` registry (2026-08-28)
First frontend ticket of MILESTONE 22's Business Operations IA (Phase D — no backend dependency).
New `lib/period/presets.ts` (`presetToRange`/`derivePreviousPeriod`/`toPeriodKey`, local-time date
math, previous-period formula byte-for-byte ported from the backend's `common/finance/period.ts`),
new `lib/hooks/use-period.ts` (nuqs `?preset&from&to` URL state, `{from,to,preset,label,setPreset,
setRange}`), new `components/shared/date-range-picker.tsx` (`Popover`+`calendar.tsx` range mode +
preset column, plain controlled props — no `usePeriod` coupling). `lib/query/keys.ts` gained a
doc-comment convention for period-scoped cache keys (no literal refactor — no Finance V2 report is
consumed by any screen yet, Phase E hasn't started). `i18n/messages/{en,bn}.json` gained `period.
presets.*`. Gate: `typecheck`(0)/`lint`(0 new)/`build`(0, 40 routes)/`test`(93/93, +12 new). No live
click-through — same precedent RAKHAL-355 documented (no screen mounts this yet). Full writeup:
`docs/IN_FLIGHT.md`'s claim row, `D:\Projects\Rakhal\docs\PROJECT_PROGRESS.md`'s RAKHAL-380 entry.

## (no ticket #) Backend `isActive`→`deletedAt` wire-contract follow-up (2026-08-27)
Backend renamed `isActive: Boolean` to `deletedAt: DateTime?` across 23 models and the public wire contract (`is_active` → `deleted_at`) for Shed/FeedGroup/Supplier/ServiceProvider (among others). Fixed `features/settings/types.ts` (4 types) + `features/settings/api.ts` (3 `delete*` return types) + `features/feed/types.ts`'s `FeedGroup` mirror to match. Zero component logic actually read `.is_active` (confirmed via grep), so this was a pure type fix. Gate: `pnpm typecheck`(0)/`pnpm lint`(0)/`pnpm build`(0, 40 routes). Full writeup: `docs/IN_FLIGHT.md` Recently Done.

## RAKHAL-361 — Domain entry points + retire V1 finance UI + Playwright coverage, closes MILESTONE 21's frontend track (2026-08-24)
Last frontend ticket of the Finance V2 rebuild — all 6 Finance quick-actions (Record Sale/Expense,
Other Income, Receive/Make Payment, Transfer Money) are now live-wired (no more "coming soon"),
V1's Wallet/Add Funds/Withdraw/4-type transaction wizard and settlements UI are deleted (Loans/
FixedAssets UI kept, out of scope), Cattle-detail/`/milk`/Inventory row "Sell" entry points open
the same `RecordSaleDialog` wizard (Milk fully wired, Animal/Inventory honestly
reachable-but-blocked pending backend routes), one real RBAC gap fixed (Receive/Make Payment
dialogs), and a new `tests/e2e/sales.spec.ts` proves the Milk-sale flow live — found and fixed a
pre-existing `playwright.config.ts` stale port (3001→3005) that had silently broken the whole
Playwright suite in this environment. **Backend RAKHAL-354 (drop V1 tables) is now fully
unblocked.** Full writeup: `docs/IN_FLIGHT.md`'s Recently Done row.

## RAKHAL-355 — Finance V2 shared primitives, first frontend ticket of MILESTONE 21 (2026-08-24)
First frontend ticket of the Finance V2 rebuild (`D:\Projects\Rakhal\docs\FINANCE_V2_DESIGN.md`) —
unblocks RAKHAL-356…361. New `components/shared/money-input.tsx` (controlled ৳ input, raw digits
while focused / lakh-grouped display on blur, `Controller`-wired like `DatePicker`) and
`components/shared/wizard.tsx` (generic multi-step chrome extracted from
`record-transaction-dialog.tsx`/`create-health-plan-dialog.tsx`'s hand-rolled `StepProgress`
pattern, form-library-agnostic via an `onValidateStep(fields, index)` callback). New
`features/finance/components/account-picker.tsx` — `UnitPicker`'s exact template, live against
`GET`/`POST /finance/accounts` (RAKHAL-335) via new `features/finance/{api-v2,types-v2}.ts` +
`hooks/use-finance-v2.ts` (kept separate from V1's frozen `api.ts`/`types.ts`). New canonical
WALLET-less `lib/types/payment.ts#PaymentMethod` (matches the V2 backend enum). Payment-method
judgment call: V1's WALLET-inclusive `FinancePaymentMethod` was **not** collapsed into the new
type — 3 of 6 duplicate sites (`features/finance/schemas.ts`, `features/reproduction/{schemas.ts,
components/dialogs/breeding-event-form-fields.tsx}`, `features/feed/components/
finalize-tmr-dialog.tsx`) still post through the live WALLET-accepting V1 backend route, so they
were deduped onto one shared V1 source (`FINANCE_PAYMENT_METHODS`, `features/finance/schemas.ts`)
instead — real dedup, zero runtime change; full reasoning in `docs/IN_FLIGHT.md`'s Recently Done
row. `features/buyers/types.ts`'s already-WALLET-less variant was safely re-exported as a type
alias of the new canonical type. `.claude/launch.json` port 3001→3005 fix. New Vitest suites
(`components/shared/{money-input,wizard}.test.tsx`, 13 tests, real logic not snapshots). Gate:
`typecheck`(0)/`lint`(0 errors)/`build`(0, 37 routes)/`test`(34/34). No live Playwright/manual
click-through of `AccountPicker` this session — no screen exists yet to mount it in (RAKHAL-356 is
the first consumer).

## Unified 8-tab animal profile IA — Overview/Performance/Feeding/Reproduction/Health/Finance/Ancestry/Tasks (no ticket #, 2026-08-15)
Follow-up to the row below: user pasted an external reviewer's critique arguing the animal-detail tab
*list itself* should never change shape by category — one fixed 8-tab set for every Calf/Heifer/Cow/
Bull/Steer, with only each tab's *content* branching by life stage. Implemented per an approved
6-phase plan (all 6 phases done this session): `cattle-detail-tabs.tsx` now renders a fixed
`TABS = [overview, performance, feeding, reproduction, health, finance, pedigree, tasks]` for every
category — no more `CALF_TABS`/`REST_BASE_TABS` variable-length split. `Weight`/`Colostrum`/`Milk &
Feeding`/`Starter Feed` are no longer top-level tabs — Weight lives inside `PerformanceTab` (renamed
from the old `overview-tab.tsx`, "Production" renamed "Performance" — reads correctly for a growing
calf, not just a lactating cow), Colostrum/Milk/Starter Feed are card sections inside a rewritten
`FeedingTab`. New lightweight `OverviewTab` (quick-glance: health alerts, latest weight/BCS, next
task) for non-calf categories, reusing the exact same query keys `PerformanceTab`/`TasksTab`/
`HealthTab` already fetch (react-query dedupes). New `TasksTab` — one component for every category,
including a newly-upgraded Calf (was read-only, now the same live `GET /tasks?cattleId=` view as
everyone else) — needed a small backend companion (`rakhal-backend`'s own `docs/IN_FLIGHT.md`,
same date): `Task.relatedCattleId` existed but had no query filter, now does.
**⚠️ Flagged, not hidden**: this session's `feeding-tab.tsx` rewrite landed inside another still-
`claimed` row's lane (`Feeding grid: per-cow feed session`) — no visible WIP conflict found when
read immediately before editing, but the other session needs to reconcile against this on resume.
Gate green: `pnpm typecheck`/`pnpm lint`(0 errors)/`pnpm build`(37 routes)/both locale JSON valid;
backend `nest build`/`eslint`(0). RBAC gates (`cattle.bcs`/`cattle.update`/`feed.distribution-log`/
`cattle.hold`) grepped before/after, all intact. Live click-through not verified — same pre-existing
Suspense-stuck browser-harness quirk on `/animals` documented elsewhere on this board. Full writeup:
`docs/IN_FLIGHT.md` Recently Done.

## Animal profile redesign: grouped field sections + not-applicable reasons + calf-tab fix (no ticket #, 2026-08-15)
User compared 2 real animals (a Cow and a Calf) and suspected the differing "Animal Details" panels
were a bug. Root-caused: no bug — both come from the same merged `CattleDetailSheet` →
`CattleProfileCard`/`CattleDetailTabs` (`features/cattle/components/detail/`), correctly branching
on `animalCategory`. The one real rough edge was the tab bar relabeling the same `"overview"` key
to `t("production")` for non-calves at render time (`key === "overview" && !isCalf`) — same tab,
different label, which also silently broke the `?tab=` URL default for non-calf animals (`"overview"`
was never in their tab list). Fixed by giving the first tab a genuinely distinct key per category
(`"overview"` for Calf, `"production"` for everything else) instead of relabeling; calf-rearing tabs
now lead the tab bar for calves. `CattleProfileCard`'s field grid restructured into 3 labeled
sections (Identity / Life Stage / Production & Breeding) instead of one flat grid; `Status`/`DIM` —
the only 2 header fields that always render something rather than being conditionally omitted like
Pregnant Status/Lactation Stage/Milk Eligibility — now show a category-aware reason
(`getProductionUnavailableReason`: male animal / immature / not raised for milk) instead of a bare
`"—"` when there's genuinely no production state, rather than reading as a data gap. Also found and
removed dead code while in the area: `features/calves`' own `CalvesTable`/`CalfDetailSheet`/
`CalfDetailTabs` were no longer imported from any `app/` route (superseded by the merge into
`features/cattle` per that file's own "Calves merge" doc comment) — deleted; the 5 calf tab-content
components (`overview-tab.tsx`, `colostrum-tab.tsx`, etc.) they shared stay, still actively reused by
`CattleDetailTabs`. Gate green (`pnpm typecheck`/`pnpm lint` 0 errors/`pnpm build` 37 routes, both
locale JSON files validated). **Live click-through not verified this pass** — hit this board's
pre-existing Suspense-stuck quirk on `/animals` (table stayed on skeleton rows indefinitely, confirmed
the dev server itself was healthy via a direct in-page `fetch()` to the backend proxy returning real
data), same class of harness limitation `RAKHAL-326`/`RAKHAL-042`'s entries above already documented.
Full writeup: `docs/IN_FLIGHT.md` Recently Done.

## RAKHAL-326 — Inventory Unit catalog, frontend half (2026-08-14)
Closes the user's "unit should be a dropdown, not free text, also check edit" request — backend half
(`D:\Projects\Rakhal\docs\IN_FLIGHT.md`) already shipped a real `Unit` catalog (system-seeded + farm-custom,
same convention as `FeedIngredient`). New `UnitPicker` (`features/inventory/components/unit-picker.tsx`,
mirrors `IngredientPicker`'s Popover+Command shape, grouped by dimension Weight/Volume/Count) replaces the
free-text unit input on Medicine/Equipment/FeedItem's create+edit forms via `Controller`-bound `unitId`,
with a "+ Add custom unit" inline quick-add. `unit: string` → `unit: Unit` (nested `{id,name,symbol,
dimension,conversionToBase,...}`) across `types.ts`/`schemas.ts`/every display site in
`features/inventory`+`features/feed`+`features/health` (health's `medicine-picker.tsx` reads the same
`GET /inventory/medicines` shape, fixed as a consequential out-of-lane touch). Gate green (lint/typecheck/
build 37 routes/test 18/18, both locales). **Live smoke test**: hit this board's pre-existing Suspense-stuck
quirk on `/inventory`, verified via direct `fetch()` in-page instead — full create(existing unit)→create
(custom unit)→edit-shows-backfilled-unit cycle proven live for Medicine, plus Equipment's optional-unit and
FeedItem's required-unit paths, all archived after. Full writeup: `docs/IN_FLIGHT.md` Recently Done.

## RAKHAL-042 — Cattle list mobile card view, the AC MILESTONE 10's scoping pass left open (2026-08-12)
Closed the one real gap `docs/IN_FLIGHT.md`'s `agent-m10-enum` entry flagged as out of scope: the top-level
`docs/PROJECT_PROGRESS.md` RAKHAL-042 ticket's `[ ] List table + cards (mobile default)` AC was still
unchecked despite this repo's own RFE-021/022/023 tickets shipping list/add/detail long ago — no
`CattleCard`/grid file existed anywhere. New `CattleGrid`/`CattleCard` (`features/cattle/components/
cattle-grid.tsx`) mirrors Inventory's `FeedItemCard` anatomy; new `useMediaQuery` hook seeds the
default view from viewport width, plus a manual `LayoutGrid`/`List` toggle so either device can switch.
Gate green (typecheck/eslint/build, all 37 routes, both locales valid JSON). **Live click-through not
verified this pass** — the Browser pane didn't composite at all this session (confirmed via zero-size
`getBoundingClientRect()` on real elements and `.click()` not reaching React), same class of harness
limitation this board's `agent-317f-badge`/`agent-045c` entries already documented. Full writeup:
`docs/IN_FLIGHT.md` Recently Done (agent-042).

## RAKHAL-319-F — Onboarding intake: bred/AI-given + currently-in-heat (2026-08-12)
Closed the last open MILESTONE 19 frontend gap besides 317-F. `CattleFormDialog` gained a
create-mode/female-only "Reproduction status at intake" section — mutually-exclusive toggle
(none/bred/heat) wiring the backend's already-shipped `intakeBreeding`/`intakeHeat` (`CreateCattleDto`)
fields, previously unconsumed. Full writeup: `docs/IN_FLIGHT.md` Recently Done (agent-319f).
**RAKHAL-317-F remains open** — needs a real edit-dialog surface (none exists in this frontend) or a
backend detail-payload change before the calculated-vs-expected calving date badge can attach anywhere.

## MILESTONE 10 enum migration gap closure (2026-08-12)
Scoped the backend's Cattle Status Model Rewrite v2 (RAKHAL-269→280) against the frontend — found
most of it already fully migrated. Closed the 2 real gaps: **`CULLED`** now a selectable archive
reason (was missing despite the backend accepting it since RAKHAL-269); **`AnimalHold`** (RAKHAL-280)
now has a full frontend surface — new `AnimalHoldsPanel` on the cattle detail Health tab (place/list/
release, `cattle.hold`-gated) — the backend route existed with zero frontend consumer before this.
Also typed `LactationRow.startReason`/`sourceCalvingEventId` (present on the wire, previously
untyped). Full writeup: `docs/IN_FLIGHT.md` Recently Done (agent-m10-enum). Still open from the
original pasted task list: RAKHAL-317-F/319-F (MILESTONE 19), Cattle detail UI (RAKHAL-042) — separate
follow-up passes.

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
## 2026-09-09 - RFE-101...105: roles editor, feed groups on /feeding, Requirements tab, feeding card

Frontend half of the 2026-09-08 backend work (RAKHAL-408...413). **All five shipped and live-verified** against the real dev stack.
RFE-104 landed last: changing `Protein per litre of milk` 85 -> 95 in the UI stored a sparse
`{proteinPerLitreMilk: 95}`, flipped that field's source to `farm` while the rest stayed `default`, and
moved `GET /feed/requirements` CP from 1.65 to 1.80 kg; reset-all restored both.

Three of the user's four complaints turned out to be frontend-only gaps: the roles API (RAKHAL-031) and the
standalone requirements endpoint (RAKHAL-081/258) had shipped with no consumer at all. Highlights: the
permission grid is driven by the backend catalogue rather than a hardcoded list; `feedApi.requirements()`
was silently dropping five of its ten params; `useCattleOrGroupRequirements` hard-blocked manual mode; and
`/feeding` no longer tells a farm to build a Total Mixed Ration before it will show a requirement.

Also cleared a stale `docs/IN_FLIGHT.md` claim from 2026-08-15 (the feeding-grid row) whose work had already
shipped - it was holding `features/feeding/**` and `features/feed/**`.

Gate: `tsc --noEmit` 0 - `eslint` 0 errors on the changeset (one pre-existing `import/no-cycle` in
`log-distribution-dialog.tsx`, untouched by this work) - both locales render - live-verified in the browser.

