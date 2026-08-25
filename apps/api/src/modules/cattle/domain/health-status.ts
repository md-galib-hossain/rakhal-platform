/**
 * Derived health-status dimension (PRD §8.1). Health status is NOT stored on the
 * cattle row — it is computed from the animal's open Healthcare records. Pure
 * function (no Prisma/framework) so it is unit-testable and shared by the list
 * projection and any future detail endpoints.
 *
 * **RAKHAL-279 correction**: `WITHHOLDING` was dropped from this dimension.
 * Milk eligibility (RAKHAL-278, `MilkService.getMilkEligibility()` /
 * `deriveMilkEligibility()` in `src/modules/milk/domain/milk-eligibility.ts`)
 * is now the sole owner of that signal — it already reads the same
 * `SafetyWithdrawal`/`HealthCase` withholding facts via
 * `HealthService.activeMilkWithholdingCattleIds()` (a pure read) and folds
 * them into a richer `{ isSaleable, primaryStatus, reasons[] }` shape that
 * also accounts for the colostrum window and discard holds — a plain
 * `healthStatus === 'WITHHOLDING'` badge duplicated a strict subset of that
 * and risked drifting out of sync with it. `deriveHealthStatus()` is now
 * purely about the animal's health *condition* (sick / under treatment /
 * healthy), not its milk-sale eligibility. See `docs/DECISIONS.md` for the
 * full write-up of this call, including why the `?healthStatus=WITHHOLDING`
 * list **filter** (`ListCattleQueryDto`/`healthStatusWhere()`) was
 * deliberately left in place even though the derived value it used to
 * describe no longer exists.
 */

export type DerivedHealthStatus =
  | 'HEALTHY'
  | 'SICK'
  | 'IN_TREATMENT'
  | 'QUARANTINE';

/**
 * Diagnosis types that represent proactive/preventive care rather than actual
 * illness or injury. A HealthCase opened for one of these (e.g. giving a
 * vaccine) must not read the cow as SICK — only DISEASE/INJURY/OTHER cases
 * should.
 */
export const PREVENTIVE_DIAGNOSIS_TYPES = [
  'VACCINATION',
  'PREVENTIVE',
  'DEWORMING',
  'ROUTINE_CHECKUP',
  'BREEDING_RELATED',
] as const;

const PREVENTIVE_DIAGNOSIS_TYPE_SET = new Set<string>(
  PREVENTIVE_DIAGNOSIS_TYPES,
);

export function isPreventiveDiagnosisType(diagnosisType: string): boolean {
  return PREVENTIVE_DIAGNOSIS_TYPE_SET.has(diagnosisType);
}

export interface OpenHealthCaseInput {
  /** HealthCase status — `ACTIVE` = just reported (Sick); the others = under treatment. */
  status: string;
  /** HealthDiagnosisType — preventive types are excluded from SICK/IN_TREATMENT derivation. */
  diagnosisType: string;
}

/**
 * Resolve the health-status badge for a cow.
 *
 * Precedence (PRD §8.1, RAKHAL-279 correction): a case under treatment
 * (status moved past `ACTIVE`) reads as in-treatment; a freshly reported case
 * (still `ACTIVE`) reads as sick (PRD §8.7); otherwise healthy. Quarantine is
 * not tracked yet (deferred to Healthcare) so it is never returned here.
 * Milk/meat withholding no longer participates in this derivation — see the
 * file-level doc comment.
 *
 * @param openCases open `HealthCase` rows for the cow (already filtered to non-closed statuses)
 */
export function deriveHealthStatus(
  openCases: OpenHealthCaseInput[],
): DerivedHealthStatus {
  const sicknessCases = openCases.filter(
    (c) => !isPreventiveDiagnosisType(c.diagnosisType),
  );
  if (sicknessCases.some((c) => c.status !== 'ACTIVE')) {
    return 'IN_TREATMENT';
  }
  if (sicknessCases.length > 0) {
    return 'SICK';
  }
  return 'HEALTHY';
}
