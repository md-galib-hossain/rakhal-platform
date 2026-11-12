"use client";

import { apiFetchPage } from "@/lib/api/client";
import type { CursorPage } from "@/types/api";
import type { TransactionRow, TransactionsFilters } from "./types";

/** RAKHAL-385 (MILESTONE 22) — full Transactions feed. Same `GET /finance/transactions` (RAKHAL-370)
 * route `overview/api.ts#listRecentTransactions` hits, called here with the real filter set + cursor
 * "load more" instead of a fixed `limit:5`. */
export const transactionsApi = {
  list(filters: TransactionsFilters, cursor: string | undefined, limit: number): Promise<CursorPage<TransactionRow>> {
    return apiFetchPage<TransactionRow>("/finance/transactions", {
      searchParams: { ...filters, cursor, limit },
    });
  },
};
