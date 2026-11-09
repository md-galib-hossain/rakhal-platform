export type FoldFactType = 'BREEDING' | 'PREG_CHECK' | 'CALVING' | 'ABORTION' | 'HEAT';
export interface FoldFact {
    id: string;
    type: FoldFactType;
    at: Date;
    provenance: 'RECORDED' | 'HISTORICAL';
    open?: boolean;
    endedInPregnancy?: boolean;
    result?: 'PREGNANT' | 'NOT_PREGNANT' | 'SUSPECTED';
    gestationDay?: number | null;
    expectedCalvingDate?: Date | null;
    breedingDate?: Date | null;
}
export interface FoldedPregnancy {
    checkedAt: Date;
    conceptionDate: Date | null;
    confidence: 'RECORDED' | 'ESTIMATED' | 'UNKNOWN';
    expectedCalvingDate: Date | null;
    historical: boolean;
}
export interface FoldResult {
    hasActivePregnancy: boolean;
    pregnancy: FoldedPregnancy | null;
    pendingBreeding: {
        id: string;
        at: Date;
        historical: boolean;
    } | null;
    lastBreedingAt: Date | null;
    lastCalvingAt: Date | null;
    lastCheckAt: Date | null;
    lastAbortionAt: Date | null;
}
export declare function sortFacts(facts: readonly FoldFact[]): FoldFact[];
export declare function foldReproduction(facts: readonly FoldFact[]): FoldResult;
