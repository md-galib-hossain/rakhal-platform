export type LactationStage = 'FRESH' | 'EARLY' | 'MID' | 'LATE' | 'DRY_PERIOD';
export interface LactationStageInput {
    now: Date;
    lactationStartDate: Date | null;
    isInActiveDryPeriod: boolean;
    farmSettings: {
        freshDays: number;
        earlyDays: number;
        midDays: number;
    };
}
export declare function deriveLactationStage(input: LactationStageInput): LactationStage | null;
