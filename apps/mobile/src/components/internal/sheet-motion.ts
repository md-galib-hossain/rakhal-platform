/**
 * Pure SheetModal motion + layout rules (spec 2.0, 1.6). No React Native imports: node --test imports this file.
 */
import { spacing } from '../../theme/tokens.ts';

/** Backdrop is `shadowColor` at this opacity. */
export const SHEET_BACKDROP_OPACITY = 0.5;
export const SHEET_BACKDROP_MS = 150;
export const SHEET_ENTER_MS = 220;
export const SHEET_EXIT_MS = 160;
/** The sheet never grows past this share of the screen; taller content scrolls (200% font scale). */
export const SHEET_MAX_HEIGHT_FRACTION = 0.9;
/** Minimum bottom inset applied even when the device reports none (spec: max(insets.bottom, 16)). */
export const SHEET_MIN_BOTTOM_INSET = 16;

export interface SheetDurations {
  backdrop: number;
  enter: number;
  exit: number;
}

/** Reduce motion: every duration is 0 (instant show/hide). */
export function sheetDurations(reduceMotion: boolean): SheetDurations {
  return reduceMotion
    ? { backdrop: 0, enter: 0, exit: 0 }
    : { backdrop: SHEET_BACKDROP_MS, enter: SHEET_ENTER_MS, exit: SHEET_EXIT_MS };
}

/** Bottom padding of the sheet content: `spacing.lg` plus the bottom inset (never below 16). */
export function sheetBottomPadding(insetBottom: number): number {
  const inset = Number.isFinite(insetBottom) ? Math.max(insetBottom, SHEET_MIN_BOTTOM_INSET) : SHEET_MIN_BOTTOM_INSET;
  return spacing.lg + inset;
}

/** Back button and backdrop tap close the sheet only while it is dismissable (not busy). */
export function dismissAllowed(dismissable: boolean): boolean {
  return dismissable;
}
