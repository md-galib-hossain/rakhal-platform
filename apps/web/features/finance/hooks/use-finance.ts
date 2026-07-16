"use client";

import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query/keys";
import { financeApi } from "../api";
import type {
  AddFundsPayload,
  CreateTransactionPayload,
  LedgerListFilters,
  ReceivableKind,
  SettlementListFilters,
  WithdrawPayload,
} from "../types";

const STALE_TIME = 60_000;

interface PagerState {
  filtersKey: string;
  pageIndex: number;
  cursors: (string | undefined)[];
}

function initialPagerState(filtersKey: string): PagerState {
  return { filtersKey, pageIndex: 0, cursors: [undefined] };
}

export function useFinanceHighlights() {
  return useQuery({
    queryKey: qk.finance.highlights(),
    queryFn: () => financeApi.highlights(),
    staleTime: STALE_TIME,
  });
}

/** Honest-frontier numbered-page adapter over the cursor-only `GET /finance/ledger` — same approach
 * as `useMedicinePagedList` (`features/inventory/hooks/use-inventory.ts`). Also surfaces the
 * response's own `meta.chart` (the backend recomputes it on every call, not cached separately). */
export function useLedgerPagedList(filters: LedgerListFilters) {
  const filtersKey = JSON.stringify(filters);
  const [state, setState] = useState<PagerState>(() => initialPagerState(filtersKey));
  if (state.filtersKey !== filtersKey) {
    setState(initialPagerState(filtersKey));
  }

  const { pageIndex, cursors } = state;
  const cursor = cursors[pageIndex];

  const query = useQuery({
    queryKey: ["finance", "ledger", "list", "paged", filters as Record<string, string | undefined>, cursor],
    queryFn: () => financeApi.ledger(filters, cursor),
    staleTime: STALE_TIME,
    placeholderData: keepPreviousData,
  });

  const atFrontier = pageIndex === cursors.length - 1;
  const hasUndiscoveredNext = atFrontier && Boolean(query.data?.meta.hasNextPage);
  const totalPages = Math.max(cursors.length + (hasUndiscoveredNext ? 1 : 0), 1);

  function goToPage(page: number) {
    const idx = page - 1;
    if (idx < 0 || idx === pageIndex) return;
    if (idx < cursors.length) {
      setState((s) => ({ ...s, pageIndex: idx }));
      return;
    }
    if (idx === cursors.length && hasUndiscoveredNext) {
      const nextCursor = query.data?.meta.endCursor ?? undefined;
      setState((s) => ({ ...s, pageIndex: idx, cursors: [...s.cursors, nextCursor] }));
    }
  }

  return {
    items: query.data?.items ?? [],
    chart: query.data?.meta.chart,
    page: pageIndex + 1,
    totalPages,
    isLoading: query.isLoading,
    isError: query.isError,
    isFetching: query.isFetching,
    refetch: query.refetch,
    goToPage,
  };
}

/** Same honest-frontier pager as `useLedgerPagedList`, shared by Receivables and Payables — they're
 * the same backend shape (`GET /finance/{receivables,payables}`), only `kind` differs. Also surfaces
 * `meta.stats` (totalOutstanding/pendingToday/overdue). */
function useSettlementsPagedList(kind: ReceivableKind, filters: SettlementListFilters) {
  const filtersKey = JSON.stringify(filters);
  const [state, setState] = useState<PagerState>(() => initialPagerState(filtersKey));
  if (state.filtersKey !== filtersKey) {
    setState(initialPagerState(filtersKey));
  }

  const { pageIndex, cursors } = state;
  const cursor = cursors[pageIndex];

  const query = useQuery({
    queryKey: ["finance", kind, "list", "paged", filters as Record<string, string | undefined>, cursor],
    queryFn: () => financeApi.settlements(kind, filters, cursor),
    staleTime: STALE_TIME,
    placeholderData: keepPreviousData,
  });

  const atFrontier = pageIndex === cursors.length - 1;
  const hasUndiscoveredNext = atFrontier && Boolean(query.data?.meta.hasNextPage);
  const totalPages = Math.max(cursors.length + (hasUndiscoveredNext ? 1 : 0), 1);

  function goToPage(page: number) {
    const idx = page - 1;
    if (idx < 0 || idx === pageIndex) return;
    if (idx < cursors.length) {
      setState((s) => ({ ...s, pageIndex: idx }));
      return;
    }
    if (idx === cursors.length && hasUndiscoveredNext) {
      const nextCursor = query.data?.meta.endCursor ?? undefined;
      setState((s) => ({ ...s, pageIndex: idx, cursors: [...s.cursors, nextCursor] }));
    }
  }

  return {
    items: query.data?.items ?? [],
    stats: query.data?.meta.stats,
    page: pageIndex + 1,
    totalPages,
    isLoading: query.isLoading,
    isError: query.isError,
    isFetching: query.isFetching,
    refetch: query.refetch,
    goToPage,
  };
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
