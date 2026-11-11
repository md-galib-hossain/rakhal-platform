# WP3 - Core component kit: build-ready spec for `apps/mobile`

Status: spec for Codex. Author: Forma (Product Designer / UI/UX Engineer), 2026-11-11. Design-only: no code, no installs, no commits.
Inputs read: `docs/mobile/ux-brand-plan.md` (WP3/5/6, owner decisions), `docs/mobile/wp2-scaffold-spec.md`, and the built foundation
(`src/theme/tokens.ts`, `mobile-only.ts`, `components/primitives/{Text,text-style}`, `i18n/messages.ts`, `providers/*`, `app/dev/gallery.tsx`, `package.json`).
Emulator facts honoured: Expo Go SDK 58, Android, `bn` default, Latin digits default; in `bn` any string (Latin included) renders in Noto Sans
Bengali by the whole-string rule; `script="latin"` forces Inter for one string.

Scope rule: only what Milk log entry (WP5) and Feeding / Cattle list+detail (WP6) need. **Tranche A = WP5, built now. Tranche B = deferred.**

---

## 0. Decisions in one screen

| # | Decision |
|---|---|
| C1 | **Zero new dependencies.** Everything uses React Native core (`Pressable`, `TextInput`, `Modal`, `Animated`, `ActivityIndicator`, `AccessibilityInfo`) plus already-installed `react-native-safe-area-context`. See section 3. |
| C2 | Icons: a tiny internal `Glyph` drawn with `View`s (8 glyphs). No icon library, no `react-native-svg` yet (Q1). |
| C3 | Pressed feedback: primary fill -> `primaryHover` token; every other filled/neutral surface -> overlay of `foreground` at 12% opacity. No Android ripple, no scale. Contrast of every pressed state is asserted by a node test (blend math). |
| C4 | Focus: opaque 2dp `focusRing` drawn as an **outline offset 2dp outside** the control (never touching the fill), via RN `outlineWidth/outlineOffset/outlineColor`. This resolves the open "dark focusRing on primary 2.56:1" item (section 1.3). |
| C5 | Every component with colour logic has a **pure `*-style.ts` resolver** (token names + sizes, no RN imports), tested with `node --test` like `text-style.ts`; RN tests (Jest) cover rendering. |
| C6 | Sizes via `minHeight`/`minWidth`, never `height` on anything that holds text (WP2 constraint, risk 8). |
| C7 | Components never format numbers/money/dates and never concatenate translated fragments: callers pass formatted strings; copy lives in `messages.ts` with `{named}` params. |

### 0.1 Cut / merge list (flagged)

| Plan item | Decision | Why |
|---|---|---|
| NumberPad (custom keypad) | **Cut.** `StepperField` uses the system `decimal-pad` keyboard + big +/- buttons | A custom pad is a large a11y/IME surface; WP5 needs a fast numeric entry, which decimal-pad + step buttons give. Revisit after a timed usability pass (Q3). |
| EmptyState + ErrorState | **Merge** into one internal `StateMessage`, two public exports | Same layout (disc, title, text, one action). |
| IconButton | Keep, but built on the same internal `PressableSurface` as Button/Chip/ListRow | One place for focus ring, pressed overlay, disabled, busy. |
| Select / BottomSheet | **Defer (B).** Only the internal `SheetModal` is built (ConfirmSheet needs it); promote later | WP5 picks session via chips, animals via list. |
| StatTile, SyncStatusPill, PermissionGate | **Defer (B)** | Needed by WP4/WP6 shells, not WP5. |
| Card pressable variant | **Cut** | `ListRow` is the pressable one. |
| Skeleton shimmer, Toast swipe-dismiss, Toast queue, ghost "brand" tone | **Cut** | Motion/gesture cost, conflicts with scroll and gloves (plan P0.5). |
| Floating labels, tables | Not built (deliberate divergence from web, plan WP3 risk) | Labels above; lists of cards. |

---

## 1. Shared rules (apply to every component)

### 1.1 Sizing and spacing (all from `tokens.ts`)

- Touch target: `touchTarget.min` 48 for every interactive element; `touchTarget.primary` 56 for primary actions, field-use controls and anything on a dark theme in outdoor use.
  Adjacent targets: gap >= `touchTarget.minGap` 8; use `spacing.md` 12 between stacked buttons.
- Radius: controls `radius.md` 10; cards/sheets `radius.lg` 16; chips `radius.full`.
- Screen padding 16 (`spacing.lg`), card padding 12 (`md`) or 16 (`lg`). Elevation: `elevation.card` for Card, `elevation.overlay` for Toast/Sheet; `shadowColor` token.
- Layout test rule: no interactive element resolves to a flattened `minHeight`/`height` below its target, and none uses `height` for text containers.

### 1.2 Colour rules (restated for components)

- Only token names through `useTheme().colors`; no hex in `src/components` (lint + boundary test already enforce).
- Primary button label = `primaryForeground` (dark) on `primary` (owner decision). Do not use white on green anywhere.
- Text on a tint fill = `foreground` via `textOnTint`. `mutedForeground` only on neutral surfaces (`background`, `card`, `muted`, `popover`).
- Label-only accents (`sessionNoon`, `sessionNight`, `accentTeal`, `statePregnantBar`, `chart4`, `chartProfit`, `chartFeedcost`) may only appear as a dot/stripe **next to a text label**; never as the sole signal, never as a standalone border/icon (use `primaryEdge`/`warningEdge` for those roles).
- Input outline = `inputBorder`; `border` is for hairline dividers and skeleton fills only.
- `popover` equals `card` in both themes; add one node test asserting `popover === card` and `popoverForeground === cardForeground` so card contrast pairs cover popover surfaces.
- **No new colour tokens are needed.** Every label/fill pair below already exists in `contrastPairs` (checked against the list in `tokens.ts`); pressed blends are tested separately (1.5).

### 1.3 Focus ring (resolves the open dark focusRing-on-primary issue)

Problem recorded in `tokens.ts`: dark `focusRing` `#12774e` against `primary` `#1ec883` is ~2.56:1, and the dark ring margin on `background`/`card` is thin (>= 3.05).

