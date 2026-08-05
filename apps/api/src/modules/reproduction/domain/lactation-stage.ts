/**
 * Derived (not stored) lactation stage (RAKHAL-273). Sourced from the active
 * `Lactation.startDate` (the canonical field — `Cattle.lactationStartDate`
 * was removed in RAKHAL-269's v2 correction, see
 * `docs/PROJECT_PROGRESS.md` MILESTONE 10) and the open `DryPeriod`, if any.
 * Pure derive function, no framework/Prisma imports, mirrors
 * `deriveReproductionState`/`deriveReproductionAlerts`'s
 * testability-without-a-Prisma-double pattern.
 */
export type LactationStage = 'FRESH' | 'EARLY' | 'MID' | 'LATE' | 'DRY_PERIOD';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface LactationStageInput {
  now: Date;
  /** The cow's active `Lactation.startDate` (status ACTIVE, no `endDate`), or
   * `null` if she has none (e.g. a heifer that's never calved). */
  lactationStartDate: Date | null;
  /** Whether the cow is currently inside an open `DryPeriod` (no
   * `actualEndDate` set) — takes priority over the lactation-day thresholds. */
  isInActiveDryPeriod: boolean;
  farmSettings: {
    /** 0..freshDays since `lactationStartDate` → FRESH. */
    freshDays: number;
    /** freshDays..earlyDays → EARLY. */
    earlyDays: number;
    /** earlyDays..midDays → MID; beyond midDays → LATE. */
    midDays: number;
  };
}

/**
 * Pure `LactationStage` derivation.
 *
 * Priority: an active dry period always wins (`DRY_PERIOD`) — a dry cow has
 * no meaningful days-in-milk figure regardless of what her last lactation's
 * `startDate` says. Otherwise, days since the active `Lactation.startDate`
 * are bucketed against the farm's configurable thresholds: `0..freshDays` =
 * FRESH, `freshDays..earlyDays` = EARLY, `earlyDays..midDays` = MID, anything
 * beyond `midDays` = LATE (until the cow is dried off). A cow with no active
 * lactation and no active dry period (e.g. a heifer, or an archived/newly
 * registered cow) has no lactation stage — returns `null`.
 */
export function deriveLactationStage(
  input: LactationStageInput,
): LactationStage | null {
  const { now, lactationStartDate, isInActiveDryPeriod, farmSettings } = input;

  if (isInActiveDryPeriod) {
    return 'DRY_PERIOD';
  }

  if (!lactationStartDate) {
    return null;
  }

  const daysInMilk = Math.floor(
    (now.getTime() - lactationStartDate.getTime()) / DAY_MS,
  );

  if (daysInMilk <= farmSettings.freshDays) {
    return 'FRESH';
  }
  if (daysInMilk <= farmSettings.earlyDays) {
    return 'EARLY';
  }
  if (daysInMilk <= farmSettings.midDays) {
    return 'MID';
  }
  return 'LATE';
}
