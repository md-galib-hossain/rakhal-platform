export interface PeriodRange {
    from: Date;
    to: Date;
}
export declare function derivePreviousPeriod(period: PeriodRange): PeriodRange;
export declare function changePct(current: number, previous: number): number | null;
