/**
 * Rakhal mobile design tokens (WP1, plan: docs/mobile/ux-brand-plan.md section 1).
 *
 * Source of truth for shared colours is the web file rakhal-consumer-frontend/app/globals.css.
 * `scripts/check-token-drift.ts` fails when any value below differs from it, except tokens recorded
 * in src/theme/divergences.ts (light-theme WCAG fixes, marked "DIVERGES" below). Do not hand-edit a
 * colour here without changing the web file first (or recording a divergence there).
 *
 * This, divergences.ts and mobile-only.ts are the ONLY files in apps/mobile allowed to contain colour hex literals
 * (enforced by test/boundary.test.ts). `colors` below is the web-shared set (drift-checked); the mobile-only tokens
 * (inputBorder, focusRing, primaryEdge, warningEdge) live in mobile-only.ts and are merged into `allColors`. Written as plain data so it can be lifted into
 * @rakhal/tokens later without changes (ADR-005 decision 4; plan Q4 still open).
 *
 * Key naming: camelCase of the CSS custom property, e.g. primaryForeground = --primary-foreground,
 * chart1 = --chart-1, stateFreshBar = --state-fresh-bar.
 */

import { mobileOnlyColors, type MobileOnlyColorName } from './mobile-only.ts';

/**
 * USAGE RULES (owner decisions 2026-11-11, contrast review):
 *  - Label-only rule: sessionNoon, sessionNight, accentTeal, statePregnantBar, chart4, chartProfit, chartFeedcost
 *    are below 3:1 on some surface. They must NEVER be the sole carrier of meaning: always pair them with a text
 *    label or icon. Their contrast pairs are classed decorative for that reason (see LABEL_ONLY_PAIRS).
 *  - Outlines: `border` is a decorative divider only. Input outlines use `inputBorder`, focus uses `focusRing`
 *    (both mobile-only). Standalone brand/warning borders and icons use `primaryEdge`/`warningEdge`; the fills
 *    `primary`/`warning` are for filled surfaces whose label is checked as text.
 *  - Text on a tint fill is `foreground` (use textOnTint); `mutedForeground` is for neutral surfaces only
 *    (it is below 4.5:1 on 7 of the light tints).
 *  - OPEN ITEM (WP2/WP3): `focusRing` on a primary-filled control is ~2.56:1 in dark (focusRing vs primaryEdge/primary),
 *    below 3:1. Such controls need a distinct focus treatment (e.g. an offset gap of background between fill and
 *    ring). Not a colour change; tracked here until the component work lands.
 */
export const colorsLight = {
  // Base surfaces
  background: '#f2f3f5',
  foreground: '#171d22',
  card: '#ffffff',
  cardForeground: '#171d22',
  popover: '#ffffff',
  popoverForeground: '#171d22',

  // Brand. primaryForeground is DARK on the green (owner decision 2026-11-11).
  primary: '#00a86b',
  primaryHover: '#009760', // DIVERGES (web #00774c)
  primaryForeground: '#171d22',
  sidebar: '#055640',
  sidebarForeground: '#ffffff',
  sidebarMuted: '#f4f4f4',

  // Neutral
  secondary: '#f5f6f7',
  secondaryForeground: '#171d22',
  muted: '#f5f6f7',
  mutedForeground: '#66707a',
  accent: '#f5f6f7',
  accentForeground: '#171d22',
  border: '#e7e9ec',
  input: '#e7e9ec',
  ring: '#00a86b66',

  // Semantic status
  success: '#12883e', // DIVERGES (web #16a34a)
  successForeground: '#ffffff',
  successTint: '#e7f6ee',
  warning: '#f59e0b',
  warningForeground: '#171d22', // DIVERGES (web #ffffff)
  warningTint: '#fef4e6',
  destructive: '#eb1616', // DIVERGES (web #ef4444)
  destructiveForeground: '#ffffff',
  destructiveTint: '#fdecee',
  info: '#1e6ff5', // DIVERGES (web #3b82f6)
  infoForeground: '#ffffff',
  infoTint: '#eaf2fe',

  // Accent hues
  accentPurple: '#8b5cf6',
  accentPurpleTint: '#f1ecfe',
  accentTeal: '#14b8a6',
  accentTealTint: '#e6fbf7',
  accentIndigo: '#6366f1',
  accentIndigoTint: '#eeeefe',
  accentPink: '#ec4899',
  accentPinkTint: '#fce7f3',

  // Milk session accents (not themed on web: same value in both themes)
  sessionMorning: '#0082fd',
  sessionNoon: '#faa70c',
  sessionEvening: '#df4e00',
  sessionNight: '#333333',

  // Chart series
  chart1: '#16a34a',
  chart2: '#ef4444',
  chart3: '#3b82f6',
  chart4: '#f59e0b',
  chart5: '#8b5cf6',
  chartIncome: '#007fff',
  chartExpense: '#f43f5e',
  chartProfit: '#10b981',
  chartProduction: '#059669',
  chartFeedcost: '#ffbf54',

  // Herd-state set (bar / tint / text)
  stateFreshBar: '#059669',
  stateFreshTint: '#ecfdf5',
  stateFreshText: '#065f46',
  stateInseminationBar: '#0074e8',
  stateInseminationTint: '#e6f2ff',
  stateInseminationText: '#00468c',
  stateDryBar: '#7e27ce',
  stateDryTint: '#f3eafc',
  stateDryText: '#4c187c',
  stateMilkingBar: '#0891b2',
  stateMilkingTint: '#ecfeff',
  stateMilkingText: '#155e75',
  statePregnantBar: '#e8ae00',
  statePregnantTint: '#fff9e6',
  statePregnantText: '#8c6900',
  stateSickBar: '#e11d48',
  stateSickTint: '#fff1f2',
  stateSickText: '#9f1239',

  // Text-on-tint status colours (AA for small text on the matching tint)
  destructiveText: '#b91c1c',
  warningText: '#92400e',
  primaryText: '#047857',
  infoText: '#1d4ed8',
} as const;

