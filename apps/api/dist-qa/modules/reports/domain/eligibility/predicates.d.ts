export type BreedingStatus = 'PENDING_CHECK' | 'PREGNANT' | 'FAILED' | 'ABORTED' | 'CALVED' | 'RETURNED_TO_HEAT' | 'VOIDED';
export type BreedingClass = 'confirmed' | 'pending' | 'failed' | 'other' | 'excluded';
export declare function classifyBreedingStatus(status: BreedingStatus): BreedingClass;
export interface BreedingRow {
    status: BreedingStatus;
    voidedAt?: Date | null;
}
export declare function isReproductionEligible(row: BreedingRow): boolean;
export interface MilkRowInput {
    submitted: boolean;
    yieldL: number | null | undefined;
}
export declare function isMilkEligibleRow(row: MilkRowInput): boolean;
export declare function hasUnsubmittedDrafts(rows: readonly MilkRowInput[]): boolean;
