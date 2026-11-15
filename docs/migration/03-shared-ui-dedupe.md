# 03 - Shared UI: one copy, not two

`packages/ui` began as a **copy** of the consumer app's `components/ui` and the generic part of
`components/shared` (commit `9af1681`). After M1 both copies live in one repository, which makes the merge
possible and mechanical. The consumer app must not regress while it happens.

## Principles

1. **One component per PR.** Small, reviewable, revertible.
2. **The shared package wins on API, the consumer wins on behaviour.** Where the two copies diverged, the
   consumer's behaviour is the reference (it is what users see); the shared version adopts it.
3. **No behaviour change in a dedupe PR.** If a fix is needed, it is a separate PR first.
4. **Visual regression is the gate**, not code review alone (see "Gate" below).
5. **Domain-coupled code never moves.** Only components with no import of `features/*`, `lib/format`,
   `next-intl`, or `nuqs` (or with that dependency injected) are eligible.

## Inventory and order

| Wave | Components | Notes |
|---|---|---|
| 1 | `button`, `badge`, `card`, `separator`, `skeleton`, `label`, `textarea`, `switch`, `checkbox`, `radio-group` | pure presentational; diff the two copies first |
| 2 | `dialog`, `sheet`, `popover`, `dropdown-menu`, `tooltip`, `tabs`, `select`, `command`, `avatar`, `progress`, `table` | Radix wrappers; check animation classes |
| 3 | `input` (+`controlSizeVariants`), `labeled-field`, `floating-input`, `combobox`, `chip`, `timeline`, `sonner` | inputs matter most for forms; run form tests |
| 4 | `shared/*`: `empty-state`, `error-state`, `page-header`, `page-card`, `stat-card`, `confirm-dialog`, `row-actions-menu`, `pagination`, `truncated-text`, `mobile-record-card`, skeletons | the admin app already uses several |
| 5 (needs a seam) | `data-table`, `filter-bar`, `form-sheet`, `bulk-action-dock`, `infinite-scroll-footer`, date pickers, `money-*` | depend on `nuqs` / `next-intl` / `lib/format`: inject labels/formatters through props or a small context first |
| never | `cattle-picker`, `animal-link`, `payment-method-picker`, `org-switcher`, `notification-bell`, `global-search`, `user-menu`, landing page | domain or app-shell coupled |

### Status

