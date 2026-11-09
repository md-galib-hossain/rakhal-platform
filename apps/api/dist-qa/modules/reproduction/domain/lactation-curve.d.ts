import { MilkSession } from '@prisma/client';
export type DimDataQuality = 'complete' | 'incomplete' | 'missing';
export interface DailyYieldPoint {
    dim: number;
    date: string;
    yieldL: number;
    sessionsRecorded: number;
    sessionsExpected: number;
    dataQuality: DimDataQuality;
}
export interface CurveEntry {
    logDate: Date;
    session: MilkSession;
    yieldL: number;
}
export declare function buildDailyYieldSeries(params: {
    startDate: Date;
    endDate: Date;
    entries: CurveEntry[];
    expectedSessions: MilkSession[];
}): DailyYieldPoint[];
