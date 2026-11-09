import type { MilkSession } from '@prisma/client';
export interface MilkRow {
    cattleId: string;
    logDate: Date;
    session: MilkSession;
    yieldL: number;
    disposition: string;
    submitted: boolean;
}
export interface CowMilk {
    cattleId: string;
    totalYieldL: number;
    recordedDays: number;
    expectedDays: number;
    avgPerRecordedDayL: number;
}
export interface DailyMilk {
    date: string;
    yieldL: number | null;
    cowsRecorded: number;
}
export interface MilkAggregate {
    days: string[];
    cowCount: number;
    totalYieldL: number | null;
    recordedCowDays: number;
    expectedCowDays: number;
    expectedEstimated: boolean;
    expectedDaysByCow: Record<string, number>;
    avgDailyYieldPerRecordedCowDayL: number | null;
    cowsWithData: number;
    daily: DailyMilk[];
    perCow: CowMilk[];
    cowsWithoutData: string[];
    dispositionTotalsL: Record<string, number>;
}
export declare const dayKey: (d: Date) => string;
export declare function aggregateMilk(input: {
    rows: readonly MilkRow[];
    cattleIds: readonly string[];
    days: readonly string[];
    presence?: ReadonlyMap<string, {
        startDate: string;
        endDate: string;
    }>;
}): MilkAggregate;
export declare function rankCows(perCow: readonly CowMilk[], n?: number): {
    top: CowMilk[];
    bottom: CowMilk[];
};
export interface SuddenDropFinding {
    cattleId: string;
    dropPct: number;
}
export interface SuddenDropEvaluation {
    evaluatedCows: number;
    findings: SuddenDropFinding[];
}
export declare function evaluateSuddenDrops(input: {
    rows: readonly MilkRow[];
    cattleIds: readonly string[];
    evaluatedDate: string | null;
    expectedSessions: MilkSession[];
    dropThresholdPct: number;
}): SuddenDropEvaluation;
