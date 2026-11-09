export type MilkEligibilityStatus = 'SALEABLE' | 'WITHHELD' | 'COLOSTRUM' | 'DISCARD_REQUIRED';
export type MilkRestrictionReason = 'COLOSTRUM_PERIOD' | 'MEDICINE_WITHDRAWAL' | 'MASTITIS' | 'VETERINARY_HOLD' | 'ABNORMAL_MILK' | 'OTHER';
export interface MilkEligibility {
    isSaleable: boolean;
    primaryStatus: MilkEligibilityStatus;
    reasons: MilkRestrictionReason[];
}
export interface DeriveMilkEligibilityInput {
    isWithheld: boolean;
    isInColostrumWindow: boolean;
    hasDiscardRequiredHold: boolean;
}
export declare function deriveMilkEligibility({ isWithheld, isInColostrumWindow, hasDiscardRequiredHold, }: DeriveMilkEligibilityInput): MilkEligibility;
