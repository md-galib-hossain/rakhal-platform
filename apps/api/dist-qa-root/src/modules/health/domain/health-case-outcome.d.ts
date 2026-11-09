export declare const RECURRENCE_WINDOW_DAYS = 60;
export declare function elapsedDays(from: Date, to: Date): number;
export declare function dayOfIllness(start: Date, now: Date): number;
export interface CaseTimeline {
    id: string;
    cattleId: string;
    condition: string | null;
    startDate: Date;
    closedDate: Date | null;
}
export declare function findPreviousSameCondition(current: CaseTimeline, others: CaseTimeline[], windowDays?: number): CaseTimeline | null;
export interface OutcomeCase {
    condition: string | null;
    status: string;
    startDate: Date;
    closedDate: Date | null;
    cost: number;
    isRecurrence: boolean;
}
export interface OutcomeBreakdown {
    cases: number;
    recovered: number;
    mortality: number;
    recoveryRate: number | null;
    avgDaysToRecover: number | null;
    avgCost: number | null;
}
export interface OutcomeSummary extends OutcomeBreakdown {
    openCases: number;
    otherClosed: number;
    totalCost: number;
    recurrenceRate: number | null;
    byCondition: (OutcomeBreakdown & {
        condition: string | null;
    })[];
}
export declare function aggregateOutcomes(cases: OutcomeCase[]): OutcomeSummary;
