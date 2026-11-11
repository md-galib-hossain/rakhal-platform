/**
 * Pure ListRow style resolver (spec 2.8). Token NAMES and sizes only: no React Native imports, so `node --test`
 * covers it. The row sits on a `card` surface; every text/fill pair here is already in `contrastPairs`.
 */
import { touchTarget, type AnyColorName } from '../../theme/tokens.ts';
import { shouldStack } from '../internal/layout-rules.ts';

export const LIST_ROW_METRICS = {
  /** One-line / two-line (title + subtitle) minimum heights. Both clear the 48dp target. */
  minHeightOneLine: 56,
  minHeightTwoLine: 64,
  paddingHorizontal: 12,
  paddingVertical: 8,
  gap: 12,
  /** Selected leading stripe width. */
  stripe: 4,
  /** Hairline divider inset from both edges. */
  dividerInset: 12,
  dividerThickness: 1,
  glyphSize: 20,
} as const;

/** The surface a row sits on (all text pairs below are listed against `card`). */
export const LIST_ROW_SURFACE = 'card' as const satisfies AnyColorName;

export function listRowMinHeight(hasSubtitle: boolean): number {
  const height = hasSubtitle ? LIST_ROW_METRICS.minHeightTwoLine : LIST_ROW_METRICS.minHeightOneLine;
  return Math.max(height, touchTarget.min);
}

export interface ListRowColors {
  title: AnyColorName;
  subtitle: AnyColorName;
  chevron: AnyColorName;
  /** Selected stripe (standalone brand edge) and check mark. */
  stripe: AnyColorName;
  check: AnyColorName;
  divider: AnyColorName;
}

export function listRowColors(disabled: boolean): ListRowColors {
  return {
    title: disabled ? 'mutedForeground' : 'foreground',
    subtitle: 'mutedForeground',
    chevron: 'mutedForeground',
    stripe: 'primaryEdge',
    check: 'primaryText',
    divider: 'border',
  };
}

/** Chevron shows only on a pressable row, unless the caller turns it off. */
export function showsChevron(pressable: boolean, showChevron: boolean | undefined): boolean {
  return pressable && showChevron !== false;
}

/** At large system font scale the trailing content moves below the text column. */
export function listRowStacksTrailing(fontScale: number, hasTrailing: boolean): boolean {
  return hasTrailing && shouldStack(fontScale);
}
