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
- **Wave 3** (`shared/*`): analysis done (2026-11-14), proposal awaiting owner approval (3 decisions needed —
  `page-card` and `stat-card` already have admin consumers on the *shared* behaviour, so reconciling toward web
  changes admin's live rendering, not just adds a consumer; `pagination` has no shared copy and a blocking
  `lib/*` import): `M3-wave3-diff-2026-11-14.md`. No component PRs started.

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
