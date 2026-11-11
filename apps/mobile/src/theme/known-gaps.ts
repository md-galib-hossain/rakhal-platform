/**
 * Contrast pairs that FAIL today, recorded for an owner decision. No colour was changed to make these pass.
 * check-contrast prints them as KNOWN GAPS and exits 0 only if the failing set equals this list exactly:
 * an unlisted failing pair, a changed ratio/threshold, or an entry whose pair now passes (stale) all fail.
 * To close a gap: decide the colour (web divergence rules apply), then delete the entry.
 * Ratios are WCAG 2.x contrast rounded to 2 dp; translucent colours are alpha-composited over the background first.
 *
 * EMPTY since the owner's decisions A/B/C (2026-11-11): outlines moved to mobile-only tokens and `border` classed
 * decorative; label-only accents classed decorative; text on tints is `foreground` via textOnTint(). Of the 33 former
 * gaps: ~11 were closed by reclassifying label-only pairs, border/input/ring/edges by new mobile-only tokens, and
 * 7 by textOnTint (foreground on tints). None remain. Keep the exact-set rule: any new failing pair must be listed here or fixed.
 */
import type { KnownGap } from '../../scripts/lib/contrast.ts';

export const knownGaps: readonly KnownGap[] = [];
