/**
 * Font-scale clamp policy (spec W2-3, open decision O9). Pure: no React Native, Expo or React imports.
 * Caps are the maximum system font-scale multiplier applied to a text role. Body-class roles allow 200%
 * (WCAG 1.4.4); large display roles are already big, so they stop earlier to avoid clipping.
 */
import type { TextRole } from './tokens.ts';

export const maxFontSizeMultiplier: Record<TextRole, number> = {
  caption: 2.0,
  label: 2.0,
  body: 2.0,
  button: 2.0,
  title: 2.0,
  h2: 1.75,
  h1: 1.5,
  stat: 1.5,
};

/** Scale used when the system or override value is missing or unusable. */
const NEUTRAL_SCALE = 1;

function sane(value: number | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
}

/**
 * min(override ?? systemScale, cap). Non-finite or non-positive inputs are ignored (an invalid override
 * falls back to the system scale, an invalid system scale to 1) so callers never get NaN/0 sizes.
 */
export function effectiveScale(role: TextRole, systemScale: number, override?: number): number {
  const requested = sane(override) ?? sane(systemScale) ?? NEUTRAL_SCALE;
  return Math.min(requested, maxFontSizeMultiplier[role]);
}
