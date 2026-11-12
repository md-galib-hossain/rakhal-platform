# Rakhal Responsive Rules

## Figma coverage (honest state, 2026-07-12)

Every frame reviewed so far (`figma-screen-registry.md`) is a **1440px desktop canvas**. No tablet
or mobile frame has been found in the file for *any* screen, including ones the registry's example
structure has slots for ("Dashboard — Mobile", "Mobile navigation" etc. are all `Pending` because
they don't exist yet, not because no one's looked). **Don't assume a mobile Figma frame exists —
check the registry, and if it says Pending, treat mobile layout as engineering-convention-driven,
not pixel-sourced** (PRD-as-spec fallback, same rule as any other undesigned area).

## What the app actually does (convention, not Figma)

- **Breakpoints**: Tailwind v4 defaults — `sm 640px` / `md 768px` / `lg 1024px` / `xl 1280px`.
- **Sidebar**: floating card on `lg+`; collapses into a `Sheet` (slide-over) below `lg`. See
  `components/layout/sidebar.tsx` / `app-shell.tsx`.
- **Data tables**: `DataTable` supports an opt-in mobile card-collapse via a `renderMobileCard` prop
  (table hidden below `sm`, cards shown instead) — **not currently wired for the Cattle table**
  (it still renders the full table, horizontally scrollable, below `sm`). Wire `renderMobileCard`
  if a ticket specifically asks for a mobile card view there.
- **Touch targets**: ≥ 44px on interactive elements (buttons, row actions, nav items).
- **Test viewports**: 375px (mobile) / 768px (tablet) / 1280px (desktop) on every page — see
  `DESIGN_SYSTEM.md` §5. No horizontal overflow at 375px is part of Definition of Done.
- **Dark theme**: same story as mobile — no dark Figma frames exist anywhere in the file. Dark mode
  is a derived token set (`.dark` in `app/globals.css`), not pixel-sourced. Verify new components
  render correctly in both themes via computed-style probes; don't chase pixel-exactness against a
  Figma frame that doesn't exist.

## When you do find a tablet/mobile Figma frame

Add it to `figma-screen-registry.md` immediately (status `Located` or `Reviewed`), and update this
file's "Figma coverage" section — it should stop being true that "no mobile frame exists" the
moment one is found.