Treatment (no colour change):
1. Ring is an **outline outside the control**: `outlineWidth: 2, outlineOffset: 2, outlineColor: colors.focusRing` (pure helper `focusRingStyle(colors)` in `internal/focus-ring.ts`). The 2dp offset is transparent, so the ring never abuts the fill; its contrast is measured against the **surface behind it** (`background`/`card`/`popover`), which the existing pairs already guarantee at >= 3:1 in both themes.
2. Outlines do not affect layout (no shift on focus). Because the ring extends 4dp beyond the box, the 8dp minimum gap between targets and the 16dp screen padding keep it unclipped. Do not place focusable controls inside `overflow: 'hidden'` parents.
3. Inset variant for rows with no gap (`ListRow`): `outlineOffset: -4` (inside the row), against the row's own surface.
4. Shown only on `onFocus` (hardware keyboard, switch access). TalkBack's own focus frame is system-drawn; do not duplicate it. Pressed state never uses the ring.
5. `[A]` RN 0.88 (New Architecture only) supports `outline*` on Android; verify first (check V-C1). Fallback if it fails: a wrapper `View` with `padding: 2`, `borderWidth: 2`, `borderColor: focused ? focusRing : 'transparent'`, `margin: -4` (same visual, reserved space).
6. Open (Q7): if the 2dp dark ring reads weak on the emulator at 3.05:1, owner may raise the dark `focusRing` token or widen to 3dp for dark only. Not decided here.

### 1.4 Bangla text-fit and font scale (all components)

- Text always goes through `Text`/`Heading` (never raw `RNText`); `TextInput` uses `resolveTextStyle` for family/size/line height and sets `allowFontScaling` + `maxFontSizeMultiplier` from `font-scale.ts` (honours `TextScaleContext` override exactly like `Text`).
- **No `numberOfLines` by default, no ellipsis on labels, no truncation of numbers, ever.** Labels wrap (button labels centre-wrap to 3 lines at 200%). Numbers sit in their own unwrapped `Text`; if width is short the **layout** changes, not the text.
- Containers use `minHeight`; paddings are vertical `spacing.sm`..`md` so Bangla ascenders/conjunct descenders are never clipped. Line height comes only from `textStyle()` (Bangla body 1.6, button/title 1.4, stat 1.2).
- One shared constant `STACK_AT_FONT_SCALE = 1.3` in `internal/layout-rules.ts` (pure). `StepperField` and `ListRow` read `useWindowDimensions().fontScale` and **stack** (input above, +/- row below; trailing content below title) when `fontScale > 1.3`.
- Caps from `font-scale.ts` apply (body-class 2.0, `stat` 1.5): the 28sp entry number tops out at 42sp, designed so a 6-character value still fits a 360dp-wide phone in stacked layout.
- Latin text in `bn` (units `kg`, `L`, tag ids `A-1204`) renders in Noto Sans Bengali by design; pass `script="latin"` only where Inter is wanted (none required in Tranche A).

### 1.5 Accessibility baseline

- Every pressable: `accessibilityRole`, `accessibilityState` (`disabled`, `busy`, `selected`/`checked`), a non-empty accessible name. Props are typed so the name is **required** where text is absent (IconButton `accessibilityLabel`, ChipGroup `accessibilityLabel`).
- Decorative glyphs and state discs: `accessibilityElementsHidden` + `importantForAccessibility="no-hide-descendants"`.
- State changes are announced: busy via `accessibilityState.busy`; toast/error via live region + `AccessibilityInfo.announceForAccessibility`; field errors via `accessibilityLabel`/`accessibilityHint` on the input (error text prepended through a `t()` template, not concatenated).
- Colour is never the only signal: status = word + glyph/dot; error = border + glyph + text; selected = fill + check glyph + state.
- Reduce motion: one hook `useReduceMotion()` (`AccessibilityInfo.isReduceMotionEnabled` + `reduceMotionChanged`), used by Skeleton, Toast, SheetModal.
- Pressed contrast: pure `pressedOverlay = { token: 'foreground', opacity: 0.12 }` in `internal/press-overlay.ts`. Node test: for every Button variant x theme, blend overlay over the fill (add `blend(fg, bg, alpha)` to `scripts/lib/contrast.ts` if absent) and assert label contrast >= 4.5. Primary pressed uses `primaryHover` (`primaryForeground` on `primaryHover` is already a listed pair).

### 1.6 Motion rules

Motion explains change only. Everything uses `Animated` with `useNativeDriver: true` (opacity/translate only), <= 220ms, ease-out in / ease-in out; nothing delays an action; under reduce motion all durations become 0 (fade-less instant) except Skeleton, which becomes static. No springs, no layout animation, no JS-thread animation.

---

## 2. Components

File layout (all under `apps/mobile/src/components/`; no barrel imports across tranches):

```
internal/  Glyph.tsx  PressableSurface.tsx  SheetModal.tsx  focus-ring.ts  press-overlay.ts  layout-rules.ts  useReduceMotion.ts
actions/   Button.tsx  button-style.ts  IconButton.tsx
forms/     TextField.tsx  StepperField.tsx  decimal-input.ts  Chip.tsx (Chip + ChipGroup)
display/   Card.tsx  StatusBadge.tsx  status-style.ts  ListRow.tsx  Skeleton.tsx
feedback/  StateMessage.tsx (EmptyState, ErrorState)  Toast.tsx  toast-timing.ts  ConfirmSheet.tsx  haptics.ts
src/test-utils/  mount.tsx  touch-target.ts
```

### 2.0 Internal pieces (not in the gallery as standalone, tested through users)

**`Glyph`** `{ name: GlyphName; size?: 16 | 20 | 24 (default 20); color: AnyColorName }`, `GlyphName = 'plus' | 'minus' | 'check' | 'close' | 'chevronRight' | 'exclamation' | 'info' | 'dot'`.
Drawn with `View`s (bars, rotated bordered squares for check/chevron, circle for dot); stroke 2dp; fixed square box (size x size is allowed: it is not a text container, not a touch target); always decorative (hidden from a11y). Colour = token name only.

**`PressableSurface`** `{ pressedStyle: 'overlay' | { fill: AnyColorName }; focusInset?: boolean; disabled?; busy?; ...PressableProps }`: owns focus ring (1.3), pressed overlay, `accessibilityState`, `disabled`, `focusable`, no ripple. Button, IconButton, Chip, ListRow render through it.

