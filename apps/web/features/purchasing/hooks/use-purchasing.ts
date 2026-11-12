"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query/keys";
import { toPeriodKey, type PeriodRange } from "@/lib/period/presets";
import { purchasingApi } from "../api";
import type { CreatePurchasePayload, ExpensesListFilters, PurchasingListFilters, RecordExpensePayload } from "../types";

const STALE_TIME = 30_000;

/** RAKHAL-391 (MILESTONE 22) — cursor "load more" over `GET /purchasing/purchases` v2 (RAKHAL-375),
 * same `useInfiniteQuery`/`DataTable` contract `finance.transactionsListV2` established. */
export function usePurchasesList(filters: PurchasingListFilters) {
  return useInfiniteQuery({
    queryKey: qk.purchasing.purchasesListV2(filters as Record<string, string | undefined>),
    queryFn: ({ pageParam }: { pageParam: string | undefined }) => purchasingApi.listPurchases(filters, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => (lastPage.meta.hasNextPage ? lastPage.meta.endCursor : undefined),
    staleTime: STALE_TIME,
  });
}

export function useExpensesList(filters: ExpensesListFilters) {
  return useInfiniteQuery({
    queryKey: qk.purchasing.expensesListV2(filters as Record<string, string | undefined>),
    queryFn: ({ pageParam }: { pageParam: string | undefined }) => purchasingApi.listExpenses(filters, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => (lastPage.meta.hasNextPage ? lastPage.meta.endCursor : undefined),
    staleTime: STALE_TIME,
  });
}

/** One purchase with lines + embedded payable. Disabled while `id` is undefined (a closed sheet). */
export function usePurchase(id: string | undefined) {
  return useQuery({
    queryKey: qk.purchasing.purchaseDetailV2(id ?? ""),
    queryFn: () => purchasingApi.findPurchase(id!),
    enabled: id != null,
    staleTime: STALE_TIME,
  });
}

/** A supplier's newest purchases (rows carry the server-derived payment state). */
export function useSupplierPurchases(supplierId: string | undefined, limit = 5) {
  return useQuery({
    queryKey: qk.purchasing.supplierPurchasesV2(supplierId ?? ""),
    queryFn: () => purchasingApi.listPurchases({ supplierId }, undefined, limit),
    enabled: supplierId != null,
    staleTime: STALE_TIME,
  });
}

/** `GET /purchasing/summary?from&to` (RAKHAL-375) — the "This Month Summary" panel, period-keyed
 * like `finance.profitLossReportV2` so switching the shared `DateRangePicker` refetches it. */
export function usePurchasingSummary(range: PeriodRange) {
  const periodKey = toPeriodKey(range);
  return useQuery({
    queryKey: qk.purchasing.summaryV2(periodKey),
    queryFn: () => purchasingApi.getSummary(range.from.toISOString(), range.to.toISOString()),
    staleTime: STALE_TIME,
  });
}

/** Backs the payable-status/due-date cells on each expense/purchase row — see `api.ts#listPayables`'s
 * doc comment on why this is a client-side cross-reference by `purchaseId`/`expenseId` rather than a
 * server-side filter. Shared cache entry so both tables invalidate together. */
export function usePayables() {
  return useQuery({
    queryKey: qk.purchasing.payables(),
    queryFn: () => purchasingApi.listPayables(),
    staleTime: STALE_TIME,
  });
}

function invalidatePurchasingLists(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ["purchasing"] });
}

export function useCreateExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: RecordExpensePayload) => purchasingApi.createExpense(dto),
    onSuccess: () => invalidatePurchasingLists(queryClient),
  });
}

export function useCreatePurchase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreatePurchasePayload) => purchasingApi.createPurchase(dto),
    onSuccess: () => {
      invalidatePurchasingLists(queryClient);
      // A purchase increments real Medicine/FeedItem/Equipment stock (`PurchaseService`'s atomic
      // stock-increment side effect) — the Inventory module's own lists must refresh too, or a
      // farmer who just bought stock sees stale numbers there until an unrelated navigation.
      void queryClient.invalidateQueries({ queryKey: ["inventory"] });
    },
  });
}

/** `POST /purchasing/purchases/:id/void` (RAKHAL-377/392) — also invalidates `["inventory"]`
 * since voiding destocks the purchase's lines. */
export function useVoidPurchase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => purchasingApi.voidPurchase(id),
    onSuccess: () => {
      invalidatePurchasingLists(queryClient);
      void queryClient.invalidateQueries({ queryKey: ["inventory"] });
    },
  });
}

/** `POST /purchasing/expenses/:id/void` (RAKHAL-377/392). */
export function useVoidExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => purchasingApi.voidExpense(id),
    onSuccess: () => invalidatePurchasingLists(queryClient),
  });
}