export type ColorName = keyof typeof colorsLight;
export type ColorTokens = Record<ColorName, string>;

/** Dark theme. DERIVED on the web (no Figma dark frames); needs design review (plan 1.1). */
export const colorsDark: ColorTokens = {
  background: '#10151a',
  foreground: '#eef1f3',
  card: '#171d22',
  cardForeground: '#eef1f3',
  popover: '#171d22',
  popoverForeground: '#eef1f3',

  primary: '#1ec883',
  primaryHover: '#00a86b',
  primaryForeground: '#08130c',
  sidebar: '#06301f',
  sidebarForeground: '#ffffff',
  sidebarMuted: '#8fcbab',

  secondary: '#1c2329',
  secondaryForeground: '#eef1f3',
  muted: '#1c2329',
  mutedForeground: '#9aa7b0',
  accent: '#1c2329',
  accentForeground: '#eef1f3',
  border: '#262e35',
  input: '#262e35',
  ring: '#1ec88366',

  success: '#22c55e',
  successForeground: '#08130c',
  successTint: '#123420',
  warning: '#fbbf24',
  warningForeground: '#221a02',
  warningTint: '#3a2c08',
  destructive: '#f87171',
  destructiveForeground: '#2a0a0a',
  destructiveTint: '#3a1414',
  info: '#60a5fa',
  infoForeground: '#071a33',
  infoTint: '#0f2a4a',

  accentPurple: '#a78bfa',
  accentPurpleTint: '#241c3d',
  accentTeal: '#2dd4bf',
  accentTealTint: '#0f2e2a',
  accentIndigo: '#818cf8',
  accentIndigoTint: '#202249',
  accentPink: '#f472b6',
  accentPinkTint: '#3d1830',

  sessionMorning: '#0082fd',
  sessionNoon: '#faa70c',
  sessionEvening: '#df4e00',
  sessionNight: '#333333',

  chart1: '#22c55e',
  chart2: '#f87171',
  chart3: '#60a5fa',
  chart4: '#fbbf24',
  chart5: '#a78bfa',
  chartIncome: '#4da3ff',
  chartExpense: '#fb7185',
  chartProfit: '#34d399',
  chartProduction: '#34d399',
  chartFeedcost: '#ffd27d',

  stateFreshBar: '#34d399',
  stateFreshTint: '#0f2e24',
  stateFreshText: '#6ee7b7',
  stateInseminationBar: '#60a5fa',
  stateInseminationTint: '#0f2a4a',
  stateInseminationText: '#93c5fd',
  stateDryBar: '#a78bfa',
  stateDryTint: '#241c3d',
  stateDryText: '#c4b5fd',
  stateMilkingBar: '#22d3ee',
  stateMilkingTint: '#0f2e33',
  stateMilkingText: '#67e8f9',
  statePregnantBar: '#fbbf24',
  statePregnantTint: '#3a2c08',
  statePregnantText: '#fcd34d',
  stateSickBar: '#fb7185',
  stateSickTint: '#3a1420',
  stateSickText: '#fda4af',

  destructiveText: '#f87171',
  warningText: '#fbbf24',
  primaryText: '#1ec883',
  infoText: '#60a5fa',
};

