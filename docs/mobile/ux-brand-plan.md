# Rakhal Mobile - UX and Brand Audit + Plan

Status: proposal for owner review. Plan only; no app code. Author: Forma (Product Designer / UI/UX Engineer), 2026-11-11.
Scope: `apps/mobile` (React Native + Expo, ADR-005), not yet built.

Legend: **[V]** verified by reading the cited file. **[A]** assumption or inference, not verified. Paths are abbreviated:
`FE` = `D:\Projects\Rakhal\Repos\rakhal-consumer-frontend`, `PLAT` = `D:\Projects\rakhal-platform`,
`UIA` = `D:\Projects\Rakhal\docs\rakhal-ui-analysis.md`.

---

## 1. Brand extraction

### 1.1 Colour (light + dark) [V]

Source of truth: `FE/app/globals.css` (`:root` lines 14-98, `.dark` lines 100-155). `PLAT/packages/ui/src/styles/tokens.css` is a
verbatim copy at web commit 9af1681 (its line 1 says so) minus domain tokens, so it can drift (see 2.3).

| Role | Light | Dark | Cite |
|---|---|---|---|
| background (canvas) | `#f2f3f5` | `#10151a` | globals.css:16 / :104 |
| foreground | `#171d22` | `#eef1f3` | :17 / :105 |
| card / popover | `#ffffff` | `#171d22` | :18,:20 / :106,:108 |
| **primary** (brand green) | `#00a86b` | `#1ec883` | :24 / :111 |
| primary-hover | `#00774c` | `#00a86b` | :25 / :112 |
| primary-foreground | `#171d22` (dark text) | `#08130c` | :30 / :113 |
| sidebar (deep green) | `#055640` | `#06301f` | :31 / :114 |
| secondary / muted / accent | `#f5f6f7` | `#1c2329` | :36-40 / :118-123 |
| muted-foreground | `#66707a` | `#9aa7b0` | :39 / :121 |
| border / input | `#e7e9ec` | `#262e35` | :42-43 / :124-125 |
| ring | `#00a86b66` | `#1ec88366` | :44 / :126 |
| success / tint | `#16a34a` / `#e7f6ee` | `#22c55e` / `#123420` | :47,:49 / :128,:130 |
| warning / tint | `#f59e0b` / `#fef4e6` | `#fbbf24` / `#3a2c08` | :50,:52 / :131,:133 |
| destructive / tint | `#ef4444` / `#fdecee` | `#f87171` / `#3a1414` | :53,:55 / :134,:136 |
| info / tint | `#3b82f6` / `#eaf2fe` | `#60a5fa` / `#0f2a4a` | :56,:58 / :137,:139 |
| accent hues purple/teal/indigo/pink | `#8b5cf6 #14b8a6 #6366f1 #ec4899` (+ tints) | lighter variants | :61-70 / :141-148 |
| text-on-tint (AA for small text) | destructive `#b91c1c`, warning `#92400e`, primary `#047857`, info `#1d4ed8` | = brand token | :373-384 |
| milk session accents | morning `#0082fd`, noon `#faa70c`, evening `#df4e00`, night `#333333` (not themed) | same | :76-79 |
| herd-state set (fresh, insemination, dry, milking, pregnant, sick: bar/tint/text) | see file | see file | :319-368 |
| chart series | `#16a34a #ef4444 #3b82f6 #f59e0b #8b5cf6` | `#22c55e #f87171 #60a5fa #fbbf24 #a78bfa` | :82-86 / :150-154 |
| landing cream | `#faf7ef` | `#14191f` | :240,:243 (marketing only; skip on mobile) |

