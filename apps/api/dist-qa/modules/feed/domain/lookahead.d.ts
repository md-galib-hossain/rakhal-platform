export type LookaheadKind = 'dry_off' | 'calving' | 'peak_dim';
export interface LookaheadEvent {
    kind: LookaheadKind;
    in_days: number;
}
export declare const ASSUMED_PEAK_DIM = 60;
export interface LookaheadInput {
    now: Date;
    windowDays: number;
    expectedCalvingDate?: Date | null;
    dryOffDate?: Date | null;
    lactationStart?: Date | null;
    peakDaysInMilk?: number | null;
}
export declare function computeLookahead(input: LookaheadInput): LookaheadEvent[];
