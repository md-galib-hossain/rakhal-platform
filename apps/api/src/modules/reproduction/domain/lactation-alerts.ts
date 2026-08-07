/**
 * Pure lactation-alert-detection helpers (RAKHAL-286). No framework/Prisma
 * imports so they're unit-testable without a Prisma double, mirroring the
 * `lactation-yield.ts`/`lactation-persistency.ts`/`lactation-dry-off-projection.ts`
 * precedent in this same directory. Each `detect*` function takes plain,
 * already-derived inputs (the orchestrating caller — `SchedulerService`'s new
 * daily sweep — is responsible for querying `MilkLogEntry`/`Lactation`/
 * `Pregnancy` and building `DailyYieldPoint[]`/DIM/pregnancy-flag inputs) and
 * returns a boolean (or a small result object where an extra figure like
 * `dropPct` is useful for the alert's task message).
 *
 * **Thresholds — reused vs invented (ticket's own explicit instruction to
 * check `FarmModuleSettings` first)**:
 * - Sudden-drop %: reuses the **existing** `FarmModuleSettings.milkAnomalyThresholdPct`
 *   (RD-016) via `FarmSettingsService` — no new column. The existing field
 *   already means "the drop % from a rolling average that should raise a
 *   flag"; RAKHAL-277's `isAnomaly`/`dropPct` (`src/modules/milk/domain/milk-anomaly.ts`)
 *   apply it per-*session*, this ticket applies the same number per-*day*.
 * - Long-lactation-not-pregnant DIM threshold: reuses the **existing**
 *   `FarmModuleSettings.reproLongDaysOpenDays` (RAKHAL-272) — for a cow still
 *   in an active lactation with no rebreeding since her last calving, "days
 *   open" and "days in milk" are the same clock, so the existing
 *   `LONG_DAYS_OPEN` threshold is the correct reuse rather than a duplicate
 *   `lactationLongDimDays` field.
 * - Everything else below (low-peak-by-DIM day/litre floor, dry-off-approaching
 *   lead days, low-production-dry-off-review litre floor/consecutive-days) has
 *   **no existing matching setting** — the ticket explicitly scoped this
 *   ticket to need no new Prisma migration, so these stay as documented,
 *   invented module-level constants (same RD-046-class judgment call already
 *   made by `lactation-dry-off-projection.ts`'s fallback range/pad) rather
 *   than new `FarmModuleSettings` columns. Flagged in `docs/TECH_DEBT.md` as
 *   a follow-up to make them farm-configurable once a real farm/vet can sanity
 *   -check the numbers.
 */
import { DimDataQuality } from './lactation-curve';

// ---- invented, not-yet-farm-configurable defaults (see file doc comment) --

/** DIM by which a cow should have approached her peak yield (RD-046-class). */
export const DEFAULT_LOW_PEAK_BY_DIM_DAYS = 60;
/** Minimum peak yield (L) expected by {@link DEFAULT_LOW_PEAK_BY_DIM_DAYS} (RD-046-class). */
export const DEFAULT_LOW_PEAK_MIN_YIELD_L = 8;
/** Lead days before `recommendedDryOffAt` the "approaching" alert fires — matches the legacy `sweepDryOffDue`'s own hardcoded 14-day lookback. */
export const DEFAULT_DRY_OFF_APPROACHING_LEAD_DAYS = 14;
/** Daily production floor (L) below which dry-off is worth reviewing (RD-046-class). */
export const DEFAULT_LOW_PRODUCTION_DRY_OFF_THRESHOLD_L = 5;
/** Consecutive days at/under the floor before the review alert fires. */
export const DEFAULT_LOW_PRODUCTION_DRY_OFF_CONSECUTIVE_DAYS = 3;

// ---- 1. Missing-session ----------------------------------------------------

export interface MissingSessionInput {
  dataQuality: DimDataQuality;
}

/** No milk-log session at all was recorded for an active-lactation cow on the checked day. */
export function detectMissingSession(input: MissingSessionInput): boolean {
  return input.dataQuality === 'missing';
}

// ---- 2. Sudden-drop ---------------------------------------------------------

export interface SuddenDropInput {
  evaluatedDayYieldL: number;
  evaluatedDayDataQuality: DimDataQuality;
  /** Data quality of each of the (typically 7) baseline days the average was computed from. */
  baselineDaysDataQuality: DimDataQuality[];
  baselineAvgYieldL: number;
  /** Drop %, e.g. 30 → fires when the evaluated day is >=30% below the baseline. */
  dropThresholdPct: number;
}

export interface SuddenDropResult {
  fired: boolean;
  dropPct: number | null;
}

/**
 * Today's yield vs the trailing 7-day average, beyond `dropThresholdPct`.
 * Fires **only** when the evaluated day and every baseline day it's compared
 * against have `dataQuality === 'complete'` (the ticket's explicit "only when
 * both days have complete sessions" guard) — an incomplete/missing day would
 * mechanically look like a drop without being a real production event.
 */