/** Web-shared tokens only (this is what check-token-drift compares with globals.css). */
export const colors = { light: colorsLight as ColorTokens, dark: colorsDark } as const;
export type ThemeName = keyof typeof colors;

export type { MobileOnlyColorName };
/** Every token the app can use: web-shared plus the mobile-only ones. */
export type AnyColorName = ColorName | MobileOnlyColorName;
export type AllColorTokens = Record<AnyColorName, string>;
export const allColors: { light: AllColorTokens; dark: AllColorTokens } = {
  light: { ...colors.light, ...mobileOnlyColors.light },
  dark: { ...colors.dark, ...mobileOnlyColors.dark },
};

/** Every tint fill (status washes, accent washes, herd-state washes). Text on any of them is `foreground`. */
export const TINT_NAMES = [
  'successTint',
  'warningTint',
  'destructiveTint',
  'infoTint',
  'accentPurpleTint',
  'accentTealTint',
  'accentIndigoTint',
  'accentPinkTint',
  'stateFreshTint',
  'stateInseminationTint',
  'stateDryTint',
  'stateMilkingTint',
  'statePregnantTint',
  'stateSickTint',
] as const satisfies readonly ColorName[];
export type TintName = (typeof TINT_NAMES)[number];

/**
 * The text colour token to use on a tint fill. Always `foreground`: `mutedForeground` is 4.29-4.47:1 on 7 of the
 * light tints (owner decision C: no colour change, use this helper instead). Resolve with the theme colours,
 * e.g. `allColors[theme][textOnTint('infoTint')]`.
 */
export function textOnTint(_tint: TintName): 'foreground' {
  return 'foreground';
}

/** Native-only shadow colour (not shared with web, so not drift-checked). */
export const shadowColor = '#000000';

/** Radius in dp. Web: --radius-sm 0.5rem, --radius-md 0.625rem, --radius-lg 1rem (16px base). */
export const radius = { sm: 8, md: 10, lg: 16, full: 9999 } as const;

/** Spacing scale in dp (4dp grid). New for mobile; web has no spacing tokens. */
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;

/** Touch target sizes in dp (plan P0.1). */
export const touchTarget = { min: 48, primary: 56, minGap: 8 } as const;

/**
 * Font families. Owner decision 2026-11-11: Inter + Noto Sans Bengali.
 * Names follow the @expo-google-fonts export convention (one family name per weight);
 * ASSUMPTION: WP2 loads the fonts that way. Revisit if fonts are bundled differently.
 */
export const fontFamily = {
  latin: {
    regular: 'Inter_400Regular',
    medium: 'Inter_500Medium',
    semibold: 'Inter_600SemiBold',
    bold: 'Inter_700Bold',
  },
  bengali: {
    regular: 'NotoSansBengali_400Regular',
    medium: 'NotoSansBengali_500Medium',
    semibold: 'NotoSansBengali_600SemiBold',
    bold: 'NotoSansBengali_700Bold',
  },
} as const;

export type Script = keyof typeof fontFamily;
export type FontWeightName = keyof typeof fontFamily.latin;

/**
 * Type scale in sp. Web sizes (plan 1.2) raised per plan 3.4: body 15 Latin / 16 Bangla.
 * Line-height ratios: Latin body 1.4, headings 1.2 (web); Bangla body 1.6 (plan P0.4),
 * Bangla headings 1.4 (ASSUMPTION: conjuncts need more room than Latin; not specified in the plan).
 */
export const typeScale = {
  caption: { size: { latin: 12, bengali: 13 }, ratio: { latin: 1.4, bengali: 1.6 }, weight: 'medium' },
  label: { size: { latin: 13, bengali: 14 }, ratio: { latin: 1.4, bengali: 1.6 }, weight: 'medium' },
  body: { size: { latin: 15, bengali: 16 }, ratio: { latin: 1.4, bengali: 1.6 }, weight: 'regular' },
  button: { size: { latin: 16, bengali: 16 }, ratio: { latin: 1.2, bengali: 1.4 }, weight: 'semibold' },
  title: { size: { latin: 17, bengali: 18 }, ratio: { latin: 1.2, bengali: 1.4 }, weight: 'semibold' },
  h2: { size: { latin: 20, bengali: 20 }, ratio: { latin: 1.2, bengali: 1.4 }, weight: 'semibold' },
  h1: { size: { latin: 26, bengali: 26 }, ratio: { latin: 1.2, bengali: 1.4 }, weight: 'semibold' },
  stat: { size: { latin: 28, bengali: 28 }, ratio: { latin: 1.2, bengali: 1.2 }, weight: 'semibold' },
} as const;

