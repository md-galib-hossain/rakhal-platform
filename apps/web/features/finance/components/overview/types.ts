/**
 * RAKHAL-383 (MILESTONE 22) — Finance Overview screen types. Mirrors `GET /finance/summary`
 * (`PeriodSummaryService`, RAKHAL-371) and `GET /finance/transactions` (`TransactionFeedService`,
 * RAKHAL-370) directly, confirmed against the live backend source. `revenue`/`expenses`/
 * `netProfit`/`netCashFlow` are plain `number` (computed server-side from `Prisma.Decimal` via
 * `Number(...)`, per `ledgerCategoryNet`'s own return type) — **not** Decimal-as-string like every
 * other money field in this codebase; `position.*` amounts ARE Decimal-as-string, same convention
 * as `RakhalBalanceResult`/`AgingReport`.
 */
export interface PeriodMetric {
  current: number;
  previous: number;
  changePct: number | null;
}

export interface FinanceSummary {
  period: { from: string; to: string };
  previousPeriod: { from: string; to: string };
  revenue: PeriodMetric;
  expenses: PeriodMetric;
  netProfit: PeriodMetric;
  netCashFlow: PeriodMetric;
  position: {
    availableBalance: string;
    totalReceivable: string;
    receivableCount: number;
    totalPayable: string;
    payableCount: number;
    accountCount: number;
  };
}

/** Narrow subset of `TransactionListRow` this panel actually renders. */
export interface RecentTransactionRow {
  id: string;
  transactionDate: string;
  typeLabel: string;
  party: { id: string; name: string } | null;
  amount: string;
  cashAmount: string;
  status: "POSTED" | "REVERSED";
}
