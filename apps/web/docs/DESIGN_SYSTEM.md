# Rakhal Consumer Frontend — Design System

**Last verified:** 2026-07-09 · Owner: frontend track

---

## 1. Design source of truth

**Figma prototype:**
`https://www.figma.com/proto/SCfMPdxP6vgW1uTxfqCtz7/Rakhaal?node-id=1042-63021&page-id=732%3A75`
(starting frame `1042:63021`, page `732:75`).

> **✅ Screenshot set analyzed (2026-07-09):** 75 exported UI screenshots now live at
> `D:\Projects\Rakhal\Repos\images\` (grouped per module) and were fully analyzed in
> **`D:\Projects\Rakhal\docs\rakhal-ui-analysis.md`** — per-screen specs, canonical layout patterns,
> extracted (approximate) tokens, component inventory, decisions D-1…D-11 + open questions Q-1…Q-21, and
> per-RFE design deltas. **Read that doc's §5–§7 + your ticket's §4 entries before styling anything**; it
> satisfies resolution-path 2 below for every pictured screen. RFE-002 must pixel-confirm its §6 token
> values and record finals in §4 here.

### ⚠️ Agent access protocol (read before styling anything)
Agents **cannot open the Figma prototype URL directly** (auth + JS app). Resolution order for design input:

1. **Figma MCP (installed 2026-07-09):** the official `figma@claude-plugins-official` plugin (v2.2.50) is
   installed user-scope → remote server `https://mcp.figma.com/mcp`. Tools: `get_design_context`,
   `get_screenshot`, `get_variable_defs`, `get_metadata`, `whoami`, … If the `mcp__figma__*` tools are not
   in your session, they load at session start and **require one-time Figma OAuth** (`/mcp` → figma →
   browser sign-in — the user must do this interactively). File key `SCfMPdxP6vgW1uTxfqCtz7`; pass your
   ticket's frame node-id (e.g. starting frame `1042:63021`, page `732:75`). This is the preferred path.
2. **Screenshots**: ask the user for exported screenshots of the specific frames your ticket covers
   (desktop + mobile if both exist). Attach filenames to the ticket row in `PROJECT_PROGRESS.md`.
3. **PRD-as-spec fallback**: many sections/metrics were invented during backend planning and **do not exist
   in the Figma at all** (deliberate — the prototype is incomplete). For those, the PRD section referenced on
   your ticket **is** the spec: build them with the established tokens + shared components, matching the look
   of neighboring designed sections. Never block on missing design for a PRD-specified feature; never invent
   *new* visual language for it either.

Whatever the source, **specs land in this file** (§2–§4) the first time they're extracted, so the next agent
doesn't re-ask. This file is append-only per section, hot-shared — re-read immediately before editing.

## 2. Tokens (Tailwind v4 — `@theme` in `app/globals.css`)

Tailwind v4 is CSS-first: there is **no `tailwind.config.js`**. All tokens are CSS variables declared under
`@theme` in `app/globals.css`; dark mode overrides them under `.dark`. Components consume semantic utilities
(`bg-background`, `text-muted-foreground`, `border-border`…) — **raw hex/arbitrary values in components are
review-blockers.**

Token set to define in RFE-002 (values extracted from Figma; placeholders until then):

```css
@theme {
  /* Semantic color — light values; .dark swaps them */
  --color-background / --color-foreground
  --color-card / --color-card-foreground
  --color-primary / --color-primary-foreground      /* Rakhal brand green (extract exact hex) */
  --color-secondary / --color-muted / --color-muted-foreground
  --color-accent / --color-destructive / --color-warning / --color-success
  --color-border / --color-input / --color-ring
  /* Charts (dashboard widgets) */
  --color-chart-1 … --color-chart-5
  /* Radii + spacing scale + shadows */
  --radius-sm / --radius-md / --radius-lg
  /* Typography */
  --font-sans: <Latin font>, "Noto Sans Bengali", sans-serif;   /* via next/font, subset bn+latin */
}
```

Status badge colors (cattle status, task priority, health case, invoice status…) are **semantic tokens**, not
per-feature hexes: `--color-status-{active,sold,deceased,dry,pregnant,…}` — defined once, reused everywhere.

## 3. Component inventory

### `components/ui/` (primitives — Radix + tokens, shadcn-style, owned in-repo)
Button · Input · Textarea · Select · Checkbox · RadioGroup · Switch · Dialog · Sheet (mobile drawers) ·
DropdownMenu · Popover · Tooltip · Tabs · Badge · Card · Table (styling shell) · Calendar/DatePicker ·
Combobox · Avatar · Progress · Separator · Skeleton · Command (for global search ⌘K) · Sonner toaster.

### `components/shared/` (app-aware composites — build once, in RFE-004)
- **DataTable** — TanStack Table; cursor pagination ("load more"/infinite), URL-synced filters/sort, row
  selection (bulk ops), column visibility, loading/empty/error states, mobile card-collapse.
