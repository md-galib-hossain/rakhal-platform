# Rakhal Component Inventory — Figma ↔ Code

Maps the reusable components Figma's generated code refers to by name (e.g. `data-name="Chip"`,
`data-name="KPI"`) to what actually exists in the codebase. Check here before building a "new"
component — it's very likely already built, just under a different name.

## Primitives (`components/ui/` — Radix + tokens, shadcn-style)

| Figma name | Code |
|---|---|
| Buttons | `components/ui/button.tsx` (`Button`, variants: primary/secondary/destructive/outline/ghost/inverse) |
| Input Field | `components/ui/input.tsx`; auth-only floating-label variant: `components/ui/floating-input.tsx` |
| Input Field (stacked label) | `components/ui/labeled-field.tsx` (`LabeledInput`/`LabeledSelectTrigger`) — the Add-Cattle-modal field chrome, distinct from `FloatingInput` |
| Select/Dropdown | `components/ui/select.tsx` |
| Filter (icon + "Filter" pill button) | Not a 1:1 port — the app uses `components/shared/filter-bar.tsx`'s inline selects instead of a single "Filter" panel trigger (RFE-021 decision, more filters than the mock pictures) |
| Chip (outline status pill: white fill, colored border+text) | `components/ui/chip.tsx` (`Chip`, added 2026-07-12 for the Cattle table) — **distinct from `Badge`** |
| Badge (solid tint fill) | `packages/ui/src/components/ui/badge.tsx` (`Badge`, imported from `@rakhal/ui/ui/badge`) — the app's default status style everywhere except the Cattle list/health columns |
| Trend Chip (green pill, up-arrow + %) | inlined per-usage (`TrendChip` in `cattle-highlights-bar.tsx`, dashboard widgets) — not yet a shared primitive; consider promoting if a 3rd usage appears |
| Table Component (generic cell wrapper) | `components/ui/table.tsx` (`Table`/`TableHeader`/`TableRow`/`TableCell`) |
| Pagination | `components/shared/pagination.tsx` (`Pagination`, added 2026-07-12) — presentational only, see its own doc comment for the cursor-adapter pattern used to drive it |
| Organization (farm switcher pill) | `features/farm/**` + `components/layout/sidebar.tsx`'s org switcher |
| Navbar Options (sidebar nav item) | `components/layout/sidebar-nav.tsx` |
| Subscription Bar / "Become a PRO!" card | `components/layout/upgrade-ad.tsx` (`UpgradeAd`) |
| KPI (icon-tile stat card) | `components/shared/stat-card.tsx` (`StatCard`) for the dashboard's 2×2 grid; `HighlightTile` (local to `cattle-highlights-bar.tsx`) for the Cattle page's row-of-4 — same visual language, not yet unified into one shared component |
| Avatar / thumbnail | `components/ui/avatar.tsx` |
| Sheet (right-side drawer) | `components/ui/sheet.tsx` — the standard modal pattern app-wide (2026-09-03: `Dialog`/`DialogContent` retired for every form/confirm/detail modal in favor of this; `components/ui/dialog.tsx` remains only as the primitive backing `command.tsx`'s ⌘K palette, not for app modals) |
| Tabs (pill tab bar) | `components/ui/tabs.tsx` |
| Search (pill input + icon) | `components/shared/filter-bar.tsx`'s `SearchInput` (list pages), `components/shared/global-search.tsx` (topbar ⌘K) |
| Checkbox (row selection) | `components/ui/checkbox.tsx` |
| Progress bar | `components/ui/progress.tsx` |
| Calendar/date picker | `components/ui/calendar.tsx` |

## Composites (`components/shared/` — app-aware, built once)

| Purpose | Code |
|---|---|
| Cursor-paginated data table | `components/shared/data-table.tsx` (`DataTable`) — TanStack Table, row selection, sort, loading/empty/error states. Pairs with `Pagination` (footer) or its own built-in "Load more" (`hasNextPage`/`onLoadMore`, unused when `Pagination` drives paging instead) |
| Page title + all child cards in one card | `components/shared/page-card.tsx` (`PageCard`) — not Figma-sourced, a user-requested wrapper pattern (2026-07-11), reused on every module page |
| Chart card | `components/shared/chart-card.tsx` (`ChartCard`) |
| Confirm/destructive-action dialog | `components/shared/confirm-dialog.tsx` (`ConfirmDialog`) |
| Money / date formatting | `components/shared/money-text.tsx`, `components/shared/date-text.tsx` |
| Cattle search-select | `components/shared/cattle-picker.tsx` (`CattlePicker`) |
| File/photo upload | `components/shared/file-upload.tsx` (`FileUpload`) |
| Create/edit form container | `components/shared/form-sheet.tsx` (`FormSheet`) — `form-dialog.tsx` was removed 2026-09-03 in the modal-unification sweep, all callers migrated |
| Loading/empty/error states | `components/shared/card-skeleton.tsx`, `components/shared/table-skeleton.tsx`, `components/shared/empty-state.tsx`, `components/shared/error-state.tsx` |

## Feature-specific patterns worth reusing

- **Dashed header/footer separator inside a sheet** (`<div className="border-t border-dashed border-border" />` between the title row and body, and between body and the button row) — established by `cattle-form-dialog.tsx`, reused by `cattle-detail-sheet.tsx`, and applied to every `SheetFooter` app-wide as of the 2026-09-03 modal-unification sweep. Use this instead of relying on `Sheet`'s default solid border.
- **Equal-width footer buttons** (`Cancel` secondary + primary action, both `h-12 flex-1`) — same two components above.
- **Remount-key pattern for "fresh state on open"** (`key={targetId ?? "create"}` on an inner body component, outer wrapper stays mounted) — avoids a `set-state-in-effect` React Compiler violation. Established by `CattleFormDialogBody`, reused by `MilkSessionTable`.
- **Outline `Chip` vs solid `Badge`**: use `Chip` only where the Figma frame shows a white-fill/colored-border pill (currently just the Cattle list's Status/Health columns). Everywhere else, `Badge` (solid tint) remains the default — don't swap existing `Badge` usages to `Chip` without a Figma frame confirming the outline style there too.
