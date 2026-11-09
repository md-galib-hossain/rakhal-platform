export declare const ESTIMATE_GESTATION_DAYS = 280;
export type ConceptionEstimateSource = 'BREEDING' | 'GESTATION_DAY' | 'EXPECTED_CALVING' | 'FALLBACK';
export interface PregnancyEstimateInput {
    diagnosisDate: Date;
    breedingDate?: Date | null;
    gestationDay?: number | null;
    expectedCalvingDate?: Date | null;
}
export type ConceptionConfidence = 'RECORDED' | 'ESTIMATED' | 'UNKNOWN';
export interface PregnancyEstimate {
    conceptionDate: Date | null;
    calculatedCalvingDate: Date | null;
    source: ConceptionEstimateSource;
    confidence: ConceptionConfidence;
}
export declare function estimatePregnancyDates(input: PregnancyEstimateInput): PregnancyEstimate;