**`SheetModal`** `{ visible; onRequestClose(): void; dismissable?: boolean (default true); children }`: RN `Modal` (`transparent`, `animationType="none"`, `statusBarTranslucent`, `navigationBarTranslucent`, `onRequestClose` = Android back). Backdrop = `Pressable` filled with `shadowColor` at opacity 0.5; sheet = `popover` surface, top corners `radius.lg`, `elevation.overlay`, padding `spacing.lg` + bottom inset (`max(insets.bottom, 16)` [A: insets inside Modal on Android, verify, V-C2]). Motion: backdrop fade 150ms; sheet translateY(measured height -> 0) 220ms ease-out; exit 160ms; reduce motion: instant. On open, move screen-reader focus to the first child marked `sheetTitle` (`AccessibilityInfo.setAccessibilityFocus`). While `dismissable=false` (busy) backdrop tap and back are ignored.

### 2.1 Button  (Tranche A)

Purpose: every labelled action. Props:

```ts
type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'ghost';
interface ButtonProps {
  label: string;                      // required, already translated
  onPress: () => void;
  variant?: ButtonVariant;            // default 'primary'
  size?: 'md' | 'lg';                 // md = 48, lg = 56; default: 'lg' for primary, 'md' otherwise
  fullWidth?: boolean;                // default true (alignSelf stretch); false = intrinsic width, minWidth 48
  leadingIcon?: GlyphName;
  loading?: boolean;                  // busy: spinner, presses ignored, label stays
  disabled?: boolean;
  script?: ScriptChoice;              // forwarded to Text (default auto)
  accessibilityLabel?: string;        // defaults to label
  accessibilityHint?: string;
  testID?: string;
}
```

Sizing: `md` `minHeight 48`, `paddingHorizontal 16`, `paddingVertical 10`; `lg` `minHeight 56`, `paddingHorizontal 20`, `paddingVertical 12`; `borderWidth 1`; `radius.md`; label role `button` (16sp semibold), centred, wraps; leading glyph 20dp + gap 8.

| Variant | Fill | Label | Border | Pressed | Pairs (already in `contrastPairs`) |
|---|---|---|---|---|---|
| primary | `primary` | `primaryForeground` | `primary` | fill -> `primaryHover` | primaryForeground/primary, /primaryHover |
| secondary | `secondary` | `secondaryForeground` | `inputBorder` | overlay | secondaryForeground/secondary; inputBorder/card+background (ui) |
| destructive | `destructive` | `destructiveForeground` | `destructive` | overlay | destructiveForeground/destructive |
| ghost | transparent | `foreground` | transparent | overlay | foreground on background/card/muted |

States:
- default / pressed: above. Pressed is immediate (no animation).
- disabled: fill `muted`, label `mutedForeground`, border `border`; `accessibilityState.disabled`; presses ignored. (WCAG exempts disabled; the pair is still listed.) Rule for screens: a disabled primary must have visible reason text nearby, not just a grey button.
- loading: `ActivityIndicator` (size small, colour = label token) replaces the leading icon, **label stays** so width does not jump; `accessibilityState={{ busy: true, disabled: true }}`; `onPress` not invoked (this is the first line of duplicate-submit protection for WP5; idempotency keys are still required server-side).
- focused: ring 1.3. No error state (errors belong to fields/screens).

Fit: label wraps up to any lines; `minHeight` grows; `adjustsFontSizeToFit` not used. At 200% a 3-line Bangla label is allowed. Icon-only buttons are IconButton, not Button.
Motion: none (pressed colour is instant).
Tests (see 4): touch-target at md/lg; role `button`; `busy`/`disabled` state; `onPress` not called when loading/disabled; both themes (token resolution through `button-style.ts`); `bn` long label wraps and has no `numberOfLines`; pressed blend contrast.

### 2.2 IconButton  (A)

```ts
interface IconButtonProps {
  icon: GlyphName;
  accessibilityLabel: string;         // REQUIRED (type-enforced), translated
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';   // default 'secondary'
  size?: 'md' | 'lg';                 // 48 / 56 square, default 'md'
  loading?: boolean; disabled?: boolean; testID?: string;
}
```
Box `minWidth = minHeight = 48|56`, radius `full`, glyph 24dp centred, colours as Button variants (glyph colour = label token). The visual box IS the target; no reliance on `hitSlop`. States as Button (loading shows spinner in place of glyph). Used by StepperField (+/-) and Toast close. Tests: label required (TS test via `// @ts-expect-error`), target, role.

### 2.3 TextField  (A)

Purpose: single labelled text input. Label above (never floating), optional unit suffix inside, hint and error below.

```ts
interface TextFieldProps {
  label: string;                       // required; rendered above, also the accessible name
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  hint?: string;                       // below, mutedForeground
  error?: string;                      // below, destructiveText + exclamation glyph
  unit?: string;                       // right-aligned inside the field, role 'label', mutedForeground
  optional?: boolean;                  // adds localized "(optional)" after the label; required fields are unmarked
  disabled?: boolean;
  inputRef?: Ref<TextInput>;           // React 19 ref-as-prop, for auto-advance focus
  keyboardType?; inputMode?; autoCapitalize?; returnKeyType?; onSubmitEditing?; maxLength?; autoFocus?;
  multiline?: boolean; onFocus?; onBlur?; testID?;
}
```

