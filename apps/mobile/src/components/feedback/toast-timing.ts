/**
 * Pure Toast timing, motion and placement rules (spec 2.11, 1.6). No React Native imports: node --test imports this.
 * Policy: one toast at a time, a new one replaces the current (so only the latest save is undoable); 4s plain,
 * 5s with an action (undo), 6s error, 0 = persistent; screen-reader users get a longer window.
 */
export type ToastTone = 'success' | 'error' | 'info';

export const TOAST_DEFAULT_MS = 4000;
export const TOAST_ACTION_MS = 5000;
export const TOAST_ERROR_MS = 6000;
/** Fallback when the platform has no recommended timeout. */
export const TOAST_SCREEN_READER_FACTOR = 3;
export const TOAST_ENTER_MS = 180;
export const TOAST_EXIT_MS = 120;
export const TOAST_ENTER_OFFSET = 16;
/** Gap above the bottom safe-area inset (plus the caller's bottomOffset). */
export const TOAST_BOTTOM_MARGIN = 16;

export interface ToastDurationInput {
  tone: ToastTone;
  hasAction: boolean;
  /** Explicit override; 0 = persistent. Negative / non-finite values are ignored. */
  durationMs?: number;
}

export function baseToastDuration({ tone, hasAction, durationMs }: ToastDurationInput): number {
  if (durationMs !== undefined && Number.isFinite(durationMs) && durationMs >= 0) return durationMs;
  if (tone === 'error') return TOAST_ERROR_MS;
  return hasAction ? TOAST_ACTION_MS : TOAST_DEFAULT_MS;
}

export function isPersistent(durationMs: number): boolean {
  return durationMs === 0;
}

export interface ScreenReaderTiming {
  screenReader: boolean;
  /** AccessibilityInfo.getRecommendedTimeoutMillis(base) (Android); absent elsewhere. */
  recommendedMs?: number;
}

/** Never shortens the base window; a persistent toast (0) stays persistent. */
export function effectiveToastDuration(baseMs: number, { screenReader, recommendedMs }: ScreenReaderTiming): number {
  if (isPersistent(baseMs) || !screenReader) return baseMs;
  if (recommendedMs !== undefined && Number.isFinite(recommendedMs)) return Math.max(baseMs, recommendedMs);
  return baseMs * TOAST_SCREEN_READER_FACTOR;
}

/** One toast at a time: the incoming toast always wins. */
export function replaceToast<T>(_current: T | null, incoming: T): T {
  return incoming;
}

export function toastLiveRegion(tone: ToastTone): 'polite' | 'assertive' {
  return tone === 'error' ? 'assertive' : 'polite';
}

export interface ToastMotion {
  enter: number;
  exit: number;
}

export function toastDurations(reduceMotion: boolean): ToastMotion {
  return reduceMotion ? { enter: 0, exit: 0 } : { enter: TOAST_ENTER_MS, exit: TOAST_EXIT_MS };
}

export function toastBottom(insetBottom: number, bottomOffset: number | undefined): number {
  const inset = Number.isFinite(insetBottom) ? Math.max(insetBottom, 0) : 0;
  const offset = bottomOffset !== undefined && Number.isFinite(bottomOffset) ? Math.max(bottomOffset, 0) : 0;
  return inset + TOAST_BOTTOM_MARGIN + offset;
}
