/**
 * Mobile-only colour tokens: they do NOT exist in the web file (rakhal-consumer-frontend/app/globals.css) and are
 * therefore not part of `colorsLight`/`colorsDark` in tokens.ts (those are the web-shared, drift-checked set).
 * Owner decision 2026-11-11 (contrast gaps A and B): the web `border`/`input`/`ring`/`primary`/`warning` tokens stay
 * as they are (hairline dividers and brand fills); mobile gets stronger tokens for the roles that need >= 3:1
 * (WCAG 1.4.11 non-text contrast) on BOTH `background` and `card`.
 *
 * Drift rules (scripts/check-token-drift.ts, scripts/lib/drift.ts checkMobileOnly):
 *  - a name listed here must NOT also be in colorsLight/colorsDark (that would hide drift);
 *  - if the web file later declares the same CSS variable (--input-border, --focus-ring, --primary-edge,
 *    --warning-edge) with a DIFFERENT value, or as a non-hex value, the check fails; the owner then decides which wins;
 *  - an undeclared extra token anywhere else fails as plain drift ("missing in web").
 *
 * Allowed to contain hex literals (with tokens.ts and divergences.ts), enforced by test/boundary.test.ts.
 * Values are the lightest (light theme) / darkest (dark theme) colours of the same hue family as the token they
 * support that clear 3:1 on both surfaces with a small margin (>= 3.05); ratios are asserted in test/contrast.test.ts.
 *
 * Usage:
 *  - inputBorder: outline of text inputs, selects, segmented controls (the cue that a field exists). Not for dividers
 *    (use `border`).
 *  - focusRing: opaque 2dp focus/selection outline. Replaces the web `ring` (40% alpha green) on mobile.
 *  - primaryEdge / warningEdge: STANDALONE borders and icons in the brand/warning hue. The brand fills `primary` and
 *    `warning` are unchanged and remain the choice for filled buttons/badges (their labels are checked as text).
 */
export const mobileOnlyColorsLight = {
  inputBorder: '#828c9c', // same hue family as border #e7e9ec
  focusRing: '#009f65', // same hue family as primary/ring
  primaryEdge: '#009f65',
  warningEdge: '#c17c08', // same hue family as warning
} as const;

export type MobileOnlyColorName = keyof typeof mobileOnlyColorsLight;

/** Dark values; primaryEdge/warningEdge need no change (the dark brand/warning colours already clear 3:1). */
export const mobileOnlyColorsDark: Record<MobileOnlyColorName, string> = {
  inputBorder: '#586b7b',
  focusRing: '#12774e',
  primaryEdge: '#1ec883',
  warningEdge: '#fbbf24',
};

export const mobileOnlyColors = { light: mobileOnlyColorsLight as Record<MobileOnlyColorName, string>, dark: mobileOnlyColorsDark } as const;
