/**
 * Pure Chip style resolver (spec 2.5). Token NAMES and sizes only: no React Native imports, so `node --test`
 * covers it. The pressed look lives in PressableSurface (selected -> `primaryHover` fill, unselected -> 12% overlay).
 */
import { touchTarget, type AnyColorName } from '../../theme/tokens.ts';

export const CHIP_METRICS = {
  minHeight: touchTarget.min,
  minWidth: touchTarget.min,
  paddingHorizontal: 16,
  paddingVertical: 10,
  /** Always-present leading slot (keeps the chip width stable when selection toggles). */
  leadingSlot: 18,
  /** Accent dot diameter / empty-ring diameter inside the slot. */
  dot: 10,
  ring: 14,
  gap: 8,
} as const;

export interface ChipColors {
  fill: AnyColorName;
  label: AnyColorName;
  border: AnyColorName;
  /** Colour of the ring (unselected) / check (selected) in the leading slot. */
  mark: AnyColorName;
}

export function chipColors(selected: boolean, disabled: boolean): ChipColors {
  if (disabled) return { fill: 'muted', label: 'mutedForeground', border: 'border', mark: 'mutedForeground' };
  return selected
    ? { fill: 'primary', label: 'primaryForeground', border: 'primary', mark: 'primaryForeground' }
    : { fill: 'card', label: 'foreground', border: 'inputBorder', mark: 'inputBorder' };
}
