export type BreedingStatus =
  | 'PENDING_CHECK'
  | 'PREGNANT'
  | 'FAILED'
  | 'ABORTED'
  | 'CALVED'
  | 'RETURNED_TO_HEAT'
  | 'VOIDED';

export type BreedingClass =
  | 'confirmed'
  | 'pending'
  | 'failed'
  | 'other'
  | 'excluded';

/** Pending is NEVER failed: an unchecked service is unknown, not a miss. */
export function classifyBreedingStatus(status: BreedingStatus): BreedingClass {
  switch (status) {
    case 'PREGNANT':
    case 'CALVED':
      return 'confirmed';
    case 'PENDING_CHECK':
      return 'pending';
    case 'FAILED':
      return 'failed';
    case 'RETURNED_TO_HEAT':
    case 'ABORTED':
      return 'other';
    case 'VOIDED':
      return 'excluded';
  }
}

export interface BreedingRow {
  status: BreedingStatus;
  voidedAt?: Date | null;
}

/** Eligible for reproduction metrics: not voided (by timestamp or status). */
export function isReproductionEligible(row: BreedingRow): boolean {
  return !row.voidedAt && classifyBreedingStatus(row.status) !== 'excluded';
}

export interface MilkRowInput {
  submitted: boolean;
  yieldL: number | null | undefined;
}

/** Decision 7: only submitted rows with a finite, non-negative yield count. A 0 yield IS eligible. */
export function isMilkEligibleRow(row: MilkRowInput): boolean {
  return (
    row.submitted === true &&
    typeof row.yieldL === 'number' &&
    Number.isFinite(row.yieldL) &&
    row.yieldL >= 0
  );
}

/** True if any row is an unsubmitted draft (DataQuality flag; drafts are never counted). */
export function hasUnsubmittedDrafts(rows: readonly MilkRowInput[]): boolean {
  return rows.some((r) => r.submitted !== true);
}
