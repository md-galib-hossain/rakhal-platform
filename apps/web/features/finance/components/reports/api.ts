"use client";

import { apiFetch } from "@/lib/api/client";
import type { CashFlowReport, ProfitLossReport } from "./types";

/** RAKHAL-387 (MILESTONE 22) — Finance Reports tab data. `GET /finance/reports/{profit-loss,
 * cash-flow}?from&to` (RAKHAL-379), synchronous JSON — deliberately distinct from the existing
 * async job-based Reports module (`features/reports/**`, CSV/PDF via BullMQ); this tab is an
 * interactive screen, not a download queue. Trial Balance intentionally has no client here — it is
 * Owner-only, `finance.accounting`-gated, and not one of the tab's four reports (`types.ts`'s own
 * doc comment + `BUSINESS_IA_PRD.md` §9.2). */
export const financeReportsApi = {
  profitLoss(from: string, to: string): Promise<ProfitLossReport> {
    return apiFetch<ProfitLossReport>("/finance/reports/profit-loss", { searchParams: { from, to } });
  },
  cashFlow(from: string, to: string): Promise<CashFlowReport> {
    return apiFetch<CashFlowReport>("/finance/reports/cash-flow", { searchParams: { from, to } });
  },
};