Provenance caveats [V]: only `--primary` (#00A86B), `--primary-hover` (#00774C) and light `--sidebar` (#055640) are pixel-confirmed
against Figma; the rest is eye-sampled (globals.css:4-12). Dark theme is **derived**, no Figma dark frames exist
(globals.css:101-103; UIA decision D-11, UIA:1219). The mobile dark theme inherits that "needs design review" status.

Contrast contradiction to resolve [V]: `--primary-foreground` is dark `#171d22` because white on `#00a86b` is 3.08:1 and fails AA
(globals.css:26-29), yet the web `Button` primary deliberately uses a literal white label (`PLAT/packages/ui/src/components/ui/button.tsx:10-13,20`).
Mobile must pick one rule (see Q3). Recommendation: dark label on brand green for body-size buttons, white only at >=18.66px bold (large text, 3:1).

### 1.2 Typography [V unless noted]

- Families: `Inter` (latin, `--font-latin`) + `Noto Sans Bengali` (`--font-bengali`), both `next/font/google`, `display: swap`
  (`FE/app/layout.tsx:2,9-19`). Stack: latin -> bengali -> system (`FE/app/globals.css:222`).
- **Doc drift**: `FE/docs/DESIGN_SYSTEM.md:117-120` and UIA:1048-1050 say Plus Jakarta Sans; the code ships Inter. The Figma frames use
  Satoshi (DESIGN_SYSTEM.md:153-156) but it is not loaded. So the real brand typeface is unresolved (Q1). `PLAT/apps/admin/app/layout.tsx:2`
  uses Inter only.
- `PLAT/packages/ui/src/styles/tokens.css:198` defines `--font-sans: var(--font-latin), system-ui, sans-serif` and **omits the Bengali
  fallback** the web has. Anything built on that package renders Bangla in a system font. Not a mobile blocker but a shared-token bug.
- Scale (approx, eye-sampled; UIA:1051-1054): H1 26-28/semibold, H2 20/semibold, card title 16-18/semibold, stat value 26-30/semibold,
  body and table 14/regular, label 12-13/medium, button 14/semibold (web `Button` `text-sm font-semibold`, button.tsx:16), badge 12/medium.
  Line height ~1.4 body, ~1.2 headings.
- Numerals: **Latin digits in both locales** (DESIGN_SYSTEM.md:129-131), enforced via `bn-BD-u-nu-latn` (`FE/lib/format.ts:9-17`).
- Money: `৳` prefix, lakh/crore grouping, no decimals, both locales (`FE/lib/format.ts:19-25`; UIA D-4, UIA:1207).

### 1.3 Radius, spacing, elevation [V]

- Radius tokens: sm 0.5rem (8), md 0.625rem (10), lg 1rem (16), full (globals.css:89-92). Card 16, button/input 10-12, tile 10, badge/pill
  full (UIA:1060-1061). Auth card is 20 (DESIGN_SYSTEM.md:148), auth input 52px high / 14 radius (:151).
- Spacing: no token scale; documented values: page padding 24-28, section gap 24, card padding 20-24, field gap 16 (UIA:1057-1058).
  Web is desktop-first density; these must shrink on phone (see 3.4). Tailwind's 4px base is the implicit grid [A].
- Elevation: nearly flat. `--shadow-card: 0 0 3px rgba(0,0,0,.1)` (globals.css:97); borders carry separation; overlays
  `0 24px 48px rgb(0 0 0/.12)` (UIA:1062-1063); auth card `0 12px 16px rgba(0,0,0,.12)` (DESIGN_SYSTEM.md:149).
- Focus: ring `--ring` 40% green, no ring-offset (DESIGN_SYSTEM.md:208-223 pitfall); not applicable to touch, but keep a visible focus
  style for hardware-keyboard/TalkBack.

### 1.4 Iconography [V]

`lucide-react`, 20px line icons in the sidebar (UIA:957), deliberately chosen over Figma's placeholder icons (DESIGN_SYSTEM.md:186-189).
Mobile equivalent: `lucide-react-native` (same glyph names, same stroke style) [A, not yet checked in the Expo compat table].

### 1.5 Logo [V]

- Assets: `FE/public/logo-mark.svg`, `FE/public/auth/logo-mark.svg`, `FE/public/rakhal-full-logo.jpg` (not opened), `FE/public/auth/auth-side-image.png`.
- `logo-mark.svg` is a 110x24 horizontal wordmark "Rakhal." with **white** letter fills and **lime `#D9EC26`** for the first letter and the full stop
  (`--fill-0` fallback, svg lines 10-11). It is only legible on deep green (`--sidebar #055640`): used as a 28px mark + "Rakhal" 24px bold on the
  sidebar, divider `#00774C` (DESIGN_SYSTEM.md:170-173). **Lime `#D9EC26` exists in the logo only, not in any token.**
- Mobile needs: a light-surface logo variant (does not exist), an app icon, a splash (green `#055640` plus the white/lime mark works as-is).

### 1.6 Tone of voice [V/A]

No written voice guide found. Inferred from the product law and the docs: Bangla-first (default locale `bn`, English via an easy switch,
DESIGN_SYSTEM.md:126, 199), plain operational language ("Supplier" not "Vendor" on payables, UIA D-5), mutation feedback by toast, destructive
actions confirmed (DESIGN_SYSTEM.md:203). Recommendation for mobile copy: second-person, verb-first, short, one idea per line; no jargon
(say "দুধ লিখুন" not "Submit milk record"); error text states what happened and what the user can do next.

### 1.7 Bangla / English handling [V]

`bn` default, cookie-persisted `NEXT_LOCALE`, namespaced catalogues `i18n/messages/{bn,en}.json` (`FE/CLAUDE.md` hard rules, DESIGN_SYSTEM.md:121-128).
Session names derive from farm settings, never hard-coded (UIA D-3, UIA:1205). Role display names unresolved (UIA Q-6).

### 1.8 App-shell and component patterns [V]

Sidebar 240px floating, dark green (DESIGN_SYSTEM.md:170-180); topbar 56px; canonical modules: Dashboard, Cattle, Feed Formulator, Milk, Finance,
Healthcare, Inventory, Scoreboard, Task Hub / Activity Log, Settings, plus Buyers/Reproduction/Calves/Reports (UIA:1223-1226, DESIGN_SYSTEM.md:185-190).
Status badges are semantic tokens (DESIGN_SYSTEM.md:75; UIA:1044-1045). Web has `EmptyState`, `ErrorState`, `StatCard`, `MobileRecordCard`,
`CardSkeleton`, `ConfirmDialog` in `PLAT/packages/ui/src/components/shared/` (EmptyState: 48px icon disc, title + description + action).

### 1.9 How the admin app applies brand [V, limited]

`PLAT/apps/admin` imports the same base tokens and Inter only (`apps/admin/app/layout.tsx:2`). It confirms the tokens package works for a second web
consumer; it adds no mobile-relevant brand decisions. I did not open admin component files beyond the layout import.

---

## 2. Gap analysis: share vs re-express

ADR-005 decision 4: tokens "as plain data" are shared; `@rakhal/ui` (radix + Tailwind) is **not** (ADR-005:26-29). A package needs two consumers.

### 2.1 Reality check

Tokens today exist only as **CSS custom properties** in two copies (`FE/app/globals.css`, `PLAT/packages/ui/src/styles/tokens.css`). React Native
cannot read CSS variables. "Plain data" therefore requires a new source of truth.

### 2.2 Recommendation: `@rakhal/tokens` (TS data, source-exported)

| Token group | Shareable as data? | Mobile expression | Notes |
|---|---|---|---|
| Colours light/dark (1.1) | Yes, hex strings | JS theme object via a ThemeProvider; NativeWind CSS-variable theme optional | Convert `#rrggbbaa` ring to rgba. Drop `--sidebar*`, `--cream`. |
| Status/herd-state/session colours | Yes | same | Needed on mobile (cattle status, milk sessions); lives in app code today, move into tokens package. |
| Radius | Yes, numbers | px numbers (8/10/16/9999) | rem -> px at 16px base. |
| Spacing scale | Define now (no source) | 4/8/12/16/20/24 | New; web only has ad-hoc Tailwind values. |
| Shadow | Re-express | RN `elevation` (Android) + `shadow*` (iOS) | CSS box-shadow strings do not port. `shadow-card` is ~flat; use 1dp + border. |
| Font families | Names only | `expo-font` / `@expo-google-fonts/*` | Web uses `next/font`; load via Expo. Check bundle cost (Q1). |
| Type scale | Define now (pixel-sampled only) | `Text` presets | Needs mobile-specific larger sizes (3.4). |
| Money/number/date formatters | Yes, but belongs to `@rakhal/domain`, not tokens | Same `Intl` calls | **Hermes `Intl` support must be verified**: `bn-BD-u-nu-latn` and `en-IN` lakh grouping are known to differ on Android JS engines [A, unverified]. Test on a mid-range device before depending on it. |
| Iconography | Names only | lucide-react-native | |
| Animations (`hero-zoom`, tw-animate) | No | Reanimated | Web-only. |

### 2.3 Concrete tasks and risks

- Single source of truth: generate CSS (`tokens.css`) **and** TS (`tokens.ts`) from one `tokens.json`, or the web's `globals.css` and the mobile theme
  drift (they already drifted once: Bengali font fallback missing at `tokens.css:198`; `tokens.css` excludes status tokens that web components use).
  This touches web files, so it is a separate, owner-approved ticket; **mobile must not edit `FE` or `packages/ui` unilaterally**.
- ADR-005 rule 4 says "design tokens as plain data" is shared but names no package. Creating `@rakhal/tokens` needs two consumers. Mobile is
  one; the second is the CSS generator for web/admin. Decide whether that counts (Q4); otherwise start with `apps/mobile/src/theme/tokens.ts` and
  extract later.
- Fonts are not "shareable": `Noto Sans Bengali` must be shipped as assets in the app binary or downloaded; the Bengali glyph set is large (budget it, 3.7).

---

## 3. Mobile UX principles (prioritized)

Audience: owners/managers (smartphone fluent, decision-oriented, glance at numbers) and workers (low literacy, gloves/wet hands, sunlight, one hand,
patchy 2G/3G). Primary jobs [A, derived from PRD module list in CLAUDE.md]: milk log, feeding, health event, task check-off, cattle lookup.
Web's own rules already require loading/error/empty/data states on every view and a11y (FE/CLAUDE.md hard rules); mobile adopts them.

### P0 (must ship in the first slice)

1. **Touch targets.** Minimum 48dp for every control; primary actions 56dp; 8dp minimum gap. Web already requires 44px (UIA:1265; Button `md` h-11,
   `button.tsx:30`); mobile raises it because of gloves/outdoor use. Hit slop on icons.
2. **One-handed use.** Primary action in the bottom third (sticky bottom action bar, FAB only for the single most frequent action per screen); bottom
   tab bar, not drawer sidebar (replace the web's 240px sidebar). Destructive and rare actions go top or into an overflow sheet, never next to the primary.
3. **Sync state always visible.** One persistent, tiny status element (online / offline / syncing / N waiting / error) in the header, with a detail
   sheet. Every record row shows a state glyph: saved on server, waiting to sync, failed (with retry). Never silently drop a write. Copy is plain
   ("সার্ভারে সেভ হয়েছে" / "ইন্টারনেট এলে পাঠানো হবে"). Needs ADR-006 (06-mobile-track X3) first; **no offline screen before it**.
4. **Bangla-first readability.** `bn` default; Bangla body >= 16sp (Bengali glyphs have smaller x-height and conjuncts need more line height: body
   line-height >= 1.6, vs web 1.4); no all-caps; no truncation of Bangla labels by ellipsis if avoidable (wrap to two lines); never concatenate
   translated fragments; respect Android system font scale up to 200% without clipping. Latin digits per product decision (1.2), with a quarterly
   check that workers read them without trouble (Q5).
5. **Fast daily logging.** Milk log and feeding are the core loops; design for <= 3 taps and <= 20 seconds per animal entry:
   - Sessions come from farm settings, default to the session matching the clock, pre-selected (UIA D-3).
   - Numeric entry with a large custom number pad (decimal point, step +/- 0.5 L), unit suffix inside the field, last value shown as a ghost hint.
   - Auto-advance to the next animal after save; swipe-free (swipes conflict with scroll and gloves).
   - Cow identification by large tag number + photo thumb, with search by tag and (later) QR/barcode scan.
   - Save is immediate to local store and confirmed by haptic + brief inline check, not a blocking spinner.
   - Undo for 5 seconds after each save (cheaper than confirm dialogs).
6. **State views on every data surface.** Loading = skeleton shaped like the final rows (not a spinner on blank); Empty = icon + one sentence + the
   one action to fix it ("এখনো কোনো গরু নেই - গরু যোগ করুন"); Error = what failed + retry + works-offline note where true; Offline-stale = show cached
   data with "last updated" stamp, never an empty screen. Mirrors web `EmptyState`/`ErrorState` (`packages/ui/.../empty-state.tsx`) but with larger type.
7. **Colour is never the only signal.** Status uses icon + text + colour (web rule, UIA:1254-1256). Outdoor glare: keep text contrast >= 4.5:1,
   prefer >= 7:1 for numbers; use the `*-text` colours on tints (globals.css:373-384).
8. **Role-safe UI.** Hide manager-only actions for workers using permission flags, not role strings (web `<Can I="resource.action">`); backend still
   enforces. Matches 06-mobile-track X2 check ("a worker must see no manager-only action").

### P1 (first release)

9. **Forgiving forms.** Single column; labels above fields (floating-label overlap from web is hard to tap/read at small sizes - do not port it);
   inline validation on blur; server 422 mapped to fields; keyboard type per field (decimal, numeric, phone); preserve input on error and on app
   backgrounding.
10. **Confirm only what is irreversible.** Soft-delete/archive gets undo snackbar; hard destructive gets a bottom-sheet confirm with a verb button
    ("মুছে ফেলুন"). Mirrors web ConfirmDialog rule (DESIGN_SYSTEM.md:203).
11. **Low-literacy supports.** Icon + label together on primary navigation (no icon-only); consistent icon per concept (milk = drop, health = cross);
    colour-coded sessions (morning/noon/evening/night tokens, globals.css:76-79); optional voice read-out [A, backlog, out of scope here].
12. **Performance on mid-range Android.** Lists virtualised (FlashList or FlatList with tuned windows); no blur, no shadows heavy per row; images
    sized and cached; cold start budget [A: target < 3s on a ~3 GB RAM device, to be confirmed with the owner]; JS thread animations avoided
    (Reanimated, native driver).
13. **Dark mode.** Follow system; both themes from the same token data. Because web dark is unvalidated (1.1), dark is P1, light-first, flagged for
    review. Do not keep the web's "sidebar stays dark" rule (no sidebar on mobile).
14. **Accessibility.** `accessibilityLabel` in the active language; TalkBack/VoiceOver reading order; respect `reduce motion` and font scale;
    focus order for forms; 4.5:1 contrast verified per token pair by a script, not by eye.
15. **Connectivity honesty.** Distinguish "no network" from "server error" from "session expired". 401/revoked = forced logout with a clear message
    (06-mobile-track X2); never a generic "something went wrong".

### P2 (later)

16. Home dashboard compressed to 3-4 glanceable tiles (today's yield, tasks due, sick animals, feed stock low) mirroring the web StatCard rhythm
    (UIA:988) but with larger numerals; charts only as sparkline.
17. Notifications (needs SMS/push decisions; blocked per project memory).
18. Tablet/landscape layout. Not a target in the first release.

### 3.4 Mobile density translation of web values [A]

| Web value | Mobile |
|---|---|
| page padding 24-28 | 16 (screen), 12 inside cards |
| card radius 16 | 16 (keep brand recognisability) |
| button h 44 / input 52 (auth) | 48 min / 56 primary; inputs 52-56 |
| body 14 | 16 (Bangla), 15 (Latin-only UI chrome) |
| table | list of cards (web `MobileRecordCard` precedent) - never horizontal-scroll tables |
| dashed separators, drawers, hover states | not ported; bottom sheets and pressed states |
| sidebar 240 | bottom tab bar: 4-5 destinations (Home, Cattle, Milk, Tasks, More) [A] |

---

## 4. Plan: ordered work packages

No dates. Owner roles: **Forma** (design + RN UI engineering), **Structa** (architecture / packages), **Codex** (implementation),
**Prisma** (requirements), **Verity** (verification). Each WP depends on the previous unless noted; all gated by 06-mobile-track X0/X1 (M4
contracts green, ADR-005 decisions 4 and 5 signed off, scaffold exists).

### WP1 - Brand decisions and token data (`apps/mobile/src/theme` first, `@rakhal/tokens` if Q4 = yes)
- Owner: Forma defines, Structa decides package boundary, Codex implements.
- Work: resolve Q1-Q3; write `tokens.ts` (light+dark, status/session/herd-state, radius, spacing, type scale, elevation) from 1.1-1.3; add a
  contrast-check script over every foreground/background pair; light-surface logo + app icon + splash assets.
- Acceptance: every colour in 1.1 present with identical hex (script diff against `FE/app/globals.css`, failing on drift); all text pairs >= 4.5:1
  (>= 3:1 large); no raw hex outside the tokens file; no import from `@rakhal/ui` (boundary lint, risk 2 in 06-mobile-track).
- Risks: web tokens change under us (parallel agents) - pin a commit and diff in CI; Hermes `Intl` gaps affect formatters; font licence/bundle size.
- Verity checks: hex diff script runs; contrast report; dark theme reviewed on a physical device; no edits to `FE` or `packages/ui`.

### WP2 - Theme provider and typography
- Owner: Codex, Forma reviews.
- Work: ThemeProvider (system/light/dark, persisted), `useTheme`, `Text`/`Heading` primitives with locale-aware line height, font loading with
  splash hold, font-scale handling, locale provider (`bn` default) wired to the shared `@rakhal/domain` formatters (money `৳` + lakh, Latin digits).
- Acceptance: Bangla and Latin render in the brand fonts, no fallback flash; 200% system font scale does not clip core screens; formatMoney(1250000)
  = `৳12,50,000` on Android and iOS; switching locale is instant and persists.
- Risks: `Intl` on Hermes (verify, else a small formatter lib); first-paint font flash; Bangla conjunct rendering on old Android.
- Verity: golden-value formatter tests on device/emulator (not just Node); screenshot of a Bangla-heavy screen on a low-end device profile.

### WP3 - Core component kit (`apps/mobile/src/components`)
- Owner: Forma designs, Codex builds.
- Components: Button (primary/secondary/destructive/ghost; 48/56), IconButton, TextField (label above, error, unit suffix), NumberPad/StepperField,
  Select/BottomSheet picker, Chip/StatusBadge (semantic), Card, ListRow, StatTile, EmptyState, ErrorState, Skeleton, Toast/Snackbar with undo,
  ConfirmSheet, SyncStatusPill (props only until ADR-006), PermissionGate.
- Acceptance: each has loading/disabled/error/pressed states; touch target >= 48dp (automated layout test); accessibility labels required by type;
  light+dark story/screenshot per component; Storybook-or-gallery screen reachable in dev only.
- Risks: scope creep (build only what WP5-6 need); duplicate of web decisions diverging (document deliberate divergences: no floating labels, no tables).
- Verity: a11y audit with TalkBack, touch-target test, snapshot tests, reduce-motion check.

### WP4 - Navigation shell
- Owner: Forma (IA) + Codex (Expo Router).
- Work: bottom tabs (Home, Cattle, Milk, Tasks, More) driven by permission flags (single `navigation` config like web `config/navigation.ts`, UIA:1226);
  header with farm name + SyncStatusPill + language toggle; auth gate and forced-logout routing (X2); deep links; back behaviour on Android.
- Acceptance: worker account sees no manager-only destination; killing and relaunching restores the last tab; Android hardware back never exits
  mid-form without a draft prompt; shell renders offline.
- Risks: nav library state loss; tab count growth (More must stay shallow).
- Verity: seeded owner/manager/worker walkthrough (06-mobile-track X2 gate); back-stack tests.

### WP5 - Screen 1: Milk log entry (vertical slice, 06-mobile-track X4)
- Owner: Forma flow + Codex; blocked on ADR-006 for the offline part (online-only version can ship first behind a flag).
- Flow: session chip row (from farm settings, auto-selected by clock) -> animal list (tag, photo, last yield) -> large number entry -> auto-next ->
  day summary with total litres. Calendar of missing entries is a later add (web has it, RAKHAL-434; mobile may reuse the API).
- Acceptance: p50 time per animal <= 10s in a recorded usability pass with 3 worker-like users [A target, confirm]; works with airplane mode
  (after ADR-006); every entry shows saved/waiting/failed; duplicate-entry protection by idempotency key; Bangla and English complete.
- Risks: backend idempotency ticket not ready; session settings change mid-day; partial entries.
- Verity: airplane-mode matrix (X4 gate), double-tap/duplicate test, 2G throttling, accessibility pass, usability timing.

### WP6 - Screen 2: Feeding (feed grid / plan entry) and Screen 3: Cattle list + detail (lookup)
- Owner: Forma + Codex; Prisma to confirm which feeding endpoints are mobile-safe (feed grid, active sessions exist per project notes).
- Feeding: program sections, "confirm as planned" one-tap, "+ extra" amount; per-cow fit pills reduced to icon + word.
- Cattle: searchable cards (tag, status badge, last milk), detail with tabs collapsed into a vertical sections list; read-only offline.
- Acceptance: no horizontal-scrolling tables; search by tag within 300ms on a 500-animal farm from local cache; status uses icon+text+colour;
  role-gated actions.
- Risks: feed domain complexity (DM/CP/ME maths belongs in `@rakhal/domain`, not screens); detail screens becoming web ports.
- Verity: 500-animal performance test on a mid-range Android profile; permission matrix; both themes and locales.

Cross-cutting gate for every WP (Verity): `typecheck`, `lint`, unit tests (06-mobile-track CI); no secrets; no `farmId` in bodies; EAS builds are not
run on PRs (ADR-005 decision 7). Do not claim device verification without a device or emulator run being recorded.

---

## 5. Open questions for the owner

1. **Typeface.** Code ships Inter + Noto Sans Bengali; docs say Plus Jakarta Sans; Figma uses Satoshi (not loaded). Which is the brand font for mobile?
   (Also confirm Noto Sans Bengali is acceptable for low-end Android, or prefer a lighter Bangla face.)
2. **Brand green and dark theme.** Are the derived dark tokens approved? Is `#D9EC26` lime an official brand accent to add as a token (currently logo-only)?
3. **Button label contrast.** Dark text (`#171d22`, AA) or white on `#00a86b` (3.08:1) for primary buttons? Mobile defaults to dark label unless told otherwise.
4. **`@rakhal/tokens` now or later?** Create the shared package (needs web to consume a generated CSS from it) or start inside `apps/mobile` and extract?
5. **Numerals.** Latin digits are the web decision; do workers prefer Bangla numerals (০-৯) on mobile? Allow a per-user setting?
6. **Navigation destinations.** Confirm the bottom-tab set (Home, Cattle, Milk, Tasks, More) and priority order of modules for the first release.
7. **Devices and connectivity.** Target minimum Android version/RAM, and typical connectivity (2G/3G share). This drives the performance budget and whether
   images are loaded at all on cellular.
8. **Scale for cost** (project rule): expected farms/users on mobile and EAS build/OTA frequency before enabling paid build infrastructure.
9. **Worker vs owner experience.** Should workers get a separate simplified home (3 big buttons: Milk, Feed, Health) rather than the owner dashboard?
10. **Photo and scan.** Is tag QR/barcode scanning and camera capture in scope for release 1?
11. **Voice/audio support** for low-literacy workers: wanted, or out of scope?
12. **Role display names** (UIA Q-6): "Owner/Manager/Worker" vs the mock's "Admin/Employer" - which appears in mobile copy?

---

## Appendix A - What not to carry over from the Flutter prototype (`D:\Projects\Rakhal\Repos\rakhal-app`)

Verified by reading `lib/app/theme/app_colors.dart` and `CLAUDE.md`; the rest of `lib/` was only listed, not read.

- **Wrong brand colours.** Seed `#2E7D32` (Material green), success same, warning `#F9A825`, danger `#C62828` (`app_colors.dart:7-11`). None match the web
  brand (`#00a86b`, `#f59e0b`, `#ef4444`). Do not reuse; use WP1 tokens.
- Material 3 colour-scheme-from-seed theming: produces generic Material look instead of the flat, border-separated Rakhal look (1.3).
- Riverpod/Dio/freezed architecture and `fake_*_data_source` pattern: Flutter-specific; the RN app uses `@rakhal/api-client` per ADR-005. Keep only the idea
  of a fake data source for demos if useful.
- Its login model (email+password+farmId with a `DEFAULT_FARM_ID` stopgap, RD-031 in its CLAUDE.md) - do not copy the stopgap; farm context comes from the token.
- Prototype scope is 1 commit and has no offline layer ("no offline sync engine yet", its CLAUDE.md); no UX learnings about sync visibility exist to inherit.

## Appendix B - Verified vs assumed

Verified (read directly): ADR-005; 06-mobile-track; `FE/app/globals.css` (all tokens); `FE/app/layout.tsx` (fonts); `FE/lib/format.ts` (first 60 lines);
`FE/docs/DESIGN_SYSTEM.md` (lines 112-223); `UIA` (sections 6, 11, 12 excerpts); `PLAT/packages/ui/src/styles/tokens.css`; `button.tsx`; `empty-state.tsx`;
`logo-mark.svg`; `PLAT/packages/ui/package.json` (grep only); `PLAT/apps/admin/app/layout.tsx` (grep only); Flutter `app_colors.dart`, its CLAUDE.md.

Not verified / assumed: no app was run, no screenshots or Figma frames viewed, no device testing; `rakhal-full-logo.jpg` not opened; admin components not read;
`lucide-react-native` and font packages not checked against Expo's compatibility table; Hermes `Intl` behaviour for `bn-BD`/`en-IN`; all numeric UX targets
(time per animal, cold start, 16sp Bangla body, 48/56dp) are design proposals, not measured; user-role/behaviour descriptions are inferred from the brief, not from
user research.

## Owner decisions (2026-11-11)

- Brand font: Inter + Noto Sans Bengali (matches what the web code ships).
- Primary button label: dark label on `#00a86b` (follow the existing `--primary-foreground` token). The web Button, which uses a white label, must be fixed to match.
- Contrast gaps (33), decided and applied in `apps/mobile` (web unchanged): (A) web `border` stays a decorative divider; new mobile-only `inputBorder` and opaque `focusRing` (>= 3:1 on background and card, both themes) in `src/theme/mobile-only.ts`; (B) label-only accents (sessionNoon/Night, accentTeal, statePregnantBar, chart4/Profit/Feedcost) classed decorative under "never the sole carrier of meaning", plus mobile-only `primaryEdge`/`warningEdge` for standalone borders/icons; (C) no colour change to `mutedForeground`; text on any tint uses `foreground` via `textOnTint()`. `known-gaps.ts` is now empty. Pending owner/Verity review.
- Still open: the remaining questions above, including a light-surface logo variant and the lime accent token.

## Resume point (2026-11-11, paused by owner)

WP1 token data is built in `apps/mobile` (uncommitted, untracked). The contrast-fix follow-up was stopped mid-report; state at stop, re-run by the orchestrator:
- `node --test "test/*.test.ts"`: 26/26 pass. `check-token-drift`: OK (divergences recorded in `src/theme/divergences.ts`). `check-contrast`: 60/60 pass.
- The Codex follow-up never delivered its final report, so before/after ratios and its decisions are unreviewed.

Next: (1) read `src/theme/divergences.ts` and confirm the fills; (2) run Verity (independent verification) and Critica (review) in parallel, read-only; (3) owner decides: `pnpm install` to add the lockfile entry for `@rakhal/mobile`, lime accent token, light logo/icon/splash assets; (4) then WP2.
Owner decisions so far: font Inter + Noto Sans Bengali; dark label on #00a86b; mobile-only contrast fixes, web unchanged.

## WP1 status (2026-11-11, end of day)

Built, independently verified (Verity PASS), reviewed (Critica: one blocking item, the lockfile, now fixed). Evidence: 73/73 tests, drift OK (snapshot and --live), contrast 204/204 with 0 known gaps, real `tsc --noEmit` exit 0, `pnpm install --frozen-lockfile` exit 0, `turbo run typecheck test --filter=@rakhal/mobile` 2/2.
NOT committed. Commit together: `apps/mobile/`, `docs/mobile/`, `pnpm-lock.yaml`, one-line `.github/workflows/ci.yml` (node 24).
Open: dark `focusRing` margin and focusRing-on-primary treatment (WP2/WP3), `--cream`, lime accent token, light logo/icon/splash assets, Q4 (`@rakhal/tokens`), dark-theme device review, label-only rule enforcement in components (WP2), admin app on Node 24 unverified until first CI run. Next: WP2 (theme provider, fonts, text primitives).

## WP2 status (2026-11-11)

Owner decisions: Expo scaffold approved now; `@rakhal/domain` created; all spec recommendations O1-O6, O8-O11, O13 approved; negative money `৳-1,234`; short Bangla names match ICU/CLDR; lockfile peer-suffix churn on admin/ui accepted (option a, no root .npmrc change).
Done: W2-0/W2-1 `packages/domain` (225 tests, Verity PASS, Critica findings B1-B3 + optionals fixed by Codex, not yet re-reviewed). W2-2 Expo scaffold (SDK 58.0.23, RN 0.88.1, React 19.3.0; Android bundle export OK; 15/15 turbo tasks; frozen lockfile OK). NOT committed (WP1 + domain + scaffold share one lockfile diff, +7517/-274 vs HEAD).
Not run: emulator/Expo Go boot, expo-doctor, iOS, clean-clone install, EAS. Note: `formatDate`/`formatDateTime` now take `{ locale, style, digits }`; the scaffold spec still shows the old positional signature.
Next: re-review domain + scaffold (Verity/Critica), then W2-3..W2-9 (storage, fonts, ThemeProvider, LocaleProvider, Text/Heading, root layout + gallery, docs).

## WP2 status - build complete (2026-11-11, end of day)

Built W2-0..W2-8, all in `apps/mobile` and `packages/domain`, NOT committed (one shared lockfile diff, +7517/-274 vs HEAD; md5 `400911d76221c379d6a4047253024a03` since W2-3, no installs after that).
Stack as built: Expo SDK 58.0.23, React Native 0.88.1, React 19.3.0 (mobile only; admin stays on 19.2.4), expo-router ~58.0.30, jest-expo ~58.0.14, Node 24.
Delivered: W2-3 prefs storage, W2-4 font loading (Inter + Noto Sans Bengali, 3 weights, whole-string script choice), W2-5 `ThemeProvider`, W2-6 `LocaleProvider` (bn/en, Latin or Bangla digits), W2-7 `Text`/`Heading` with font-scale caps (2.0 body, 1.75 h2, 1.5 h1/stat), W2-8 `AppProviders`, splash hold, root layout, `__DEV__`-only gallery at `/dev/gallery`.
Evidence (run by the orchestrator): mobile `tsc --noEmit` exit 0, eslint exit 0, node tests 124/124 with drift OK, Jest 8 suites / 74 tests, `turbo run typecheck test lint` 15/15, domain 225 tests.
Deviations to know: the not-ready gate lives in `AppProviders` (providers must mount to hydrate), not in `_layout`; gallery font-scale control has an extra "System" option; self-test and Intl probe run on button press; `Text` takes an extra `onTint` prop; `formatDate` uses an options object (spec section for `src/date.ts` updated).
Verified on device: nothing. Not run: Metro bundle of W2-8, emulator/Expo Go boot, `expo-doctor`, iOS (not possible on this Windows machine), clean-clone frozen install, EAS, 200% system font scale, dark-theme first frame, Hermes `Intl`/formatter self-test, whether RN scales an explicit `lineHeight` with the font.
Not yet re-reviewed: domain fixes (Critica B1-B3), the scaffold, and W2-3..W2-8 (Verity + Critica).
Open owner items: Bangla message wording proofread, font-scale caps sign-off by Forma (O9), `Appearance.setColorScheme('unspecified')` device check, pref key versioning (`rakhal.pref.v1.*`), `--cream`, lime accent token, light logo/icon/splash assets, Q4 `@rakhal/tokens`, O12 app identity, O14 ADR-005 header, ignored `@parcel/watcher` build script, admin on Node 24 (first CI run).
Next: Verity + Critica review of the whole WP2 diff, fix blockers, then device/emulator pass (V6), then commit as one change (`apps/mobile/`, `docs/mobile/`, `packages/domain/`, `pnpm-lock.yaml`, `.github/workflows/ci.yml`).

## WP2 status - review fixes (2026-11-11)

Verity (no Critical/High; Android Metro export OK, 6 font TTFs bundled) and Critica (no blockers) reviewed WP2. Fixed M1-M4 plus a root-layout test: themed placeholder screen, bounded (4 s) prefs and font hydration, single parallel prefs read, root error boundary + safe formatter variants.
Current evidence: mobile typecheck/lint exit 0, node tests 129/129 with drift OK, Jest 10 suites / 85 tests, domain 225, `turbo run typecheck test lint --force` 15/15, lockfile md5 `400911d76221c379d6a4047253024a03`. Supersedes the 124/74 counts above.
Still unverified on device: splash, dark first frame, 200% scale and lineHeight scaling, Hermes formatter self-test, iOS.
