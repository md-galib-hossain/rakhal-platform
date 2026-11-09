import { type Money } from 'src/common/money';
import { type MetricValue } from '../../../domain/contracts/metric-value';
export interface CaseRow {
    id: string;
    cattleId: string;
    condition: string | null;
    status: string;
    startDate: Date;
    closedDate: Date | null;
}
export interface TreatmentRow {
    id: string;
    cattleId: string;
    financeTransactionId: string | null;
    vetCost?: number | string | {
        toString(): string;
    } | null;
    vetExpenseId?: string | null;
}
export interface TaskRow {
    id: string;
    cattleId: string;
    planEnrollmentId: string | null;
    status: string;
    dueDateTime: Date;
    completedAt: Date | null;
}
export interface WithdrawalRow {
    id: string;
    cattleId: string;
    status: string;
}
export interface Window {
    start: Date;
    end: Date;
}
export declare const CLOSED_CASE_STATUSES: readonly string[];
export declare const LIVE_TASK_STATUSES: readonly string[];
export declare function distinct(ids: Iterable<string>): string[];
export interface CountWithCows {
    events: number;
    cows: string[];
}
export declare function casesOpened(cases: CaseRow[], w: Window): CountWithCows;
export declare function casesClosed(cases: CaseRow[], w: Window): number;
export declare function casesRecovered(cases: CaseRow[], w: Window): number;
export declare function casesMortality(cases: CaseRow[], w: Window): number;
export declare function casesOpenAt(cases: CaseRow[], at: Date): number;
export declare function treatmentsGiven(treatments: TreatmentRow[]): CountWithCows;
export declare function overdueTasks(tasks: TaskRow[], now: Date): TaskRow[];
export declare function preventiveCompleted(tasks: TaskRow[], w: Window): number;
export declare function preventiveMissed(tasks: TaskRow[], w: Window): number;
export declare function repeatedCases(opened: CaseRow[], candidates: CaseRow[], windowDays: number): CountWithCows;
export declare const ACTIVE_WITHDRAWAL_STATUSES: readonly string[];
export declare function activeWithdrawals(rows: WithdrawalRow[]): CountWithCows;
export interface CostResult {
    value: MetricValue;
    hasUnresolved: boolean;
    partial: boolean;
}
export declare function vetFees(treatments: TreatmentRow[], amountById: ReadonlyMap<string, Money>, unit?: string): CostResult;
export declare function treatmentCost(treatments: TreatmentRow[], amountById: ReadonlyMap<string, Money>, unit?: string): CostResult;
