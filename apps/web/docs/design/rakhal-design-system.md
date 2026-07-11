# Rakhal Design System

Reusable design knowledge extracted from the Figma frames listed as `Reviewed` in
`figma-screen-registry.md` (Auth, Dashboard, Cattle so far). Read this **before** pulling a new
Figma frame — most of what a new screen needs (colors, spacing, radii, shadows, shared components)
is already here and doesn't vary screen to screen in this file.

**Every value below has a "Figma" column (the raw hex/px from the design) and an "App token"
column (what the code actually uses).** They're not always identical — where they differ it's a
deliberate, previously-flagged decision (see the Divergences section), not a mistake. Components
must consume the App token (`bg-primary`, not `bg-[#00a86b]`) — see `ARCHITECTURE.md`/`CLAUDE.md`'s
"semantic tokens only" rule.

## Design tokens

### Colors

| Purpose | Figma | App token (`app/globals.css`) |
|---|---|---|
| Primary / brand | `#00A86B` (primary-500) | `--primary` |
| Primary hover/border | `#00774C` (primary-700) | `--primary-hover` |
| Primary tint | `#E6F6F0` (primary-50) | `--success-tint` (closest existing tint; no dedicated `--primary-tint` yet) |
| Page background | `#EEE`/`#F2F3F5` | `--background` |
| Card / surface | `#FEFEFE` (white-50) | `--card` |
| Heading text | `#000F08` (black-500) | `--foreground` |
| Body text | `#333F39` (black-400) | `--foreground` (app doesn't split foreground this finely) |
| Secondary/label text | `#545E5A` (black-300) | `--muted-foreground` is `#66707A` — close, not exact |
| Muted/placeholder text | `#8A918D` (black-200) | `--muted-foreground` |
| Default border | `#E6E6E6` (white-500) | `--border` is `#E7E9EC` — near-identical, not exact |
| Row divider | `#EBEBEB` (white-400) | `--border` |
| Org-switcher border | `#D1D1D1` (white-600) | `--border` |
| Info / "Fresh"/"Active Breeder" chip | `#007FFF` (blue-500) | `--info` is `#3B82F6` — different blue, close enough to read as "info blue" |
| "Growing" chip | `#06B6D4` (cyan-500) | `--accent-teal` is `#14B8A6` — closest existing teal/cyan token |
| "Dry"/"In Treatment" chip | `#FFA000`/`#E89200` (orange-500/600) | `--warning` is `#F59E0B` — close, not exact |
| Success / positive trend | `#059669` (emerald-600) on `#ECFDF5` tint | `--success` / `--success-tint` |
| Destructive | (no Figma frame shows a destructive state yet) | `--destructive` |
| Female gender glyph | (no Figma variable — picked `rose/400 #FB7185`-adjacent) | `--accent-pink` (`#EC4899`, added 2026-07-12, follows the `--accent-purple`/`--accent-teal` incremental-hue pattern) |

**Full raw Figma palette seen so far** (for reference — prefer the App token column above when
writing code): `indigo/800 #3730A3`, `indigo/50 #EEF2FF`, `blue/300 #54A9FF`, `blue/800 #00468C`,
`blue/50 #E6F2FF`, `green/800 #2C6E42`, `green/50 #EEFAF2`, `rose/400 #FB7185`.

### Typography

- **Figma font family: "Satoshi"** (Medium/Bold weights only seen). **Not loaded in the app** — the
  app ships `Plus Jakarta Sans` (latin) + `Noto Sans Bengali` (bengali) via `next/font` instead
  (RFE-002 decision, unconfirmed visual match — see `DESIGN_SYSTEM.md` §4 Q-21). Don't add a Satoshi
  `next/font` import without a dedicated perf-budget ticket.
- Type ramp (Figma name → size/weight/line-height, all `line-height: 1.4` unless noted):
  - Heading 4 Bold — 24px/700 (page titles, card values)
  - Heading 5 Medium — 20px/500 (section titles, e.g. "Cattle Highlights")
  - Card title (auth only) — 28px/700, `line-height: 1.4`
  - Body/subtitle (auth only) — 16px/500
  - Paragraph 2 Medium — 14px/500 (body text, table cells, input values)
  - Paragraph 2 Bold — 14px/700 (button labels)
  - Caption 1 Medium — 12px/500 (secondary labels, tag numbers)
  - Caption 1 Bold — 12px/700 (status chip text)
  - Caption 2 Bold — 10px/700 (small count badges)

### Spacing

Effectively a 4px base unit (4/6/8/9/12/16/20/24 all appear). No named spacing scale in Figma
beyond that — Tailwind's default scale already covers it 1:1.

- Page gutter (root padding around the whole shell): `10px`
- Card padding: `16px` (outer cards), `12px` (KPI tiles, table pagination bar)
- Section gap (between a page's major blocks): `16–24px`
- Table cell padding: `8px` horizontal, row height `56px` (`54px` for the header row)
- Form field gap: `12px` label→input, `16–20px` between fields

### Borders & radii

| Element | Figma radius |
|---|---|
| Buttons, inputs, small icon tiles | `8px` → App `--radius-sm` (`0.5rem` = 8px) ✓ exact |
| KPI cards, pagination pill container | `12px` → App `--radius-md` (`0.625rem` = 10px) — not exact, close |
| Auth input | `14px` (one-off, `floating-input.tsx` only) |
| Cards, sidebar, table outer container | `16px` → App `--radius-lg` (`1rem` = 16px) ✓ exact |
| Status Chip, avatar | `20px`/full → App `--radius-full` ✓ |
| Pagination page-number pill | `8px` |

Default border width `1px` (Figma sometimes uses `0.75px`/`1.5px` on chips — imperceptible at
screen resolution, use `1px`/`border`/`border-2` as normal).

### Shadows

| Name | Figma value | App token |
|---|---|---|
| Base Shadow | `0px 1px 4px rgba(0,0,0,0.10)` | ad hoc `shadow-xs`/`drop-shadow-[0px_1px_2px_rgba(0,0,0,0.1)]` per component, not unified |
| Card Shadow | `0px 0px 6px rgba(0,0,0,0.10)` | `--shadow-card` = `0px 0px 3px rgba(0,0,0,0.1)` — smaller radius than Figma, established app-wide before pixel-confirmation, low-priority to tighten |

## Application layout

- Sidebar width: `240px`, `16px` rounded, floating in a `10px` page gutter with a `10px` gap to
  the topbar (not flush/full-bleed — see `AppShell`).
- Topbar height: Figma `56px`; app ships `64px` (`h-16`, RFE-005 follow-up, to fit larger icon
  buttons without clipping — a deliberate deviation, not unmatched).
- Desktop content padding: `10px` outer gutter (matches sidebar).
- Mobile content padding: not Figma-sourced — see `responsive-rules.md`.

## Divergences (Figma vs. shipped app — intentional, don't "fix" without a ticket)

1. **Font family**: Figma = Satoshi, app = Plus Jakarta Sans + Noto Sans Bengali.
2. **`--border`/`--muted-foreground`**: app's pre-Figma eye-sampled values (`#E7E9EC`/`#66707A`)
   are close to but not identical to the now-confirmed Figma values (`#E6E6E6`/`#545E5A`/`#8A918D`
   split across two shades). Not yet reconciled app-wide — would touch every screen, out of scope
   for a single-page pass.
3. **`--shadow-card`**: `radius 3` vs Figma's `radius 6` — barely perceptible, not reconciled.
4. **Primary-foreground text is dark, not white**: Figma's solid `#00A86B` fills use white text;
   the app uses dark text (`#171D22`) on that same green — a deliberate WCAG AA fix (white-on-green
   is 3.08:1, fails 4.5:1), confirmed via `tests/e2e/auth.spec.ts` axe checks. Applies to buttons,
   active pagination pills, anywhere `bg-primary` + text would otherwise be white.
5. **Cattle Details is a `Sheet` drawer, not an intercepted route** — matches Figma's visual
   presentation, but implemented as a plain client-side `Sheet` rather than the route-backed
   parallel-route/intercepted-route pattern the original Figma prototype's URL structure implies.
   The `/cattle/:id` page still exists as the deep-linkable route; the drawer is an additional view.
