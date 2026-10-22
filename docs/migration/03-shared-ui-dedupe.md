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
