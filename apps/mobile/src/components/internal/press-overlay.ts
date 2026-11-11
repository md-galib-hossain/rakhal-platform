/**
 * Pressed-state look (spec C3, owner-approved): primary -> `primaryHover` fill; every other surface -> a 12% `foreground`
 * overlay. No ripple, no scale, no animation. Pure: no React Native imports. Contrast of every pressed blend is asserted
 * in test/press-overlay.test.ts via scripts/lib/contrast.ts `blend`.
 */
import type { AnyColorName } from '../../theme/tokens.ts';

export const PRESSED_OVERLAY = { token: 'foreground', opacity: 0.12 } as const satisfies {
  token: AnyColorName;
  opacity: number;
};

/** Style of the absolutely-filled overlay View. Opacity is kept separate so only the overlay (never the label) is dimmed. */
export function pressedOverlayStyle(colors: Record<typeof PRESSED_OVERLAY.token, string>) {
  return { backgroundColor: colors[PRESSED_OVERLAY.token], opacity: PRESSED_OVERLAY.opacity } as const;
}

/** Variants that swap their fill when pressed instead of using the overlay; `null` = use the overlay. */
export function pressedFillName(variant: 'primary' | 'secondary' | 'destructive' | 'ghost'): AnyColorName | null {
  return variant === 'primary' ? 'primaryHover' : null;
}
