# Rakhal Figma Screen Registry

## Figma File

- Project: Rakhal
- Platform: Web Customer Application (`rakhal-consumer-frontend`)
- Figma file key: `SCfMPdxP6vgW1uTxfqCtz7`
- Prototype URL: `https://www.figma.com/design/SCfMPdxP6vgW1uTxfqCtz7/Rakhaal`
- Last reviewed: 2026-07-12

## Rules for AI agents

1. **Never** call `get_metadata`/`get_design_context` on the whole file or on a top-level page id
   (e.g. `732:75`) — the full-file metadata dump is ~2.2M tokens and unusable as context. It has
   already blown the token budget once in this project; don't repeat it.
2. Look up the node ID for the screen you need **in this table first**. Only fall back to a scan
   (see "Finding a node ID that isn't here yet" below) if it's genuinely missing.
3. Call `get_design_context` (or `get_screenshot`/`get_variable_defs`) **only on that one node ID**.
4. Analyze one screen, or one small group of directly-related screens (e.g. a list + its own detail
   drawer), per session — not the whole module.
5. Reuse the tokens/components already documented in `rakhal-design-system.md` and
   `component-inventory.md`. Don't re-derive colors, spacing, radii, or shadows from scratch — they
   don't vary screen to screen in this file.
6. Don't re-analyze the sidebar/topbar/app-shell chrome — it's `Reviewed` below and pixel-confirmed
   in code (`components/layout/**`). Only revisit it if the user says the Figma shell changed.
7. Update this file (status + node ID) whenever you pull a new frame or discover an existing row's
   node ID has moved (Figma node IDs are stable per-file but a frame can be deleted/recreated).

### Status legend
- **Reviewed** — `get_design_context` pulled, spec cross-checked against the live implementation.
- **Located** — node ID known (found via a metadata scan), context not pulled yet. Next agent can
  skip straight to `get_design_context` on this ID — no re-scanning needed.
- **Pending** — not yet located. The frame may or may not exist in the file; the design system
  doc's §"PRD-as-spec fallback" note applies if it turns out there's no Figma frame at all.

### Finding a node ID that isn't here yet
1. `get_metadata` on the module's likely parent page/canvas (this file's file key), **not** the
   whole document — e.g. one canvas at a time.
2. If the result is still too large, grep the saved dump for `name="<ScreenName>"`-style matches
   (see the workflow used to build this registry: `get_metadata` → save to a scratch file → grep for
   the screen name → note the `id="…"` next to it) rather than reading the whole thing.
3. Add the node ID + status to this table before doing anything else with it.

## Application Shell

| Design | Node ID | Status |
|---|---|---|
| Dashboard frame (shell reference/container) | `732:1656` | Reviewed |
| Sidebar / Navbar | `732:1659` | Reviewed |
| Topbar | `732:1695` | Reviewed |
| Mobile navigation | — | Pending (no mobile frames found in the file so far — see `responsive-rules.md`) |

## Authentication

| Screen | Node ID | Status |
|---|---|---|
| Sign In | `1042:63021` | Reviewed |
| Sign Up | `1039:52364` | Reviewed |
| Reset Password (email step) | `1039:52389` | Reviewed |
| Set New Password | `1039:52443` | Reviewed |
| Verify Email | — | Pending — no Figma frame exists (prototype's equivalent flow is OTP-based, which this backend doesn't implement; PRD-as-spec fallback used instead) |

## Dashboard

| Screen | Node ID | Status |
|---|---|---|
| Dashboard — Desktop (full frame) | `732:1656` | Reviewed |
| Production Key Metrics (KPI tile subframe) | `732:1723` | Reviewed |
| Livestock Count (donut subframe) | `732:1737` | Reviewed |
| Livestock State (bar-rows subframe) | `732:1788` | Reviewed |
| Financial-performance legend colors | `732:1872` | Reviewed |
| Dashboard — Tablet | — | Pending |
| Dashboard — Mobile | — | Pending |

## Cattle Management

| Screen | Node ID | Status |
|---|---|---|
| Cattle list ("Cattle") | `1042:57503` | Reviewed |
| Cattle Details — Overview (right-side drawer) | `1042:57748` | Reviewed |
| Cattle Details — Reproduction | `1042:58388` | Located |
| Cattle Details — Health | `1042:58778` | Located |
| Cattle Details — Finance | `1042:59191` | Located |
| Cattle Details — Ancestry | `1042:59721` | Located |
| Add New Cattle (modal) | `1061:38338` | Located — implemented from a raw screenshot export originally (RFE-022); this node ID was found later and hasn't been cross-verified with `get_design_context` yet |
| Edit cattle | — | Pending (Figma only shows one "Add New Cattle" modal; edit reuses the same modal in the real app) |
| CSV import | — | Pending — no Figma frame found; PRD-spec fallback used (RFE-024) |

## Other modules

Not yet located in this session — **don't guess node IDs**. When a ticket first touches one of
these, do a single targeted `get_metadata` scan per the "Finding a node ID" steps above, then add
the row here instead of re-scanning next time.

| Module | Status |
|---|---|
| Reproduction | Pending |
| Calves | Pending |
| Healthcare | Pending |
| Milk | Pending |
| Feed Formulator | Pending |
| Buyers | Pending |
| Finance | Pending |
| Inventory | Pending |
| Scoreboard | Pending |
| Task Hub | Pending |
| Activity Log | Pending |
| Settings | Pending |
| Reports | Pending |
