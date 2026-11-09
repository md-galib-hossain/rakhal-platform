import { DimDataQuality } from './lactation-curve';
export declare const DEFAULT_LOW_PEAK_BY_DIM_DAYS = 60;
export declare const DEFAULT_LOW_PEAK_MIN_YIELD_L = 8;
export declare const DEFAULT_DRY_OFF_APPROACHING_LEAD_DAYS = 14;
export declare const DEFAULT_LOW_PRODUCTION_DRY_OFF_THRESHOLD_L = 5;
export declare const DEFAULT_LOW_PRODUCTION_DRY_OFF_CONSECUTIVE_DAYS = 3;
export interface MissingSessionInput {
    dataQuality: DimDataQuality;
}
export declare function detectMissingSession(input: MissingSessionInput): boolean;
export interface SuddenDropInput {
    evaluatedDayYieldL: number;
    evaluatedDayDataQuality: DimDataQuality;
    baselineDaysDataQuality: DimDataQuality[];
    baselineAvgYieldL: number;
    dropThresholdPct: number;
}
export interface SuddenDropResult {
    fired: boolean;
    dropPct: number | null;
}
export declare function detectSuddenDrop(input: SuddenDropInput): SuddenDropResult;
export interface LowPeakByDimInput {
    currentDim: number;
    peakMilkYield: number | null;
    lowPeakByDimDays: number;
    minExpectedPeakYieldL: number;
}
export declare function detectLowPeakByDim(input: LowPeakByDimInput): boolean;
export interface LongLactationNotPregnantInput {
    currentDim: number;
    longLactationDimThresholdDays: number;
    hasActivePregnancy: boolean;
}
export declare function detectLongLactationNotPregnant(input: LongLactationNotPregnantInput): boolean;
export interface DryOffApproachingInput {
    recommendedDryOffAt: Date | null;
    now: Date;
    leadDays: number;
}
export declare function detectDryOffApproaching(input: DryOffApproachingInput): boolean;
export interface PlannedDryOffDueInput {
    plannedDryOffAt: Date | null;
    now: Date;
}
export declare function detectPlannedDryOffDue(input: PlannedDryOffDueInput): boolean;
export interface DryOffOverdueInput {
    recommendedDryOffAt: Date | null;
    now: Date;
}
export declare function detectDryOffOverdue(input: DryOffOverdueInput): boolean;
export interface LowProductionDryOffReviewInput {
    recentDailyYieldsL: number[];
    thresholdL: number;
    consecutiveDaysRequired: number;
}
export declare function detectLowProductionDryOffReview(input: LowProductionDryOffReviewInput): boolean;
