/**
 * Cattle domain constants (PRD §8). Pure values shared by DTOs and services —
 * no framework/Prisma imports (DDD-lite `domain` layer).
 */

/** Allowed BCS values: 1.0–5.0 in 0.25 steps (PRD §8.6 / §24.6 / CAT rules). */
export const BCS_ALLOWED_SCORES: number[] = Array.from(
  { length: 17 },
  (_, i) => 1 + i * 0.25,
);

export const BCS_MIN = 1;
export const BCS_MAX = 5;

/** BCS alert thresholds near calving (PRD §8.6). */
export const BCS_NEAR_CALVING_LOW = 2.5;
export const BCS_NEAR_CALVING_HIGH = 3.75;
/** Window around expected calving for the near-calving alert (≈3 weeks). */
export const BCS_NEAR_CALVING_WINDOW_DAYS = 21;
/** A BCS drop greater than this within `BCS_DROP_WINDOW_DAYS` flags mobilization. */
export const BCS_DROP_THRESHOLD = 1.0;
export const BCS_DROP_WINDOW_DAYS = 60;
