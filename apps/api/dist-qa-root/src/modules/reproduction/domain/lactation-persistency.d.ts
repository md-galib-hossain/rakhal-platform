export interface LactationPersistency {
    currentSevenDayAvgYield: number;
    peakMilkYield: number;
    peakDaysInMilk: number;
    daysSincePeak: number;
    persistencyPct: number;
    declinePct: number;
}
export declare function computeLactationPersistency(params: {
    currentSevenDayAvgYield: number;
    peakMilkYield: number | null;
    peakDaysInMilk: number | null;
    currentDaysInMilk: number;
}): LactationPersistency | null;