Sizing/colour:
- Container `minHeight 56`, `paddingHorizontal 12`, `borderWidth 1`, `radius.md`, fill `card`, border `inputBorder`; row = input (`flex 1`) + unit (`flexShrink 0`). Whole container is the touch target (tap anywhere focuses the input); multiline: `minHeight 112`, `textAlignVertical 'top'`.
- Label: role `label`, `foreground`, gap `spacing.xs` to the field. Hint: role `caption`, `mutedForeground`. Error: role `label` (legibility), `destructiveText`, preceded by `Glyph exclamation` 16dp in `destructiveText`; reserve no space when absent.
- Value text: role `body` via `resolveTextStyle` (family by `value || placeholder` whole-string rule), `foreground`; placeholder `mutedForeground` (placeholder is hint-only, never the label). `lineHeight` is applied only when `multiline` (single-line Android `TextInput` + explicit `lineHeight` can mis-centre Bangla; centre with `textAlignVertical: 'center'` and padding instead) [A, verify V-C3].
- States: default; focused (ring 1.3, no border-width change); error (border `destructive`, glyph + message, `accessibilityHint` = error); disabled (fill `muted`, text `mutedForeground`, border `border`, `editable={false}`); no loading state (a saving form disables via Button).
- Fit: unit never truncates (`flexShrink 0`); at `fontScale > 1.3` the unit stays on the same line unless it would exceed 40% of the width, then it drops under the value; label/hint/error wrap freely.
A11y: `accessibilityLabel = label` (+ unit via `t('a11y.fieldWithUnit', { label, unit })`), `accessibilityState.disabled`, `accessibilityHint` = error text when present; error text container `accessibilityLiveRegion="polite"`; label is **not** a separate focus stop (single stop per field).
Motion: none (focus outline is instant).
Tests: label required; error shows glyph + text + hint; unit rendered and unwrapped; both locales (family chosen by value); multiline sizing; `inputRef` forwards focus.

### 2.4 StepperField - big-number entry  (A)

Purpose: the milk-yield / feed-amount entry. Large value in the middle, +/- step buttons at the sides, system `decimal-pad`.

```ts
interface StepperFieldProps {
  label: string;
  value: number | null;                // null = empty
  onChange: (value: number | null) => void;
  step?: number;                       // default 0.5
  min?: number;                        // default 0
  max?: number;
  decimals?: number;                   // default 1; digits typed beyond it are rejected
  unit?: string;                       // inside the field, e.g. "L"
  placeholderValue?: number;           // ghost "last value" shown as placeholder (plan P0.5)
  hint?: string;                       // e.g. caller-formatted "Last: 12.5 L"
  error?: string;
  disabled?: boolean;
  inputRef?: Ref<TextInput>; onSubmitEditing?: () => void; autoFocus?: boolean; testID?: string;
}
```

Layout: label above; row = `IconButton(minus, lg 56)` + value field (`flex 1`, `minHeight 56`, centred text role `stat` 28sp, `inputBorder` outline, `card` fill, unit suffix to the right inside, role `label`) + `IconButton(plus, lg 56)`; gap `spacing.sm` 8 (minimum) .. 12. At `fontScale > 1.3`: value field takes a full-width row, the two step buttons sit below as two `flex: 1` 56dp buttons (gap 12). Hint/error below as in TextField.
Behaviour:
- Keeps a local **draft string** so "12." mid-typing is legal; emits `onChange` when the draft parses to a valid number or empties; on blur normalises the draft to `toInputString(value)`.
- +/-: `clamp(round(current +/- step, decimals), min, max)` with integer rounding (scale by `10^decimals`, no float drift). `null` is treated as `min` (so + from empty gives `min + step`); - from `null` is disabled. `-` is disabled at `min`, `+` at `max` (disabled state, never removed).
- Pure helper `forms/decimal-input.ts` (no RN imports, node-tested): `parseDecimalInput(text, { decimals }): { kind: 'empty' | 'partial' | 'valid' | 'invalid'; value: number | null; normalized: string }` - accepts Latin digits **and Bangla digits U+09E6-09EF**, `.` or `,` as the decimal separator (Android `decimal-pad` follows device locale), a trailing separator (`partial`), strips spaces, rejects two separators, signs and exponents, clamps to `decimals`; `toInputString(value, decimals, digits)` = plain string (no grouping) via `applyDigits` from `@rakhal/domain` so the user's digit system is shown.
- Field display respects `useLocale().digits`; keyboard stays `decimal-pad`; `returnKeyType="done"` (or `next` when `onSubmitEditing` moves focus).
Colours: as TextField; +/- IconButtons `secondary`; disabled `muted`/`mutedForeground`.
A11y: input `accessibilityLabel` per TextField; `accessibilityActions` `increment`/`decrement` wired to the same handlers (screen-reader swipe adjusts); +/- labels `t('stepper.increase', { label, step })` / `t('stepper.decrease', ...)` with the step formatted by the caller-bound `useFormat().number`; value change after +/- announced by the native value update (no extra live region).
Motion: none.
Tests: node: `decimal-input` golden table (empty, `12`, `12.`, `12,5`, `১২.৫`, `12.55` with decimals 1, `1.2.3`, `-1`, `1e3`, ` 7 `) and step math at boundaries (`0`, `min`, `max`, float cases `0.1+0.2`); Jest: 56dp targets, stacked layout at fontScale 2.0 (mock `useWindowDimensions`), disabled +/- at bounds, increment action, both digit systems, `null` handling.

### 2.5 Chip and ChipGroup - session picker  (A)

```ts
interface ChipProps {
  label: string; selected: boolean; onPress: () => void;
  accentColor?: 'sessionMorning' | 'sessionNoon' | 'sessionEvening' | 'sessionNight';  // dot beside the label (label-only rule)
  disabled?: boolean; script?: ScriptChoice; testID?: string;
}
interface ChipGroupProps { accessibilityLabel: string /* required, e.g. "Milking session" */; children: ReactNode; }
```

Single-select by the caller (selected state is passed in). `ChipGroup` = `View` `flexDirection: 'row'`, `flexWrap: 'wrap'`, `gap: spacing.sm` (8, the minimum), `accessibilityRole="radiogroup"` + label. **No horizontal scrolling**: at 200% chips wrap onto extra rows.
Chip: `minHeight 48`, `minWidth 48`, `paddingHorizontal 16`, `radius.full`, `borderWidth 1`; always-present 18dp leading slot (keeps width stable when selection changes): unselected = `accentColor` dot 10dp or an empty ring in `inputBorder`; selected = `check` glyph in `primaryForeground`. Label role `button` (16sp), wraps (a long Bangla label makes a taller, pill-ish rounded rectangle; keep `radius.full`).
Colours: unselected fill `card`, border `inputBorder`, label `foreground`; selected fill `primary`, border `primary`, label `primaryForeground`; pressed overlay (selected: `primaryHover`); disabled as Button disabled; focus ring 1.3.
A11y: `accessibilityRole="radio"`, `accessibilityState={{ checked: selected, disabled }}`, name = label. The accent dot is hidden from a11y (the word carries the meaning).
Motion: none (fill changes instantly).
Tests: target 48 in both states; radio role/checked; group label required; wrap at 200% (style has `flexWrap`); dot only when accent given, never without label; both themes.

