export type PregnancyStage = 'EARLY' | 'MID' | 'LATE' | 'CLOSE_UP';
export interface PregnancyStageInput {
    now: Date;
    conceptionDate: Date | null;
    farmSettings: {
        earlyDays: number;
        midDays: number;
        closeUpWindowDays: number;
        gestationDays: number;
    };
}
export declare function derivePregnancyStage(input: PregnancyStageInput): PregnancyStage | null;
