"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query/keys";
import { useCursorPager } from "@/lib/hooks/use-cursor-pager";
import { financeApi } from "../api";
import type {
  AddFundsPayload,
  CreateFixedAssetPayload,
  CreateTransactionPayload,
  LedgerListFilters,
  ReceivableKind,
  RecordPaymentPayload,
  SettlementListFilters,
  VoidTransactionPayload,
  WithdrawPayload,
} from "../types";

const STALE_TIME = 60_000;

export function useFinanceHighlights() {
  return useQuery({
    queryKey: qk.finance.highlights(),
    queryFn: () => financeApi.highlights(),
    staleTime: STALE_TIME,
  });
}

/** Shared-pager adapter over the cursor-only `GET /finance/ledger` (`useCursorPager`, same base as
 * `useMedicinePagedList`). Also surfaces the response's own `meta.chart` (the backend recomputes it
 * on every call, not cached separately). */
export function useLedgerPagedList(filters: LedgerListFilters) {
  const pager = useCursorPager(
    ["finance", "ledger", "list", "paged", filters as Record<string, string | undefined>],
    (cursor, limit) => financeApi.ledger(filters, cursor, limit),
    { staleTime: STALE_TIME },
  );
  return { ...pager, chart: pager.meta?.chart };
}

/** Same shared pager as `useLedgerPagedList`, shared by Receivables and Payables — they're the
 * same backend shape (`GET /finance/{receivables,payables}`), only `kind` differs. Also surfaces
 * `meta.stats` (totalOutstanding/pendingToday/overdue). */
function useSettlementsPagedList(kind: ReceivableKind, filters: SettlementListFilters) {
  const pager = useCursorPager(
    ["finance", kind, "list", "paged", filters as Record<string, string | undefined>],
    (cursor, limit) => financeApi.settlements(kind, filters, cursor, limit),
    { staleTime: STALE_TIME },
  );
  return { ...pager, stats: pager.meta?.stats };
}

export function useReceivablesPagedList(filters: SettlementListFilters) {
  return useSettlementsPagedList("RECEIVABLE", filters);
}

export function usePayablesPagedList(filters: SettlementListFilters) {
  return useSettlementsPagedList("PAYABLE", filters);
}

export function useLiabilities() {
  return useQuery({
    queryKey: qk.finance.liabilities(),
    queryFn: () => financeApi.liabilities(),
    staleTime: STALE_TIME,
  });
}

export function useAssets() {
  return useQuery({
    queryKey: qk.finance.assets(),
    queryFn: () => financeApi.assets(),
    staleTime: STALE_TIME,
  });
}

export function useWallet() {
  return useQuery({
    queryKey: qk.finance.wallet(),
    queryFn: () => financeApi.wallet(),
    staleTime: STALE_TIME,
  });
}

/** Invalidates everything a recorded transaction (or a wallet add-funds/withdraw) can touch — the
 * ledger, highlights (liquidity/cost-per-litre), liabilities (new loans/EMI), assets (inventory
 * value), receivables/payables (partial-payment side effects), and the wallet itself. Broad on
 * purpose: `recordTransaction` can trigger any subset of these server-side depending on `type`. */
function useInvalidateFinance() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ["finance"] });
  };
}

export function useRecordTransaction() {
  const invalidate = useInvalidateFinance();
  return useMutation({
    mutationFn: (dto: CreateTransactionPayload) => financeApi.recordTransaction(dto),
    onSuccess: () => invalidate(),
  });
}

export function useAddFunds() {
  const invalidate = useInvalidateFinance();
  return useMutation({
    mutationFn: (dto: AddFundsPayload) => financeApi.addFunds(dto),
    onSuccess: () => invalidate(),
  });
}

export function useWithdraw() {
  const invalidate = useInvalidateFinance();
  return useMutation({
    mutationFn: (dto: WithdrawPayload) => financeApi.withdraw(dto),
    onSuccess: () => invalidate(),
  });
}

export function useRecordPayment(kind: ReceivableKind) {
  const invalidate = useInvalidateFinance();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: RecordPaymentPayload }) => financeApi.recordPayment(kind, id, dto),
    onSuccess: () => invalidate(),
  });
}

export function useVoidTransaction() {
  const invalidate = useInvalidateFinance();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: VoidTransactionPayload }) => financeApi.voidTransaction(id, dto),
    onSuccess: () => invalidate(),
  });
}

export function useCreateAsset() {
  const invalidate = useInvalidateFinance();
  return useMutation({
    mutationFn: (dto: CreateFixedAssetPayload) => financeApi.createAsset(dto),
    onSuccess: () => invalidate(),
  });
}
