/**
 * RAKHAL-387 (MILESTONE 22) — Finance Reports tab types. Mirrors `ProfitLossReport`/
 * `CashFlowReport` (`business-reporting/application/reports/{profit-loss,cash-flow}-report.
 * service.ts`, RAKHAL-379) directly. Every money field is Decimal-as-string.
 */
export interface ProfitLossLine {
  code: string;
  name: string;
  amount: string;
}

export interface ProfitLossReport {
  period: { from: string; to: string };
  revenue: { lines: ProfitLossLine[]; total: string };
  expenses: { lines: ProfitLossLine[]; total: string };
  netProfit: string;
}

export interface CashFlowAccountLine {
  id: string;
  name: string;
  type: "CASH" | "BANK" | "MFS";
  openingBalance: string;
  inflow: string;
  outflow: string;
  closingBalance: string;
}

export interface CashFlowReport {
  period: { from: string; to: string };
  accounts: CashFlowAccountLine[];
  totals: {
    openingBalance: string;
    inflow: string;
    outflow: string;
    closingBalance: string;
  };
}