- **Wave 1: done (2026-11-13).** All ten components now come from `@rakhal/ui`; no local copy is left in
  `apps/web/components/ui`. Plumbing: [#2](https://github.com/md-galib-hossain/rakhal-platform/pull/2)
  (workspace dependency, `transpilePackages`, Tailwind `@source`, shared `--font-sans`). Per component:
  skeleton [#3](https://github.com/md-galib-hossain/rakhal-platform/pull/3),
  card [#4](https://github.com/md-galib-hossain/rakhal-platform/pull/4),
  badge [#5](https://github.com/md-galib-hossain/rakhal-platform/pull/5),
  label [#6](https://github.com/md-galib-hossain/rakhal-platform/pull/6),
  textarea [#7](https://github.com/md-galib-hossain/rakhal-platform/pull/7),
  switch [#9](https://github.com/md-galib-hossain/rakhal-platform/pull/9),
  checkbox [#10](https://github.com/md-galib-hossain/rakhal-platform/pull/10),
  radio-group [#11](https://github.com/md-galib-hossain/rakhal-platform/pull/11),
  button [#12](https://github.com/md-galib-hossain/rakhal-platform/pull/12),
  separator (delete-only) [#13](https://github.com/md-galib-hossain/rakhal-platform/pull/13).
  Gate screens for switch, checkbox and radio-group were added first in
  [#8](https://github.com/md-galib-hossain/rakhal-platform/pull/8) (28 to 36 screenshots). Details:
  `M3-wave1-diff-2026-11-12.md`.
- Lessons: overlapping import lines make open dedupe PRs conflict, so land them one at a time; relative sibling
  imports (`./button`) are not caught by an `@/components/ui/x` rewrite, so grep for them;
  `@radix-ui/react-separator` is still declared in `apps/web/package.json` and is now unused (remove in a
  dependency-cleanup PR).
- **Wave 2: done (2026-11-14).** All 17 eligible components now come from `@rakhal/ui`; `combobox` (0 call
  sites in web and admin) deleted from both copies. `date-picker`/`date-time-picker` stay in web (not
  eligible — import `@/lib/format`, `@/lib/constants/i18n`).
  Gate-screen prerequisite (dialog, popover, tooltip, tabs, command, calendar, progress) in
  [#15](https://github.com/md-galib-hossain/rakhal-platform/pull/15) (36 to 56 screenshots).
  Mechanical swaps: avatar [#16](https://github.com/md-galib-hossain/rakhal-platform/pull/16),
  table [#17](https://github.com/md-galib-hossain/rakhal-platform/pull/17),
  chip [#18](https://github.com/md-galib-hossain/rakhal-platform/pull/18),
  floating-input [#19](https://github.com/md-galib-hossain/rakhal-platform/pull/19),
  input [#20](https://github.com/md-galib-hossain/rakhal-platform/pull/20),
  select [#21](https://github.com/md-galib-hossain/rakhal-platform/pull/21),
  sheet [#22](https://github.com/md-galib-hossain/rakhal-platform/pull/22),
  dropdown-menu [#23](https://github.com/md-galib-hossain/rakhal-platform/pull/23),
  progress [#24](https://github.com/md-galib-hossain/rakhal-platform/pull/24),
  timeline (no gate screen — unit tests + byte-identical file only)
  [#25](https://github.com/md-galib-hossain/rakhal-platform/pull/25),
  tooltip [#26](https://github.com/md-galib-hossain/rakhal-platform/pull/26),
  popover [#27](https://github.com/md-galib-hossain/rakhal-platform/pull/27),
  dialog [#28](https://github.com/md-galib-hossain/rakhal-platform/pull/28),
  command [#29](https://github.com/md-galib-hossain/rakhal-platform/pull/29),
  calendar [#30](https://github.com/md-galib-hossain/rakhal-platform/pull/30),
  sonner (no gate screen) [#31](https://github.com/md-galib-hossain/rakhal-platform/pull/31).
  Reconciled (web's behaviour ported into `packages/ui` first, then swapped — two PRs each):
  tabs [#32](https://github.com/md-galib-hossain/rakhal-platform/pull/32) (reconcile) +
  [#33](https://github.com/md-galib-hossain/rakhal-platform/pull/33) (swap) — adds the
  keyboard/programmatic activation `mousedown` dispatch that web already had;
  labeled-field [#34](https://github.com/md-galib-hossain/rakhal-platform/pull/34) (reconcile) +
  [#35](https://github.com/md-galib-hossain/rakhal-platform/pull/35) (swap) — adopts web's
  `inputClassName`/`containerClassName`/`error` props and styling.
  Delete-only: combobox [#36](https://github.com/md-galib-hossain/rakhal-platform/pull/36).
  Docs/proposal: [#14](https://github.com/md-galib-hossain/rakhal-platform/pull/14). Details:
  `M3-wave2-diff-2026-11-13.md`.
- Wave 2 lessons: the relative-import trap recurs per shared sibling (`./input` in `select.tsx`, `./popover`
  and `./calendar` in the web-only date pickers, `./select` in `labeled-field.tsx`) — grep every component
  for `from "\./<name>"` before any swap, not just the first one; a `vi.mock("@/components/ui/x", ...)` path
  must move with its import (select's wizard test); reconciling a component with no current consumer (tabs,
  labeled-field before their swap PRs) is a safe no-op PR, useful for isolating the behaviour change from the
  256-file import rewrite.
- **Wave 4: done (2026-11-14)** except `pagination` (deferred — see below). All 11 `shared/*` components named
  in the inventory row now come from `@rakhal/ui`; no local copy is left in `apps/web/components/shared`.
  Mechanical swaps (identical apart from import paths): confirm-dialog
  [#39](https://github.com/md-galib-hossain/rakhal-platform/pull/39),
  error-state [#40](https://github.com/md-galib-hossain/rakhal-platform/pull/40),
  row-actions-menu [#41](https://github.com/md-galib-hossain/rakhal-platform/pull/41),
  truncated-text [#42](https://github.com/md-galib-hossain/rakhal-platform/pull/42) (also deleted web's
  byte-identical `truncated-text.test.tsx`, dropping web's test count from 110/1008 to 109/1004 — the new
  baseline for every PR after it),
  mobile-record-card [#43](https://github.com/md-galib-hossain/rakhal-platform/pull/43),
  table-skeleton [#44](https://github.com/md-galib-hossain/rakhal-platform/pull/44),
  empty-state [#45](https://github.com/md-galib-hossain/rakhal-platform/pull/45),
  page-header [#46](https://github.com/md-galib-hossain/rakhal-platform/pull/46).
  Reconciled (web's behaviour ported into `packages/ui` first, then swapped — two PRs each, web wins per
  owner decision "Merge, web wins both"):
  card-skeleton [#47](https://github.com/md-galib-hossain/rakhal-platform/pull/47) (reconcile) +
  [#48](https://github.com/md-galib-hossain/rakhal-platform/pull/48) (swap) — adds `h-full min-h-[220px]`,
  no admin consumer so the reconcile was a safe no-op;
  page-card [#49](https://github.com/md-galib-hossain/rakhal-platform/pull/49) (reconcile) +
  [#50](https://github.com/md-galib-hossain/rakhal-platform/pull/50) (swap) — adds
  `flex-1 min-h-[calc(100vh-6.75rem)]`, changing admin's 3 live pages (audit, farms, users) from short to
  viewport-stretched, unverified by screenshot (no admin visual gate);
  stat-card [#52](https://github.com/md-galib-hossain/rakhal-platform/pull/52) (reconcile) +
  [#53](https://github.com/md-galib-hossain/rakhal-platform/pull/53) (swap) — adds
  `tracking-tight tabular-nums`, changing admin's 1 live dashboard page's numeral rendering, also unverified
  by screenshot. Docs/proposal: [#38](https://github.com/md-galib-hossain/rakhal-platform/pull/38). Details:
  `M3-wave4-diff-2026-11-14.md`.
- Wave 4 lessons: `page-card`/`stat-card`/`empty-state`/`page-header` were the first reconciliations where
  admin already had live consumers on the pre-reconciliation (unreconciled) shared behaviour, unlike every
  wave 1/2 case — reconciling toward web therefore changed admin's current rendering the moment the PR merged,
  not just added a new consumer; flag this explicitly in the PR body when it applies. No admin-side visual
  gate exists, so a pure-CSS admin change is unverified by anything beyond build/typecheck/test passing — this
  is a known, accepted gap for this migration, not a blocker.
- **`pagination`: done** [#55](https://github.com/md-galib-hossain/rakhal-platform/pull/55). Resolved the
  `lib/*` blocker (it imported `PAGE_SIZE_OPTIONS` from `@/lib/hooks/use-cursor-pager`) by giving the shared
  copy its own default page-size array literal instead, keeping `pageSizeOptions` a caller-overridable prop.
  No admin consumer; not gate-covered, same fallback as wave 2's `timeline`/`sonner` (full unit-test suite +
  byte-identical logic otherwise). This closes wave 4 completely — all 12 `shared/*` components now come from
  `@rakhal/ui`.
- **Wave 5: done (2026-11-15).** All 11 components in `M3-wave5-diff-2026-11-14.md`'s scope now come from
  `@rakhal/ui`; no local copy is left in `apps/web/components/ui`/`components/shared` for any of them.
  Proposal/analysis: [#56](https://github.com/md-galib-hossain/rakhal-platform/pull/56). Zero-seam swaps:
  bulk-action-dock [#57](https://github.com/md-galib-hossain/rakhal-platform/pull/57),
  form-sheet [#58](https://github.com/md-galib-hossain/rakhal-platform/pull/58),
  drilldown-filter-bar + drilldown-filter-popover (adds `motion` as a `packages/ui` dependency)
  [#59](https://github.com/md-galib-hossain/rakhal-platform/pull/59). New context providers in
  `packages/ui`'s `lib/`, each wired once in `apps/web`'s own providers, adapting the app's real
  next-intl/nuqs/next-navigation hooks — the pattern this wave introduces for framework-coupled shared
  components (principle 5's "small context," applied for the first time):
  `LocaleProvider`/`useLocale()` [#60](https://github.com/md-galib-hossain/rakhal-platform/pull/60) unblocks
  money-text/money-input [#61](https://github.com/md-galib-hossain/rakhal-platform/pull/61) and the three
  date pickers [#62](https://github.com/md-galib-hossain/rakhal-platform/pull/62);
  `LabelsProvider`/`useLabels()` (added alongside #60, extended in #63) unblocks a handful of translated
  strings `PickerFooter`/`DateTimePicker` need (#62) and `infinite-scroll-footer`
  [#63](https://github.com/md-galib-hossain/rakhal-platform/pull/63);
  `QueryStateProvider` (added in #64, expanded in #65) unblocks `data-table`'s sort param
  [#64](https://github.com/md-galib-hossain/rakhal-platform/pull/64) and, once expanded to also cover
  `next/navigation`'s router/search-params (a wider seam than the proposal scoped — `filter-bar` needed
  more than just `nuqs`), `filter-bar` [#65](https://github.com/md-galib-hossain/rakhal-platform/pull/65).
  `packages/ui` still has zero dependency on `next-intl`/`nuqs`/`next/navigation` themselves — only
  `apps/web`'s adapters do.

The admin app has already diverged from the original copy in some places (shell, `detail-list`, list
components). Those admin-specific components stay in `apps/admin` unless a second consumer appears.

## Procedure for one component

1. `diff` the shared copy against the consumer copy; list real differences (class names, props, a11y).
2. Reconcile in `packages/ui` so it is a superset of what the consumer needs (props kept, defaults equal).
3. In `apps/web`, replace the import (`@/components/ui/x` -> `@rakhal/ui/ui/x`) and delete the local file in
   the same PR. A codemod handles the import rewrite for the whole component's call sites.
4. Run the gate; if any screenshot differs beyond the allowed threshold, the PR does not merge.
5. Admin app: confirm it still builds and its tests pass (it is the other consumer).

## Tokens

Split `app/globals.css` in `apps/web` the same way `packages/ui/src/styles/tokens.css` was split:
base tokens (colours, radius, shadow, fonts, base layer) from the shared package; consumer-only tokens
(`--session-*`, `--cream`, `--state-*`, landing keyframes, sidebar scrollbar) stay in the app. `apps/web`
imports the shared tokens first, then its own file. Dark-mode values must be identical before and after.

## Gate (must be green to merge any dedupe PR)

- `pnpm turbo run lint typecheck test build` for **both** `@rakhal/web` and `@rakhal/admin`.
- Existing Playwright axe checks on `/login` and the main authenticated screens.
- **Visual regression**: screenshot a fixed set of routes (login, dashboard, cattle list, a form sheet, a
  confirm dialog, mobile 375px) in light and dark before and after, with a pixel-diff threshold. The tool
  (Playwright snapshots is the default choice) is set up once in M2 so the baseline exists before M3 starts.
- No new entries in the consumer's bundle report beyond a small tolerance (the route JS budget is 170 KB gz
  per its `ARCHITECTURE.md` section 7).

## When to stop

Dedupe is not an end in itself. Stop a wave when the remaining components are coupled enough that extraction
needs a design change. Leave them in the app and record why in this file.
