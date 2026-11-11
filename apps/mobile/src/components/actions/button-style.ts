/**
 * Pure Button/IconButton style resolver (spec 2.1, 2.2). Token NAMES and sizes only: no React Native imports, so
 * `node --test` covers it. The pressed look is not here (primary -> `primaryHover` via press-overlay.ts, everything
 * else the 12% overlay); this file only says which fill/label/border each variant and state uses.
 */
import { touchTarget, type AnyColorName } from '../../theme/tokens.ts';

export type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'ghost';
export type ButtonSize = 'md' | 'lg';

export interface ButtonMetrics {
  minHeight: number;
  paddingHorizontal: number;
  paddingVertical: number;
}

export const BUTTON_METRICS: Readonly<Record<ButtonSize, ButtonMetrics>> = {
  md: { minHeight: touchTarget.min, paddingHorizontal: 16, paddingVertical: 10 },
  lg: { minHeight: touchTarget.primary, paddingHorizontal: 20, paddingVertical: 12 },
};

/** Leading glyph / spinner size and its gap to the label (spec 2.1). */
export const BUTTON_ICON_SIZE = 20;
export const BUTTON_ICON_GAP = 8;

export function defaultButtonSize(variant: ButtonVariant): ButtonSize {
  return variant === 'primary' ? 'lg' : 'md';
}

export interface ButtonColors {
  fill: AnyColorName | 'transparent';
  label: AnyColorName;
  border: AnyColorName | 'transparent';
}

const ENABLED: Readonly<Record<ButtonVariant, ButtonColors>> = {
  primary: { fill: 'primary', label: 'primaryForeground', border: 'primary' },
  secondary: { fill: 'secondary', label: 'secondaryForeground', border: 'inputBorder' },
  destructive: { fill: 'destructive', label: 'destructiveForeground', border: 'destructive' },
  ghost: { fill: 'transparent', label: 'foreground', border: 'transparent' },
};

const DISABLED: ButtonColors = { fill: 'muted', label: 'mutedForeground', border: 'border' };

/** Fill / label / border token names for a variant. Disabled is the same for every variant. `loading` keeps the variant look. */
export function buttonColors(variant: ButtonVariant, disabled: boolean): ButtonColors {
  return disabled ? DISABLED : ENABLED[variant];
}

/** Surfaces a transparent (ghost) button can sit on. */
export const GHOST_SURFACES = ['background', 'card', 'muted', 'popover'] as const satisfies readonly AnyColorName[];