export type TextRole = keyof typeof typeScale;

export interface TextStyleSpec {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
}

/** Resolve a text role for a script into concrete RN style values. */
export function textStyle(role: TextRole, script: Script): TextStyleSpec {
  const spec = typeScale[role];
  const size = spec.size[script];
  return {
    fontFamily: fontFamily[script][spec.weight],
    fontSize: size,
    lineHeight: Math.round(size * spec.ratio[script]),
  };
}

/**
 * Elevation. Web is near-flat (shadow-card: 0 0 3px at 10% black); borders carry separation.
 * Re-expressed as RN shadow props (iOS) + elevation (Android). Overlay approximates the web
 * overlay shadow 0 24px 48px at 12% black.
 */
export const elevation = {
  none: { elevation: 0, shadowOpacity: 0, shadowRadius: 0, shadowOffset: { width: 0, height: 0 } },
  card: { elevation: 1, shadowOpacity: 0.1, shadowRadius: 3, shadowOffset: { width: 0, height: 0 } },
  overlay: { elevation: 8, shadowOpacity: 0.12, shadowRadius: 24, shadowOffset: { width: 0, height: 12 } },
} as const;

export type PairKind = 'text' | 'ui' | 'decorative';

export interface ContrastPair {
  fg: AnyColorName;
  bg: AnyColorName;
  /** text: 4.5:1. ui (icons, edges, graphical objects, WCAG 1.4.11): 3:1. decorative: not checked, `reason` required. */
  kind: PairKind;
  note: string;
  reason?: string;
}

const text = (fg: AnyColorName, bg: AnyColorName, note: string): ContrastPair => ({ fg, bg, kind: 'text', note });
const ui = (fg: AnyColorName, bg: AnyColorName, note: string): ContrastPair => ({ fg, bg, kind: 'ui', note });
const decorative = (fg: AnyColorName, bg: AnyColorName, note: string, reason: string): ContrastPair => ({
  fg,
  bg,
  kind: 'decorative',
  note,
  reason,
});

const SURFACES = ['background', 'card', 'muted', 'popover'] as const;
const ACCENT_HUES = ['accentPurple', 'accentTeal', 'accentIndigo', 'accentPink'] as const;
const SESSIONS = ['sessionMorning', 'sessionNoon', 'sessionEvening', 'sessionNight'] as const;
const CHARTS = ['chart1', 'chart2', 'chart3', 'chart4', 'chart5', 'chartIncome', 'chartExpense', 'chartProfit', 'chartProduction', 'chartFeedcost'] as const;
const STATES = ['Fresh', 'Insemination', 'Dry', 'Milking', 'Pregnant', 'Sick'] as const;
const stateTok = (s: (typeof STATES)[number], part: 'Bar' | 'Tint' | 'Text') => `state${s}${part}` as ColorName;

const tintOf = (hue: (typeof ACCENT_HUES)[number]) => `${hue}Tint` as ColorName;

const LABEL_ONLY = 'label-only rule: never the sole carrier of meaning; always paired with a text label or icon';
/** [token, surfaces]: UI pairs below 3:1 that are classed decorative under the label-only rule (owner decision B). */
const LABEL_ONLY_PAIRS: readonly (readonly [AnyColorName, readonly AnyColorName[]])[] = [
  ['sessionNoon', ['background', 'card']],
  ['sessionNight', ['background', 'card']],
  ['accentTeal', ['card', 'accentTealTint']],
  ['statePregnantBar', ['card', 'statePregnantTint']],
  ['chart4', ['card']],
  ['chartProfit', ['card']],
  ['chartFeedcost', ['card']],
];
const isLabelOnly = (fg: AnyColorName, bg: AnyColorName) => LABEL_ONLY_PAIRS.some(([f, bgs]) => f === fg && bgs.includes(bg));
const uiOrLabelOnly = (fg: AnyColorName, bg: AnyColorName, note: string): ContrastPair =>
  isLabelOnly(fg, bg) ? decorative(fg, bg, note, LABEL_ONLY) : ui(fg, bg, note);

/**
 * The foreground/background pairs the app is expected to render, checked in both themes. This is the list
 * of LISTED pairs, not a proof that no other combination is used: a new combination must be added here.
 * Pairs that fail today are recorded in known-gaps.ts (owner decision), not silently fixed.
 */
