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

/**
 * U+200A HAIR SPACE. A pill is sized to its label, so the label box is exactly the width Yoga measured. On Android
 * the painted layout of a multi-word Bangla label can need a sub-pixel more than that box, so the last word wraps to
 * a second line that the one-line-tall box clips (Pixel 8 emulator: the label painted only its first word). A
 * trailing hair space is counted in the measured width but hangs past the last glyph, giving the line that slack.
 * The accessible name is the `label` prop on the pressable, so screen readers never hear it.
 */
export const LINE_SLACK = ' ';

/** Label text for a chip: adds the trailing slack only when the label has a wrap point (a space). */
export function withLineSlack(label: string): string {
  return /\s/.test(label.trim()) ? `${label}${LINE_SLACK}` : label;
}

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
