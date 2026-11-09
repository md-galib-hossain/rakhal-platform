export type DryOffConfidence = 'LOW';
export interface DryOffProjectionResult {
    recommendedDryOffAt: Date | null;
    managementEstimateDimRange: [number, number] | null;
    confidence: DryOffConfidence | null;
    reason: string | null;
}
export interface PregnantDryOffProjectionInput {
    isPregnant: true;
    expectedCalvingDate: Date;
    dryPeriodDays: number;
}
export interface NotPregnantDryOffProjectionInput {
    isPregnant: false;
    previousLactationLengthsDays: number[];
    fallbackRangeDays?: [number, number];
}
export type DryOffProjectionInput = PregnantDryOffProjectionInput | NotPregnantDryOffProjectionInput;
export declare function computeDryOffProjection(input: DryOffProjectionInput): DryOffProjectionResult;
export declare function computeStandardized305DayYield(params: {
    producedToDateL: number;
    daysInMilk: number;
    minDimThreshold: number;
}): number | null;