export function detectSuddenDrop(input: SuddenDropInput): SuddenDropResult {
  const allComplete =
    input.evaluatedDayDataQuality === 'complete' &&
    input.baselineDaysDataQuality.every((q) => q === 'complete');

  if (!allComplete || input.baselineAvgYieldL <= 0) {
    return { fired: false, dropPct: null };
  }

  const dropPct = Math.max(
    0,
    Math.round((1 - input.evaluatedDayYieldL / input.baselineAvgYieldL) * 100),
  );
  return { fired: dropPct >= input.dropThresholdPct, dropPct };
}

// ---- 3. Low-peak-by-DIM -----------------------------------------------------

export interface LowPeakByDimInput {
  currentDim: number;
  /** Highest `complete` day recorded so far this lactation (`Lactation.peakMilkYield`), null if none yet. */
  peakMilkYield: number | null;
  lowPeakByDimDays: number;
  minExpectedPeakYieldL: number;
}

/**
 * By `lowPeakByDimDays` DIM, the cow hasn't approached a reasonable peak —
 * either no `complete` day has been recorded at all yet, or the highest
 * recorded day is still below `minExpectedPeakYieldL`.
 */
export function detectLowPeakByDim(input: LowPeakByDimInput): boolean {
  if (input.currentDim < input.lowPeakByDimDays) return false;
  if (input.peakMilkYield == null) return true;
  return input.peakMilkYield < input.minExpectedPeakYieldL;
}

// ---- 4. Long-lactation-not-pregnant -----------------------------------------

export interface LongLactationNotPregnantInput {
  currentDim: number;
  longLactationDimThresholdDays: number;
  hasActivePregnancy: boolean;
}

/**
 * DIM beyond the farm's configured threshold with no active pregnancy on
 * record — doubles as RAKHAL-285's "pregnancy not confirmed, dry-off
 * projection unavailable" surface (a not-pregnant cow only gets the LOW
 * -confidence management-estimate range from `lactation-dry-off-projection.ts`,
 * never a firm `recommendedDryOffAt`).
 */
export function detectLongLactationNotPregnant(
  input: LongLactationNotPregnantInput,
): boolean {
  return (
    input.currentDim >= input.longLactationDimThresholdDays &&
    !input.hasActivePregnancy
  );
}

// ---- 5. Recommended-dry-off-approaching -------------------------------------

export interface DryOffApproachingInput {
  recommendedDryOffAt: Date | null;
  now: Date;
  leadDays: number;
}

/** `recommendedDryOffAt` falls within the next `leadDays` days (inclusive of today, not yet passed). */
export function detectDryOffApproaching(
  input: DryOffApproachingInput,
): boolean {
  if (!input.recommendedDryOffAt) return false;
  const daysUntil = daysBetweenUtc(input.now, input.recommendedDryOffAt);
  return daysUntil >= 0 && daysUntil <= input.leadDays;
}

// ---- 6. Planned-dry-off-due --------------------------------------------------

export interface PlannedDryOffDueInput {
  plannedDryOffAt: Date | null;
  now: Date;
}

/** Today is exactly the farmer-set `plannedDryOffAt` date. */
export function detectPlannedDryOffDue(input: PlannedDryOffDueInput): boolean {
  if (!input.plannedDryOffAt) return false;
  return daysBetweenUtc(input.plannedDryOffAt, input.now) === 0;
}

// ---- 7. Dry-off-overdue ------------------------------------------------------

export interface DryOffOverdueInput {
  recommendedDryOffAt: Date | null;
  now: Date;
}

/**
 * `recommendedDryOffAt` has already passed with no dry-off recorded. The
 * caller only evaluates still-`ACTIVE` lactations, so "no dry-off recorded"
 * is implied by the lactation still being active — not re-checked here.
 */
export function detectDryOffOverdue(input: DryOffOverdueInput): boolean {
  if (!input.recommendedDryOffAt) return false;
  return daysBetweenUtc(input.recommendedDryOffAt, input.now) > 0;
}

// ---- 8. Low-production-dry-off-review ---------------------------------------

export interface LowProductionDryOffReviewInput {
  /** Trailing daily produced-litres, chronological order, most recent last. */
  recentDailyYieldsL: number[];
  thresholdL: number;
  consecutiveDaysRequired: number;
}

/**
 * Production has stayed at/under `thresholdL` for `consecutiveDaysRequired`
 * consecutive days. A **recommendation surfaced to the farmer, never an
 * automatic dry-off** — the caller only ever raises a Task Hub review task
 * from this, it must never itself trigger `recordDryOff()`.
 */
export function detectLowProductionDryOffReview(
  input: LowProductionDryOffReviewInput,
): boolean {
  if (input.recentDailyYieldsL.length < input.consecutiveDaysRequired) {
    return false;
  }
  const lastN = input.recentDailyYieldsL.slice(-input.consecutiveDaysRequired);
  return lastN.every((y) => y <= input.thresholdL);
}

// ---- helpers ------------------------------------------------------------

function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

/** 0-based whole-day difference `end - start`, both UTC-day-truncated (can be negative). */
function daysBetweenUtc(start: Date, end: Date): number {
  const DAY_MS = 24 * 60 * 60 * 1000;
  return Math.round(
    (startOfUtcDay(end).getTime() - startOfUtcDay(start).getTime()) / DAY_MS,
  );
}
