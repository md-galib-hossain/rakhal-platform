import { type Money } from 'src/common/money';
import type { ReportPeriod } from '../../../domain/contracts/period';
import type { ReportDb } from '../metric-context';
import { type CaseRow, type TaskRow, type TreatmentRow, type WithdrawalRow, type Window } from './health-aggregation';
export declare const toWindow: (p: ReportPeriod) => Window;
interface Scope {
    db: ReportDb;
    farmId: string;
    cattleIds: readonly string[];
}
export declare function fetchCases(s: Scope, w: Window): Promise<CaseRow[]>;
export declare function fetchRepeatCandidates(s: Scope, w: Window, cattleIds: readonly string[], windowDays: number): Promise<CaseRow[]>;
export declare function fetchTreatments(s: Scope, w: Window): Promise<TreatmentRow[]>;
export declare function fetchExpenseAmounts(s: Scope, ids: readonly string[]): Promise<Map<string, Money>>;
export declare function fetchTasks(s: Scope, w: Window, now: Date | null): Promise<TaskRow[]>;
export declare function fetchActiveWithdrawals(s: Scope): Promise<WithdrawalRow[]>;
export {};
