import type { ReportPeriod } from '../../domain/contracts/period';
export type ScheduledType = 'WEEKLY' | 'MONTHLY';
export declare const SCHEDULED_TYPES: readonly ScheduledType[];
export interface DecideScheduledRunsInput {
    farmId: string;
    now: Date;
    farmTimezone: string;
    farmCreatedAt: Date;
    templates: Partial<Record<ScheduledType, {
        version: number;
    }>>;
    catchUpPeriods?: number;
}
export interface DueScheduledRun {
    type: ScheduledType;
    period: ReportPeriod;
    runInstant: Date;
    templateVersion: number;
    scheduledKey: string;
}
export interface MissedSchedule {
    type: ScheduledType;
    periodStartDate: string;
}
export interface DecideScheduledRunsResult {
    due: DueScheduledRun[];
    missedCandidates: MissedSchedule[];
}
export declare function decideScheduledRuns(input: DecideScheduledRunsInput): DecideScheduledRunsResult;
export declare function withinFinalizationWindow(now: Date, runInstant: Date, maxWaitHours: unknown): boolean;