### 2.6 StatusBadge  (A)

```ts
type StatusTone = 'success' | 'warning' | 'destructive' | 'info' | 'neutral';
type HerdState = 'fresh' | 'insemination' | 'dry' | 'milking' | 'pregnant' | 'sick';
type StatusBadgeProps = { label: string; script?: ScriptChoice; testID?: string } & ({ tone: StatusTone } | { herdState: HerdState });
```

Non-interactive (exempt from 48dp). `minHeight 28`, `paddingHorizontal 10`, `paddingVertical 4`, `radius.md` (**divergence from web's full pill**, so a label that wraps at 200% still looks like a badge), `alignSelf: 'flex-start'`, row: mark + label.
- Fill = the tone's tint (`successTint`/`warningTint`/`destructiveTint`/`infoTint`; neutral = `muted` + `border` hairline; herd = `state<X>Tint`). Label = `foreground` (textOnTint, role `label`), always a word.
- Mark (16dp, decorative): success -> `check` in `primaryText`; warning -> `exclamation` in `warningText`; destructive -> `exclamation` in `destructiveText`; info -> `info` in `infoText`; neutral -> `dot` in `mutedForeground`; herd state -> 10dp `dot` in `state<X>Bar` (word + dot; `pregnant` bar is label-only, fine here because the word is always present).
- Pure resolver `display/status-style.ts`: `(tone | herdState) -> { fill, border?, markGlyph, markColor }`; node test asserts every `markColor` x `fill` pair exists in `contrastPairs` (text pairs `primaryText/successTint`, `warningText/warningTint`, `destructiveText/destructiveTint`, `infoText/infoTint`; ui pairs `state*Bar/state*Tint`).
- States: static only (no pressed/disabled/loading). Fit: label wraps, the badge grows; never `numberOfLines`.
- A11y: `accessible` single node, role `text`, name = label; mark hidden.
Tests: all 5 tones + 6 herd states render word + mark in both themes; text colour is `foreground`; wraps; no `mutedForeground` on tints.

### 2.7 Card  (A)

```ts
interface CardProps { children: ReactNode; padding?: 'none' | 'md' | 'lg'; /* default 'md' = 12 */ style?: StyleProp<ViewStyle>; testID?: string; accessibilityLabel?: string }
```
`card` fill, `radius.lg`, `borderWidth 1`, `border` (decorative), `elevation.card` + `shadowColor`. No interactive behaviour; `accessible={false}` unless `accessibilityLabel` is given (then it groups children). No states. Tests: both themes resolve tokens; padding map; no hex.

### 2.8 ListRow  (A)

Purpose: one row of a list of cards (animals, sessions, entries). Never a table.

```ts
interface ListRowProps {
  title: string; subtitle?: string;
  leading?: ReactNode;                  // e.g. big tag number, avatar
  trailing?: ReactNode;                 // e.g. StatusBadge
  onPress?: () => void;                 // makes it a button row; shows chevronRight unless showChevron=false
  showChevron?: boolean;                // default true when onPress
  selected?: boolean; disabled?: boolean; divider?: boolean;
  titleScript?: ScriptChoice; subtitleScript?: ScriptChoice;
  accessibilityLabel?: string;          // optional: children text is merged; REQUIRED in practice when trailing is icon-only
  accessibilityHint?: string; testID?: string;
}
```
Layout: row, `minHeight 64` (two-line) / `56` (one-line), `paddingHorizontal 12`, `paddingVertical 8`, gap 12; middle column `flex 1` (title role `title` 17/18sp, subtitle role `body` `mutedForeground`); trailing `flexShrink 0` (the badge may wrap internally). At `fontScale > 1.3` trailing content moves **below** the text column (stack), chevron stays right-aligned. Optional hairline divider `border` at the bottom (inset 12).
States: default; pressed overlay (only when `onPress`); disabled (title/subtitle `mutedForeground`, presses ignored); selected = 4dp leading stripe `primaryEdge` + `check` glyph + `accessibilityState.selected` (surface unchanged, so the focus ring stays measurable against `card`); focus = inset ring (1.3.3); no loading (use `SkeletonList`).
A11y: pressable row is one accessible node (role `button`, name = merged title + subtitle + trailing text); non-pressable row is a plain `View` (no role). Tests: touch target when pressable (`minHeight >= 48`), stack at fontScale 2.0, selected state, divider, no `numberOfLines`, both locales/themes.

### 2.9 Skeleton and SkeletonList  (A)

```ts
interface SkeletonProps { width?: number | `${number}%`; height: number; radius?: number /* default radius.sm */; testID?: string }
interface SkeletonListProps { rows?: number /* default 6 */; variant?: 'row' | 'card' }   // preset shaped like ListRow / Card
```
Blocks fill `border` (decorative; `muted` is invisible on the light canvas) on `card`/`background`. `SkeletonList` mirrors the real row geometry (min 64dp, leading square 40, two text bars) so layout does not jump. Motion: opacity 1 <-> 0.5, 800ms ease-in-out loop, native driver; **static under reduce motion**; loop stops on unmount. A11y: the list wrapper is one node: `accessibilityLabel = t('a11y.loading')`, `accessibilityState={{ busy: true }}`; blocks are hidden. States: n/a. Tests: row count, static when reduce motion (mock `AccessibilityInfo`), busy state, no animation leak after unmount.

### 2.10 EmptyState and ErrorState  (A, one internal `StateMessage`)

```ts
interface EmptyStateProps { title: string; description?: string; icon?: GlyphName; action?: { label: string; onPress: () => void; variant?: 'primary' | 'secondary' }; testID?: string }
interface ErrorStateProps {
  kind?: 'generic' | 'network' | 'server' | 'session';  // picks default copy + glyph (plan P1.15: no generic "something went wrong")
  title?: string; message?: string;                       // override defaults
  onRetry?: () => void; retrying?: boolean;               // renders primary lg "Try again"; retrying = Button loading
  action?: { label: string; onPress: () => void };        // e.g. session -> "Sign in"; replaces retry
  staleNote?: string;                                     // e.g. caller-formatted "Showing data saved at 10:30"
  testID?: string;
}
```
Layout: centred column, `paddingHorizontal 24`, `paddingVertical 32`, gap 12; 48dp disc (`secondary` fill; glyph `mutedForeground` for empty; error: `destructiveTint` disc + `exclamation` in `destructiveText`), title role `title` `foreground`, text role `body` `mutedForeground`, then one Button (`lg`). The disc glyph is decorative and hidden; the title carries the meaning. Empty copy states the one fix ("No animals yet - add an animal"). `staleNote` renders above the action in role `label`.
States: ErrorState `retrying` = loading button; both pure presentational. A11y: container `accessibilityRole="alert"` + `accessibilityLiveRegion="polite"` for ErrorState only; EmptyState static. Fit: free wrapping, scrolls if needed (parent supplies `ScrollView`; component uses `flexGrow: 1`, `justifyContent: 'center'`).
Copy: default error titles/messages live in `messages.ts` (section 3.2). Tests: kinds -> correct default key; action/retry mutually exclusive rules; 56dp button; both locales/themes.

### 2.11 Toast and `useToast`  (A)

```ts
type ToastTone = 'success' | 'error' | 'info';
interface ToastOptions { message: string; tone?: ToastTone /* default 'success' */; action?: { label: string; onPress: () => void }; durationMs?: number; bottomOffset?: number }
interface ToastApi { show(options: ToastOptions): string; dismiss(id?: string): void }
function useToast(): ToastApi;          // <ToastProvider> mounted in AppProviders, inside Locale/Theme, around children
```
Policy: **one toast at a time; a new `show` replaces the current one** (so only the latest save is undoable - Q5). Undo flow (plan P0.5): the caller saves immediately, shows `{ message, action: { label: t('toast.undo'), onPress: revert } }`; pressing the action runs `onPress` then dismisses.
Visual: floating card at the bottom: `popover` fill, border `inputBorder`, `radius.lg`, `elevation.overlay`, `minHeight 56`, margin `spacing.lg` sides, placed `insets.bottom + 16 + bottomOffset` above the bottom (`bottomOffset` lets a screen with a sticky action bar or the WP4 tab bar clear it). Row: tone glyph 20dp (`success` -> `check` in `primaryText`; `error` -> `exclamation` in `destructive`; `info` -> `info` in `infoText`) + message (role `body`, `popoverForeground`, wraps, `flex 1`) + optional action `Button ghost md` (label `foreground`, 48dp) + `IconButton close` only when `durationMs === 0` (persistent). Pairs used are all listed (`popoverForeground/popover`, `primaryText|infoText/surfaces`, `destructive` ui on card/popover alias).
Timing (pure `toast-timing.ts`, node-tested): default 4000ms; with `action` 5000ms (plan); `error` 6000ms; `0` = persistent. When a screen reader is on, the duration is `AccessibilityInfo.getRecommendedTimeoutMillis(original)` (Android) else `x3`; timer is not cancelled by touches.
A11y: container `accessibilityLiveRegion` `polite` (`assertive` for error) + `AccessibilityInfo.announceForAccessibility(message)` once on show; `accessibilityRole="alert"` for error. The action is reachable by TalkBack for the full (extended) duration.
Motion: enter 180ms (translateY 16 -> 0 + opacity 0 -> 1), exit 120ms opacity only; reduce motion: instant show/hide. Native driver.
Haptic seam: `feedback/haptics.ts` exports `lightImpact(): void` as a **no-op** until `expo-haptics` is approved (Q2); Toast does not call it, WP5's save path does.
Tests: replace semantics; durations table; action calls handler then dismisses; announce called once; reduce-motion path; bottom offset; unmount clears timers.

### 2.12 ConfirmSheet  (A)

```ts
interface ConfirmSheetProps {
  visible: boolean; title: string; message?: string;
  confirmLabel: string;               // a verb ("Delete"), never "OK"
  cancelLabel?: string;               // default t('common.cancel')
  tone?: 'default' | 'destructive';   // destructive -> destructive Button
  loading?: boolean;                  // confirm busy; both buttons disabled; sheet not dismissable
  onConfirm: () => void; onCancel: () => void;
}
```
Built on `SheetModal`. Content: `Heading h2` (marked as the focus target), optional `message` (role `body`, `mutedForeground`... on `popover`: listed), then a column: confirm `Button lg` (`primary` or `destructive`) then cancel `Button secondary lg`, gap 12. Confirm first, cancel last (bottom, nearest the thumb: the safe action is the easiest to hit). Android back and backdrop tap = `onCancel` (ignored while `loading`). Plan P1.10: used only for irreversible actions; archive/soft-delete uses Toast undo.
States: default, loading (confirm busy), no error state (failure shows a Toast / screen error). A11y: title spoken on open (focus moved), buttons named by label, modal traps focus (Android `Modal` does; iOS `accessibilityViewIsModal`). Motion: SheetModal's.
Tests: both tones; loading blocks cancel/back/backdrop; buttons 56dp and 12dp apart; focus target set; reduce-motion path; both locales (long Bangla title wraps).

---

## 3. Dependencies, messages, wiring

### 3.1 Dependency check against `apps/mobile/package.json`

| Need | Package | Status | Decision |
|---|---|---|---|
| Press, input, modal, animation, spinner, a11y APIs, vibration | `react-native` 0.88.1 | **installed** | use |
| Insets for toast/sheet | `react-native-safe-area-context` ~5.11.1 | **installed** | use |
| Component tests | `jest-expo`, `@testing-library/react-native` 14, `test-renderer`, `@jest/globals` | **installed** | use (RNTL 14 `render` is async: `await render(...)`) |
| Animation | `react-native-reanimated` 4.7 + `react-native-worklets` | **not in `package.json`** (only present in the pnpm store as an optional peer, so it is not importable) | **not needed**: `Animated` + native driver covers opacity/translate |
| Gestures | `react-native-gesture-handler` | not installed | **not needed** (no swipe/drag in WP3) |
| Bottom sheet | `@gorhom/bottom-sheet` | not installed | **not needed**: RN `Modal` + `SheetModal` |
| Icons | `lucide-react-native` + `react-native-svg` | not installed | **not needed** now (View-drawn `Glyph`); needs **owner-approved install** if Q1 = yes (`expo install react-native-svg`, SDK-pinned) |
| Haptics | `expo-haptics` | not installed | **optional, owner-approved install** (`npx expo install expo-haptics`, take the SDK 58 pin); seam is a no-op until then |
| Safe-area provider | `expo-router` mounts one | present | verify V-C2 |

Result: **no installs, no lockfile change** for WP3 as specced. Do not run `pnpm install`.

### 3.2 `messages.ts` additions (en is source of truth; Bangla is an engineer-draft that **Forma/owner must proofread**)

| Key | en | bn (draft) |
|---|---|---|
| `a11y.loading` | Loading | লোড হচ্ছে |
| `a11y.fieldWithUnit` | {label}, {unit} | {label}, {unit} |
| `field.optional` | optional | ঐচ্ছিক |
| `stepper.increase` | Increase {label} by {step} | {label} {step} বাড়ান |
| `stepper.decrease` | Decrease {label} by {step} | {label} {step} কমান |
| `toast.undo` | Undo | ফিরিয়ে নিন |
| `toast.dismiss` | Dismiss | বন্ধ করুন |
| `state.error.generic.title` | Could not load this | এটি লোড করা যায়নি |
| `state.error.network.title` | No internet connection | ইন্টারনেট সংযোগ নেই |
| `state.error.network.message` | Check your connection and try again. | সংযোগ দেখে আবার চেষ্টা করুন। |
| `state.error.server.title` | The server had a problem | সার্ভারে সমস্যা হয়েছে |
| `state.error.server.message` | This is not your fault. Try again in a moment. | এটি আপনার ভুল নয়। কিছুক্ষণ পরে আবার চেষ্টা করুন। |
| `state.error.session.title` | You were signed out | আপনি লগ আউট হয়েছেন |
| `state.error.session.message` | Sign in again to continue. | চালিয়ে যেতে আবার সাইন ইন করুন। |

Existing keys reused: `common.retry`, `common.cancel`, `common.close`, `common.save`, `common.error.generic`. The existing `test/messages.test.ts` keeps key/placeholder parity honest.

### 3.3 Wiring changes outside `src/components`

- `src/providers/AppProviders.tsx`: wrap `children` in `<ToastProvider>` (inside `LocaleProvider`, only when `ready`).
- `src/theme/tokens.ts`: **no change** (no new pairs). Node tests only add assertions.
- `scripts/lib/contrast.ts`: add `blend(fg, bg, alpha)` if missing (pure).

---

## 4. Test plan

Conventions: pure resolvers and `decimal-input` / `toast-timing` / `layout-rules` / `press-overlay` / `*-style` tests in `test/*.test.ts` (`node --test`, no RN imports). Rendering tests colocated as `src/components/**/X.test.tsx` (Jest). Shared helpers in `src/test-utils/`: `mount(ui, { scheme, locale, fontScale })` (wraps `ThemeProvider` + `LocaleProvider` with `memoryPrefs`, mocks `useColorScheme` and `Dimensions` font scale as `Text.test.tsx` does) and `expectTouchTarget(element, 48 | 56)` (walks the flattened style chain: `minHeight`/`height` and `minWidth`/`width` >= target; fails on `height` smaller; fails if a text container sets `height`).

| Check | How | Components |
|---|---|---|
| **Touch-target "layout" test** | Jest `expectTouchTarget` for every pressable, every size/variant/state (Jest has no Yoga, so it asserts style intent). **Real layout** is verified on the emulator by Verity: `adb shell uiautomator dump` on `/dev/components`, assert every clickable node's bounds >= 48dp x 48dp (>= 56dp for primary/stepper) | Button, IconButton, TextField, StepperField (+/-), Chip, ListRow, Toast action, ConfirmSheet buttons |
| **A11y props test** | Query by role/name: role present, name non-empty and equal to the label, `accessibilityState` for disabled/busy/selected/checked, hidden decorative glyphs, required-label props fail typecheck (`@ts-expect-error` tests), live region on Toast/ErrorState | all |
| **Both themes** | Render under `scheme: 'light' | 'dark'`; assert resolved token names via the pure resolvers and that no style contains a raw hex outside token values; node test asserts every (label, fill) pair used by `button-style`/`status-style`/Chip/Toast is in `contrastPairs` and that pressed blends keep label >= 4.5 | all with colour |
| **Both locales** | `bn` and `en`: long Bangla labels wrap (no `numberOfLines`), conjunct sample renders with the Bengali family (`fontFamily` assertion), Latin string in `bn` -> Bengali family, `script="latin"` -> Inter, digit systems `latn`/`beng` for StepperField | Button, TextField, StepperField, Chip, StatusBadge, ListRow, states |
| **200% font scale** | `mount(..., { fontScale: 2.0 })`: stacked layouts engaged (Stepper, ListRow), chips wrap, buttons grow (`minHeight` only), no style with fixed `height` on text containers; emulator: `adb shell settings put system font_scale 2.0` screenshots of `/dev/components` (Verity) | Stepper, ListRow, Chip, Button, TextField, states |
| **Reduce motion** | Mock `AccessibilityInfo.isReduceMotionEnabled` true: Skeleton static, Toast/SheetModal durations 0 | Skeleton, Toast, ConfirmSheet |
| **Behaviour** | loading/disabled ignore presses; stepper bounds; toast replace/undo; sheet back/backdrop/loading rules; `popover === card` | as listed per component |
| **Manual TalkBack pass** (Verity, emulator) | field with unit and error, stepper increment/decrement actions, chip radiogroup, toast announcement + extended undo window, sheet focus + back | StepperField, Chip, Toast, ConfirmSheet, TextField |

Verify-first (run before building on assumptions):

| # | Check | If it fails |
|---|---|---|
| V-C1 | Emulator: `outlineWidth/outlineOffset/outlineColor` render on an Android `Pressable`; focus ring appears with a hardware keyboard (`adb shell input keyevent KEYCODE_TAB`) | use the wrapper-view fallback (1.3.5) |
| V-C2 | `useSafeAreaInsets()` returns correct bottom inset inside `Modal` on Android; `navigationBarTranslucent` behaves | pad bottom with a fixed 24dp minimum |
| V-C3 | Android single-line `TextInput` with Noto Bengali and no `lineHeight`: conjuncts not clipped at 1.0x and 2.0x | add `paddingVertical` or apply `lineHeight` for Bangla only |
| V-C4 | `Animated` native-driver opacity/translate in Expo Go; `AccessibilityInfo.getRecommendedTimeoutMillis` exists on RN 0.88 | use the `x3` fallback |

Gate for WP3 (all must be green, run by the implementer and re-run by Verity): `pnpm --filter @rakhal/mobile typecheck`, `lint`, `test` (node + Jest; baseline 129 node / 10 suites 85 Jest must not regress), `turbo run typecheck test lint` repo-wide, `check:tokens` and `check:contrast` unchanged. Device claims only with a recorded emulator run.

---

## 5. Build order for Codex (commit at each boundary)

1. **C0 preflight**: record baselines; run V-C1..V-C4 spikes in a scratch route (not committed).
2. **C1 foundations**: `layout-rules.ts`, `press-overlay.ts`, `focus-ring.ts`, `useReduceMotion.ts`, `Glyph`, `PressableSurface`, `src/test-utils/*`, `messages.ts` keys, `scripts/lib/contrast.ts` `blend`. Tests first.
3. **C2 Button + IconButton** (+ `button-style.ts`, pressed-contrast test).
4. **C3 Card, StatusBadge (+ `status-style.ts`), Skeleton/SkeletonList.**
5. **C4 TextField, `decimal-input.ts` (node tests first), StepperField.**
6. **C5 Chip + ChipGroup.**
7. **C6 ListRow.**
8. **C7 EmptyState/ErrorState.**
9. **C8 SheetModal + ConfirmSheet.**
10. **C9 Toast + `toast-timing.ts` + `ToastProvider` in `AppProviders` + `haptics.ts` no-op seam.**
11. **C10 dev gallery additions (section 6), full gate, short status note appended to `docs/mobile/ux-brand-plan.md` "WP3 status" (append only).**

Tranche B (not in this build; spec on trigger): `Select` + public `BottomSheet` (promote `SheetModal`, option rows 56dp, `radiogroup`), `StatTile` (`stat` role 28sp number + `label`, non-interactive, optional trend glyph), `SyncStatusPill` props-only (`state: 'online' | 'offline' | 'syncing' | 'waiting' | 'error'`, `count?`; word + glyph + colour; tap opens a detail sheet owned by WP4, built when ADR-006 lands), `PermissionGate` (`{ permission: string; fallback?: ReactNode }` reading a permission-flags context from WP4; hides, never disables). Trigger: WP4 starts (SyncStatusPill, PermissionGate) / WP6 needs (StatTile, Select).

---

## 6. Gallery additions (dev only)

- New route `app/dev/components.tsx`, same `__DEV__` guard as `gallery.tsx` (outside dev: `<Redirect href="/" />`), linked from the existing gallery header by a secondary `Button` ("Components").
- Extract the existing gallery theme/locale/digits/font-scale `Choice` controls into `src/dev/GalleryControls.tsx` (behaviour-free move) and use them on both routes; `src/dev-gallery.test.tsx` must pass unchanged.
- Sections (each in a `Card`, labelled with component + variant name in English): **Button** matrix (4 variants x md/lg x default/disabled/loading, plus a long Bangla label and a leading-icon sample); **IconButton**; **TextField** (default, hint, error, unit, disabled, multiline, optional); **StepperField** (empty with ghost value, value, at-min, at-max, error, Bangla digits); **Chip row** (3 sessions with accent dots, one selected, a wrapping 6-chip row); **StatusBadge** (5 tones + 6 herd states + a wrapping long label); **ListRow** (one-line, two-line with leading/trailing, selected, disabled, divider); **Skeleton** (list + card); **EmptyState / ErrorState** (each error kind, retrying); **Toast** buttons (success, error, with Undo, persistent) incl. a `bottomOffset` sample; **ConfirmSheet** buttons (default, destructive, loading simulation). Real pressed states are checked by pressing; no forced "pressed" prop.
- A "Show touch targets" toggle is **not** built (Verity uses `uiautomator dump`).
- The 200% control reuses the existing `TextScaleContext` override; **note** it affects `Text` and `TextInput` styles but not native layout `fontScale` used by the stacking rule, so the gallery also shows the system `PixelRatio.getFontScale()` and Verity must set the real system scale for stack-layout screenshots.

---

## 7. Open questions for the owner

1. **Icons**: accept the zero-dependency View-drawn `Glyph` (8 shapes) for WP5, or approve installing `react-native-svg` + `lucide-react-native` now (brand audit 1.4 prefers lucide)? Default here: zero deps.
2. **Haptics**: approve `expo-haptics` (SDK-pinned) for the WP5 save confirmation, or stay silent? Default: no-op seam.
3. **No custom NumberPad**: native `decimal-pad` + big +/- steps for WP5. Confirm, or require a custom pad after a timed usability pass (plan target: <= 10s per animal)?
4. **Toast surface**: `popover`/card surface with an outline (chosen: every colour pair already verified) versus the inverse "snackbar" look (would need new verified pairs).
5. **Undo scope**: one toast at a time, so only the latest save is undoable. Acceptable for fast sequential entry, or do you want a short queue / per-row undo?
6. **Pressed look**: 12% `foreground` overlay (and `primaryHover` for primary) versus adding mobile-only `*Pressed` colour tokens. Default: overlay, no new tokens.
7. **Dark focus ring** (open since WP1): after seeing it on the emulator, keep 2dp at 3.05:1, widen to 3dp for dark, or raise the dark `focusRing` token (a token change needs your approval).
8. **StatusBadge**: radius `md` (not the web's full pill) and herd-state badges as word + dot rather than a per-state icon. Acceptable?
9. **Bangla copy**: proofread section 3.2 and the existing drafts (plan: wording must be reviewed before farmers see it).
10. **Disabled controls** use a muted fill with muted label (WCAG-exempt). OK, given the rule that screens show a reason text next to a disabled primary action?
11. **Undo / toast timings**: 4s plain, 5s with undo, 6s error, extended for screen-reader users. Confirm the 5s undo window from plan P0.5.
12. **Toast vs WP4 tab bar**: WP4 will pass `bottomOffset` per screen (or a provider default). Confirm that is how the shell should clear the bar.
