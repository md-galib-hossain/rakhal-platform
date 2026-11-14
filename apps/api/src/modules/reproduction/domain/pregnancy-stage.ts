/**
 * Derived (not stored) pregnancy stage (RAKHAL-273). Sourced from the active
 * `Pregnancy.conceptionDate`. Pure derive function, no framework/Prisma
 * imports, mirrors `deriveReproductionState`/`deriveReproductionAlerts`'s
 * testability-without-a-Prisma-double pattern.
 */
export type PregnancyStage = 'EARLY' | 'MID' | 'LATE' | 'CLOSE_UP';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface PregnancyStageInput {
  now: Date;
  /** The cow's active `Pregnancy.conceptionDate`, or `null` if she has no
   * active pregnancy (e.g. a dry/open cow, or a heifer). */
  conceptionDate: Date | null;
  farmSettings: {
    /** 0..earlyDays since `conceptionDate` → EARLY. */
    earlyDays: number;
    /** earlyDays..midDays → MID. */
    midDays: number;
    /** The final `closeUpWindowDays` before the expected calving date
     * (already-existing `reproCloseUpWindowDays` setting, RAKHAL-271 — reused
     * here rather than duplicated) → CLOSE_UP, overriding whatever the
     * elapsed-days bucket would otherwise say. Everything past `midDays` and
     * outside the close-up window → LATE. */
    closeUpWindowDays: number;
    /** Gestation length, in days, used to project the expected calving date
     * from `conceptionDate` for the close-up-window check. Standard bovine
     * gestation is ~280 days — matches the fallback `createPregnancyDiagnosis`
     * already uses (`reproduction.service.ts`) when no explicit
     * `expectedCalvingDate` is recorded. */
    gestationDays: number;
  };
}

/**
 * Pure `PregnancyStage` derivation.
 *
 * Days since `conceptionDate` are bucketed: `0..earlyDays` = EARLY,
 * `earlyDays..midDays` = MID, beyond `midDays` = LATE — except inside the
 * final `closeUpWindowDays` before the (projected) expected calving date,
 * which always reads `CLOSE_UP` regardless of the elapsed-days bucket (a cow
 * conceiving with an unusually short remaining gestation should still surface
 * as close-up). A cow with no active pregnancy has no pregnancy stage —
 * returns `null`.
 */
export function derivePregnancyStage(
  input: PregnancyStageInput,
): PregnancyStage | null {
  const { now, conceptionDate, farmSettings } = input;

  if (!conceptionDate) {
    return null;
  }

  const daysPregnant = Math.floor(
    (now.getTime() - conceptionDate.getTime()) / DAY_MS,
  );

  const expectedCalvingDate = new Date(
    conceptionDate.getTime() + farmSettings.gestationDays * DAY_MS,
  );
  const closeUpCutoff = new Date(
    expectedCalvingDate.getTime() - farmSettings.closeUpWindowDays * DAY_MS,
  );
  if (now >= closeUpCutoff) {
    return 'CLOSE_UP';
  }

  if (daysPregnant <= farmSettings.earlyDays) {
    return 'EARLY';
  }
  if (daysPregnant <= farmSettings.midDays) {
    return 'MID';
  }
  return 'LATE';
}
