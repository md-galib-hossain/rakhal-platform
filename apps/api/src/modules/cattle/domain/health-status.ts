/**
 * Derived health-status dimension (PRD §8.1). Health status is NOT stored on the
 * cattle row — it is computed from the animal's open Healthcare records. Pure
 * function (no Prisma/framework) so it is unit-testable and shared by the list
 * projection and any future detail endpoints.
 */

export type DerivedHealthStatus =
  | 'HEALTHY'
  | 'SICK'
  | 'IN_TREATMENT'
  | 'WITHHOLDING'
  | 'QUARANTINE';

export interface OpenHealthCaseInput {
  /** HealthCase status — `ACTIVE` = just reported (Sick); the others = under treatment. */
  status: string;
  isSafetyWithholdingActive: boolean;
  milkWithdrawalUntil: Date | null;
}

export interface ActiveWithdrawalInput {
  milkWithdrawalUntil: Date | null;
  meatWithdrawalUntil: Date | null;
}

/**
 * Resolve the health-status badge for a cow.
 *
 * Precedence (PRD §8.1): active milk/meat withholding wins (it gates milk sale);
 * then a case under treatment (status moved past `ACTIVE`) reads as in-treatment;
 * a freshly reported case (still `ACTIVE`) reads as sick (PRD §8.7); otherwise
 * healthy. Quarantine is not tracked yet (deferred to Healthcare) so it is never
 * returned here.
 *
 * @param openCases   open `HealthCase` rows for the cow (already filtered to non-closed statuses)
 * @param withdrawals active `SafetyWithdrawal` rows for the cow
 * @param now         reference time (injected for testability)
 */
export function deriveHealthStatus(
  openCases: OpenHealthCaseInput[],
  withdrawals: ActiveWithdrawalInput[],
  now: Date = new Date(),
): DerivedHealthStatus {
  const withholding =
    withdrawals.some(
      (w) =>
        (w.milkWithdrawalUntil && w.milkWithdrawalUntil > now) ||
        (w.meatWithdrawalUntil && w.meatWithdrawalUntil > now),
    ) ||
    openCases.some(
      (c) =>
        c.isSafetyWithholdingActive &&
        c.milkWithdrawalUntil &&
        c.milkWithdrawalUntil > now,
    );

  if (withholding) {
    return 'WITHHOLDING';
  }
  if (openCases.some((c) => c.status !== 'ACTIVE')) {
    return 'IN_TREATMENT';
  }
  if (openCases.length > 0) {
    return 'SICK';
  }
  return 'HEALTHY';
}
