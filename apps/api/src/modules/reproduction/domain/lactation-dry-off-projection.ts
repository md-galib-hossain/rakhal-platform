/**
 * Pure dry-off projection helpers (RAKHAL-285). No framework/Prisma imports,
 * mirrors the `lactation-stage.ts`/`pregnancy-stage.ts` precedent in this
 * same directory.
 *
 * **Design (user-directed, supersedes a fixed 305-day target)**: Bangladesh
 * farms vary too widely in lactation length for a fixed 305-day dry-off
 * target to be the primary metric. The primary projection is
 * pregnancy-driven — `recommendedDryOffAt = expectedCalvingDate -
 * dryPeriodDays` — recomputed by `ReproductionService` whenever the dam's
 * expected-calving date changes (new pregnancy confirmed, re-diagnosis,
 * abortion). When the dam isn't pregnant there is no confident date to
 * project, so this module returns a labeled **management estimate**
 * (`managementEstimateDimRange` + `confidence: 'LOW'` + an explicit
 * `reason`) instead of guessing a hard date. The standardized 305-day yield
 * (`computeStandardized305DayYield`, below) stays a secondary, optional
 * comparison metric — never the driver of this projection.
 */

export type DryOffConfidence = 'LOW';

export interface DryOffProjectionResult {
  recommendedDryOffAt: Date | null;
  managementEstimateDimRange: [number, number] | null;
  confidence: DryOffConfidence | null;
  reason: string | null;
}

export interface PregnantDryOffProjectionInput {
  isPregnant: true;
  expectedCalvingDate: Date;
  dryPeriodDays: number;
}

export interface NotPregnantDryOffProjectionInput {
  isPregnant: false;
  /**
   * Lengths (in days) of this cow's own prior *ended* lactations
   * (`endDate - startDate`), most-recent-first order doesn't matter — every
   * value is used. Empty when she has no completed lactation history yet
   * (e.g. first lactation, or a purchased-lactating cow with no prior
   * records in this system).
   */
  previousLactationLengthsDays: number[];
  /**
   * Fallback range (days) used only when there's no prior-lactation history
   * to derive an estimate from at all. **Invented constant** (RD-046-class
   * judgment call, same as sibling Milestone-10/RAKHAL-28x tickets) — 270-330
   * days is a commonly cited standard dairy lactation-length range; needs a
   * real farm-vet sanity check before this ships to real farms. Defaults
   * applied by `computeDryOffProjection` when omitted.
   */
  fallbackRangeDays?: [number, number];
}

export type DryOffProjectionInput =
  | PregnantDryOffProjectionInput
  | NotPregnantDryOffProjectionInput;

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_FALLBACK_RANGE_DAYS: [number, number] = [270, 330];
/** Pad applied around a single-value/identical-value prior-lactation estimate
 * so the returned range isn't a zero-width point (a farmer-facing range,
 * not a promise of precision). */
const SINGLE_VALUE_PAD_DAYS = 15;

/**
 * Pure dry-off projection derivation.
 *
 * Pregnant branch: `recommendedDryOffAt = expectedCalvingDate -
 * dryPeriodDays` — a firm, farm-settings-driven date; no management
 * estimate/confidence is attached (the caller's stored
 * `Lactation.recommendedDryOffAt` already carries this value directly).
 *
 * Not-pregnant branch: no confident date exists. Derives a `[min, max]` DIM
 * range from this cow's own prior lactation lengths when available (range =
 * the historical min/max, padded when there's only one data point or all
 * values coincide); otherwise falls back to a documented constant range.
 * Always labeled `confidence: 'LOW'` with an explicit, never-omitted
 * `reason` string — this is a management estimate, never presented as a
 * hard date (the ticket's own explicit requirement).
 */
export function computeDryOffProjection(
  input: DryOffProjectionInput,
): DryOffProjectionResult {
  if (input.isPregnant) {
    const recommendedDryOffAt = new Date(
      input.expectedCalvingDate.getTime() - input.dryPeriodDays * DAY_MS,
    );
    return {
      recommendedDryOffAt,
      managementEstimateDimRange: null,
      confidence: null,
      reason: null,
    };
  }

  const { previousLactationLengthsDays } = input;
  const [fallbackMin, fallbackMax] =
    input.fallbackRangeDays ?? DEFAULT_FALLBACK_RANGE_DAYS;

  if (previousLactationLengthsDays.length === 0) {
    return {
      recommendedDryOffAt: null,
      managementEstimateDimRange: [fallbackMin, fallbackMax],
      confidence: 'LOW',
      reason:
        'Not pregnant, so no confirmed expected-calving date exists yet, and this cow has no completed prior lactation on record — using a standard dairy lactation-length fallback range.',
    };
  }

  const min = Math.min(...previousLactationLengthsDays);
  const max = Math.max(...previousLactationLengthsDays);
  const range: [number, number] =
    min === max
      ? [
          Math.max(0, Math.round(min - SINGLE_VALUE_PAD_DAYS)),
          Math.round(max + SINGLE_VALUE_PAD_DAYS),
        ]
      : [Math.round(min), Math.round(max)];

  return {
    recommendedDryOffAt: null,
    managementEstimateDimRange: range,
    confidence: 'LOW',
    reason: `Not pregnant, so no confirmed expected-calving date exists yet — estimated from this cow's ${previousLactationLengthsDays.length} prior lactation(s) on record.`,
  };
}

/**
 * Optional secondary comparison metric (RAKHAL-285 AC) — a standardized
 * 305-day-equivalent yield projected from the cumulative yield produced so
 * far this lactation, scaled linearly to 305 days. Industry-standard
 * approximation with the same simplification `lactation-yield.ts` already
 * documents elsewhere in this module (missing days aren't excluded, they're
 * baked into the average via the actual elapsed-day divisor) — this is a
 * ratio projection, not a true Test Interval Method/USDA-AIPL calculation
 * (that needs individual test-day fat/protein-corrected yields this system
 * doesn't record). Gated on a minimum recorded-DIM threshold: below it,
 * projecting 305 days from too few real days is unreliable, so this returns
 * `null` rather than a misleadingly precise number (same
 * null-below-threshold convention already used elsewhere in this module).
 */
export function computeStandardized305DayYield(params: {
  producedToDateL: number;
  daysInMilk: number;
  minDimThreshold: number;
}): number | null {
  const { producedToDateL, daysInMilk, minDimThreshold } = params;
  if (daysInMilk < minDimThreshold || daysInMilk <= 0) {
    return null;
  }
  const projected = (producedToDateL / daysInMilk) * 305;
  return Math.round(projected * 100) / 100;
}