- **PageHeader** — title, description, breadcrumb, primary action slot.
- **StatCard** — label, value, delta arrow, optional sparkline (dashboard KPIs, module highlight bars).
- **ChartCard** — title, range picker, dynamic-imported chart child, export slot.
- **EmptyState / ErrorState / TableSkeleton / CardSkeleton**.
- **ConfirmDialog** — destructive-action confirmation (archive cattle, void txn, delete shed).
- **FilterBar** — debounced search (300ms), select filters, date-range; serializes to URL params.
- **FileUpload** — client type/size validation, progress, preview (cattle photo, CSV import, task photo).
- **FormSheet / FormDialog** — standard create/edit containers (RHF + zod wired).
- **MoneyText / DateText** — locale-aware ৳ + date rendering (wraps `lib/format.ts`).
- **CattlePicker** — search-select of the farm's animals (used by milk log, health case, repro events, tasks).

### `components/layout/`
AppShell (sidebar PRD §6.1 + topbar §6.2, responsive: sidebar → sheet on mobile) · Sidebar (module nav,
active states, Upgrade-to-Pro banner on Free tier) · Topbar (global search → `GET /search` via Command
palette, NotificationBell with unread badge, theme toggle, avatar menu incl. On-Duty toggle + language
toggle) · OrgSwitcher (farms list + switch-organization flow).

## 4. Extracted specs (append as discovered)

**RFE-002 (2026-07-09) — implemented and verified live** (see `app/globals.css`, `lib/format.ts`,
`app/layout.tsx`, `i18n/`):

- **Tokens live in `app/globals.css`** under `:root`/`.dark` + `@theme inline` — the full semantic set from
  `rakhal-ui-analysis.md` §6.1 (background/card/primary/sidebar/status×4/accent×3/chart×5/radii). Values are
  still eye-sampled approximations (source screenshots, not pixel-picked Figma) — swap in exact hexes here
  when Figma access exists; the *names* are final, do not rename without an ADR.
- **Dark theme (`.dark`)** is derived (no dark screenshots exist — ui-analysis.md decision D-11): sidebar
  stays dark green in both themes, surfaces/borders lifted, chart/status hues brightened for contrast.
  Verified live via `preview_resize colorScheme` + `next-themes` — flag for design review when real dark
  frames arrive.
- **Fonts:** `next/font/google` — `Noto_Sans_Bengali` (`--font-bengali`, subset `bengali`) +
  `Plus_Jakarta_Sans` (`--font-latin`, subset `latin`), both variable, `display: swap`. `--font-sans` stacks
  latin→bengali. Confirmed rendering correctly for both locales live (see below). Exact family match to the
  Figma mock is unconfirmed (ui-analysis.md Q-21) — Plus Jakarta Sans is the closest visual match by eye.
- **i18n — no URL locale routing.** This is an authenticated app (not per-locale marketing pages), so locale
  is a cookie-persisted user preference (`NEXT_LOCALE` cookie, `lib/constants/i18n.ts` is the single source
  of truth for `locales`/`defaultLocale`/cookie name), not a route segment. `i18n/request.ts` reads the
  cookie server-side; `lib/i18n/set-locale.ts` is the server action the topbar toggle (RFE-005/007) calls —
  it owns only the cookie half, RFE-007 additionally calls `PATCH /auth/me/language` once auth exists.
  **`bn` is the default** (confirmed by product 2026-07-09: Bangla-first, English via an easy topbar switch).
  Message catalogues: `i18n/messages/{bn,en}.json`, namespaced (`common`, `nav`, `topbar`, `theme`,
  `upgrade` so far) — add new keys namespaced by feature, per IN_FLIGHT.md's i18n merge-discipline rule.
- **Numerals: Latin digits in BOTH locales** — resolves ui-analysis.md Q-2. The screenshots use Latin digits
  throughout (even conceptually-Bangla UI), and product confirmed no separate decision was needed. Enforced
  via the `-u-nu-latn` Unicode extension on `bn` Intl calls (plain `bn-BD` defaults to Bengali digits ০-৯).
- **Money: lakh/crore grouping in BOTH locales** (ui-analysis.md D-4) — `lib/format.ts#formatMoney` uses
  `bn-BD-u-nu-latn` / `en-IN` (NOT `en-BD` — verified in Node's ICU that `en-BD` does *not* group as lakhs,
  only `en-IN` does) and manually prepends `৳` (relying on `style:'currency'` puts the symbol as a *suffix*
  in `bn-BD`, contradicting every screenshot). See `docs/ARCHITECTURE.md` §4 for the full note.
- **Theme toggle:** `next-themes` (`attribute="class"`, `defaultTheme="system"`) wired via
  `providers/theme-provider.tsx` → `providers/app-providers.tsx` (also hosts a theme-aware `sonner` Toaster).
  Verified: system dark → tokens flip correctly; light → `#f2f3f5` canvas matches the screenshots exactly.

> _Empty. First agent to pull a Figma frame or receive screenshots: record exact palette hexes, type scale,
> spacing base, card radius/shadow, sidebar width, breakpoint behavior here._

## 5. UX conventions

- **Bangla-first**: default locale `bn`; language toggle in avatar menu persists via `PATCH /auth/me/language`
  and swaps `next-intl` locale. Numbers: use Bangla numerals only if the Figma does — decide in RFE-002 and
  record here.
- Mobile-first responsive; test 375 / 768 / 1280 on every page. Touch targets ≥ 44px.
- Destructive = ConfirmDialog, never instant. Mutations show pending state on the button.
- Every module landing page = PageHeader + highlight StatCards + primary list/table (mirrors PRD layouts).
- Read-only mode (expired subscription): write buttons disabled with tooltip + renewal CTA, driven by
  `GET /subscription` status — do not hide them.
