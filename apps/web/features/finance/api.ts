"use client";

import { apiFetch, apiFetchPage } from "@/lib/api/client";
import type { CursorMeta, CursorPage } from "@/types/api";
import type {
  AddFundsPayload,
  AssetsResponse,
  CreateTransactionPayload,
  CreateTransactionResult,
  FinanceHighlights,
  LedgerChart,
  LedgerListFilters,
  LedgerTransaction,
  LiabilitiesResponse,
  ReceivableKind,
  Settlement,
  SettlementListFilters,
  SettlementStats,
  WalletResponse,
  WithdrawPayload,
} from "./types";

/** `GET /finance/ledger`'s `meta` carries the cursor page info plus a recomputed `chart` block
 * (same shape `financeApi.ledger` always returns alongside `items`) — same extended-meta pattern as
 * `features/tasks/api.ts#TaskListPage`. */
export type LedgerListPage = CursorPage<LedgerTransaction> & { meta: CursorMeta & { chart: LedgerChart } };
export type SettlementListPage = CursorPage<Settlement> & { meta: CursorMeta & { stats: SettlementStats } };

/** `/finance/*` — real backend routes (`finance.controller.ts`), `finance.*`-gated. */
export const financeApi = {
  highlights(): Promise<FinanceHighlights> {
    return apiFetch<FinanceHighlights>("/finance/highlights");
  },
  ledger(filters: LedgerListFilters, cursor?: string): Promise<LedgerListPage> {
    return apiFetchPage<LedgerTransaction>("/finance/ledger", {
      searchParams: {
        from: filters.from,
        to: filters.to,
        category: filters.category,
        status: filters.status,
        search: filters.search,
        cursor,
        limit: 20,
      },
    }) as Promise<LedgerListPage>;
  },
  settlements(kind: ReceivableKind, filters: SettlementListFilters, cursor?: string): Promise<SettlementListPage> {
    const path = kind === "RECEIVABLE" ? "/finance/receivables" : "/finance/payables";
    return apiFetchPage<Settlement>(path, {
      searchParams: { status: filters.status, search: filters.search, cursor, limit: 20 },
    }) as Promise<SettlementListPage>;
  },
  liabilities(): Promise<LiabilitiesResponse> {
    return apiFetch<LiabilitiesResponse>("/finance/liabilities");
  },
  assets(): Promise<AssetsResponse> {
    return apiFetch<AssetsResponse>("/finance/assets");
  },
  recordTransaction(dto: CreateTransactionPayload): Promise<CreateTransactionResult> {
    return apiFetch<CreateTransactionResult>("/finance/transactions", { method: "POST", body: dto });
  },
  wallet(): Promise<WalletResponse> {
    return apiFetch<WalletResponse>("/finance/wallet");
  },
  addFunds(dto: AddFundsPayload) {
    return apiFetch("/finance/wallet/add-funds", { method: "POST", body: dto });
  },
  withdraw(dto: WithdrawPayload) {
    return apiFetch("/finance/wallet/withdraw", { method: "POST", body: dto });
  },
};
