/**
 * Focus ring (spec 1.3). An opaque 2dp `focusRing` OUTLINE drawn 2dp outside the control, so it never abuts the fill and
 * its contrast is measured against the surface behind it (already guaranteed in contrastPairs). Outlines do not affect
 * layout, so focus never shifts content. Pure: no React Native imports.
 *
 * SPIKE V-C1 (device, not yet run): if RN 0.88 `outline*` does NOT render on an Android `Pressable`, PressableSurface
 * must switch from `focusRingStyle` to `focusRingFallbackStyle` below (a reserved-space wrapper-view border). That is
 * the only change: swap the style source in PressableSurface (`focusStyle`) and wrap the Pressable in a View that
 * takes the fallback style; the pure shape of both helpers is already covered by test/focus-ring.test.ts.
 */
import type { AnyColorName } from '../../theme/tokens.ts';

export const FOCUS_RING_WIDTH = 2;
/** Gap between the control edge and the ring (transparent). */
export const FOCUS_RING_OFFSET = 2;
/** Inset variant for rows with no gap (ListRow): ring drawn 4dp inside the row. */
export const FOCUS_RING_INSET_OFFSET = -4;

type RingColors = Pick<Record<AnyColorName, string>, 'focusRing'>;

export interface FocusRingStyle {
  outlineWidth: number;
  outlineOffset: number;
  outlineColor: string;
  outlineStyle: 'solid';
}

export function focusRingStyle(colors: RingColors, options: { inset?: boolean } = {}): FocusRingStyle {
  return {
    outlineWidth: FOCUS_RING_WIDTH,
    outlineOffset: options.inset ? FOCUS_RING_INSET_OFFSET : FOCUS_RING_OFFSET,
    outlineColor: colors.focusRing,
    outlineStyle: 'solid',
  };
}

export interface FocusRingFallbackStyle {
  padding: number;
  borderWidth: number;
  borderColor: string;
  margin: number;
}

/**
 * Fallback (spec 1.3.5): a wrapper View with `padding: 2`, a 2dp border that is transparent until focused, and
 * `margin: -4` so the wrapper reserves the ring's space without moving the control. Same visual as the outline.
 */
export function focusRingFallbackStyle(colors: RingColors, focused: boolean): FocusRingFallbackStyle {
  return {
    padding: FOCUS_RING_OFFSET,
    borderWidth: FOCUS_RING_WIDTH,
    borderColor: focused ? colors.focusRing : 'transparent',
    margin: -(FOCUS_RING_WIDTH + FOCUS_RING_OFFSET),
  };
}
