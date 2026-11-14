/**
 * Pure milk-disposition domain helper (RAKHAL-277). No framework/Prisma deps so it
 * is trivially unit-testable. `MilkDisposition` is the *business-meaning*
 * classification of a milk-log entry — distinct from `MilkTankType`, which is the
 * *physical* tank the milk gets routed into (`MilkService` keeps those two concerns
 * separate; a `WITHHELD`-disposition entry still routes to the WITHHOLDING tank).
 */
import { MilkDisposition } from '@prisma/client';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface ResolveMilkDispositionInput {
  /** From `HealthService.activeMilkWithholdingCattleIds` (RAKHAL-276) — a pure read. */
  isWithheld: boolean;
  /** The cow's active `Lactation.startDate` (no `endDate`), or `null` if she has none. */
  activeLactationStartDate: Date | null;
  /** The production day this entry is logged for (may be backdated). */
  logDate: Date;
  /** `FarmSettingsService.milkColostrumWindowDays` — days since `startDate` that count as colostrum. */
  colostrumWindowDays: number;
}

/**
 * Resolves a single cow's milk disposition for one log entry.
 *
 * Precedence (RAKHAL-277's own call, documented per the ticket's explicit ask):
 * **`WITHHELD` wins over `COLOSTRUM`.** A cow can conceptually be both — freshly
 * calved *and* under an antibiotic safety withdrawal — but this field carries a
 * single value, and a withheld cow's milk absolutely cannot be sold regardless of
 * colostrum status. (RAKHAL-278's `MilkEligibility` later captures both reasons
 * as a `reasons[]` list; this field stays the single winning classification.)
 *
 * `CALF_FEED`/`DISCARDED`/`HOUSEHOLD_USE` are manual/operator dispositions the
 * enum supports but this function never assigns automatically — out of this
 * ticket's scope.
 */
export function resolveMilkDisposition({
  isWithheld,
  activeLactationStartDate,
  logDate,
  colostrumWindowDays,
}: ResolveMilkDispositionInput): MilkDisposition {
  if (isWithheld) return MilkDisposition.WITHHELD;

  if (
    isWithinColostrumWindow({
      activeLactationStartDate,
      asOfDate: logDate,
      colostrumWindowDays,
    })
  ) {
    return MilkDisposition.COLOSTRUM;
  }

  return MilkDisposition.SALEABLE;
}

export interface IsWithinColostrumWindowInput {
  /** The cow's active `Lactation.startDate` (no `endDate`), or `null` if she has none. */
  activeLactationStartDate: Date | null;
  /** The date to evaluate the window against — a log's production day, or "now" for a
   * point-in-time display read (RAKHAL-278's `MilkEligibility`). */
  asOfDate: Date;
  /** `FarmSettingsService.milkColostrumWindowDays` — days since `startDate` that count as colostrum. */
  colostrumWindowDays: number;
}

/**
 * Shared pure colostrum-window check, extracted from {@link resolveMilkDisposition}
 * (RAKHAL-277) so RAKHAL-278's animal-level `MilkEligibility` view can reuse the exact
 * same window semantics rather than risk diverging with a re-implementation.
 */
export function isWithinColostrumWindow({
  activeLactationStartDate,
  asOfDate,
  colostrumWindowDays,
}: IsWithinColostrumWindowInput): boolean {
  if (!activeLactationStartDate) return false;
  const daysSinceStart = Math.floor(
    (asOfDate.getTime() - activeLactationStartDate.getTime()) / DAY_MS,
  );
  return daysSinceStart >= 0 && daysSinceStart < colostrumWindowDays;
}