export const contrastPairs: readonly ContrastPair[] = [
  // --- Text (4.5:1) ---
  text('foreground', 'background', 'body text on canvas'),
  text('cardForeground', 'card', 'card text'),
  text('popoverForeground', 'popover', 'popover text'),
  text('secondaryForeground', 'secondary', 'secondary surface text'),
  text('accentForeground', 'accent', 'accent surface text'),
  text('primaryForeground', 'primary', 'primary button label (dark on brand green)'),
  text('primaryForeground', 'primaryHover', 'primary button label, hover/pressed state'),
  text('sidebarForeground', 'sidebar', 'splash / deep-green surface text'),
  text('sidebarMuted', 'sidebar', 'muted text on the deep-green surface'),
  text('successForeground', 'success', 'success filled label'),
  text('warningForeground', 'warning', 'warning filled label'),
  text('destructiveForeground', 'destructive', 'destructive filled label'),
  text('infoForeground', 'info', 'info filled label'),
  // Body, secondary and status text on every surface.
  ...SURFACES.flatMap((s) => [
    ...(s === 'background' ? [] : [text('foreground', s, `body text on ${s}`)]),
    text('mutedForeground', s, `secondary text on ${s}`),
    text('destructiveText', s, `destructive text on ${s}`),
    text('warningText', s, `warning text on ${s}`),
    text('infoText', s, `info text on ${s}`),
    text('primaryText', s, `brand text on ${s}`),
  ]),
  // Status badge text on its own tint, and body/secondary text on every tint fill.
  text('primaryText', 'successTint', 'success badge text'),
  text('destructiveText', 'destructiveTint', 'destructive badge text'),
  text('warningText', 'warningTint', 'warning badge text'),
  text('infoText', 'infoTint', 'info badge text'),
  // On a tint the text colour is foreground (textOnTint). mutedForeground-on-tint pairs are intentionally NOT listed:
  // it is under 4.5:1 on 7 light tints and the app must not use it there (owner decision C).
  ...TINT_NAMES.map((t) => text(textOnTint(t), t, `body text on ${t} (textOnTint)`)),
  ...STATES.map((s) => text(stateTok(s, 'Text'), stateTok(s, 'Tint'), `herd state badge: ${s.toLowerCase()}`)),

  // --- Non-text UI: icons, edges, indicators, chart marks (3:1) ---
  // Mobile-only outline tokens (mobile-only.ts); the web `input`/`ring` are not used for outlines on mobile.
  ui('inputBorder', 'card', 'input outline on card'),
  ui('inputBorder', 'background', 'input outline on canvas'),
  ui('focusRing', 'background', 'focus ring (opaque) on canvas'),
  ui('focusRing', 'card', 'focus ring (opaque) on card'),
  ui('primaryEdge', 'card', 'brand edge/icon on card'),
  ui('primaryEdge', 'background', 'brand edge/icon on canvas'),
  ui('warningEdge', 'card', 'warning edge/icon on card'),
  ui('warningEdge', 'background', 'warning edge/icon on canvas'),
  ui('primary', 'card', 'primary fill as icon/edge on card'),
  ...(['success', 'destructive', 'info'] as const).flatMap((c) => [
    ui(c, 'card', `${c} as icon/edge on card`),
    ui(c, 'background', `${c} as icon/edge on canvas`),
  ]),
  ...SESSIONS.flatMap((s) => [
    uiOrLabelOnly(s, 'background', `${s} accent on canvas`),
    uiOrLabelOnly(s, 'card', `${s} accent on card`),
  ]),
  ...ACCENT_HUES.flatMap((h) => [uiOrLabelOnly(h, tintOf(h), `${h} on its tint`), uiOrLabelOnly(h, 'card', `${h} on card`)]),
  ...STATES.flatMap((s) => [
    uiOrLabelOnly(stateTok(s, 'Bar'), stateTok(s, 'Tint'), `herd state ${s.toLowerCase()} bar on its tint`),
    uiOrLabelOnly(stateTok(s, 'Bar'), 'card', `herd state ${s.toLowerCase()} bar on card`),
  ]),
  ...CHARTS.map((c) => uiOrLabelOnly(c, 'card', `chart series ${c} on card`)),

  // --- Decorative (excluded) ---
  // border is a hairline divider: web value kept (owner decision A). Input outlines use inputBorder.
  decorative('border', 'background', 'divider/hairline on canvas', 'Decorative divider; separation also comes from spacing and fills. Input outlines use inputBorder.'),
  decorative('border', 'card', 'divider/hairline on card', 'Decorative divider; separation also comes from spacing and fills. Input outlines use inputBorder.'),
  ...TINT_NAMES.map((t) =>
    decorative(t, 'card', `${t} wash on card`, 'Pure background wash; the label inside carries the meaning and is checked as text.'),
  ),
  decorative('muted', 'card', 'muted fill on card', 'Zebra/skeleton fill; no information carried.'),
];
