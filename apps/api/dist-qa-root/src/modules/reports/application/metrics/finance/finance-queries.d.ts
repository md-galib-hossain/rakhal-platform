import { type Money } from 'src/common/money';
import type { ReportDb } from '../metric-context';
export declare const TRANSFER_SOURCE = "FINANCE_TRANSFER";
export declare const OPENING_BALANCE_SOURCE = "FINANCIAL_ACCOUNT_OPENING_BALANCE";
export interface CashFlow {
    received: Money;
    paid: Money;
}
export declare function cashLedgerIds(db: ReportDb, farmId: string): Promise<string[]>;
export declare function cashFlow(db: ReportDb, ids: string[], from: Date, to: Date): Promise<CashFlow>;
export declare function balanceBefore(db: ReportDb, ids: string[], at: Date): Promise<Money>;
export declare function expensesByCategory(db: ReportDb, farmId: string, from: Date, to: Date): Promise<Map<string, Money>>;
