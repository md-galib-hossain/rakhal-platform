"use client";

import { apiFetch, apiFetchPage } from "@/lib/api/client";
import type { CursorPage } from "@/types/api";
import type { FinanceSummary, RecentTransactionRow } from "./types";

/** RAKHAL-383 (MILESTONE 22) — Finance Overview data. `GET /finance/summary` (RAKHAL-371) and
 * `GET /finance/transactions` (RAKHAL-370) — both real, live routes confirmed against backend
 * source, not the aspirational API doc. */
export const overviewApi = {
  getSummary(from: string, to: string): Promise<FinanceSummary> {
    return apiFetch<FinanceSummary>("/finance/summary", { searchParams: { from, to } });
  },
  listRecentTransactions(limit: number): Promise<CursorPage<RecentTransactionRow>> {
    return apiFetchPage<RecentTransactionRow>("/finance/transactions", { searchParams: { limit } });
  },
};
