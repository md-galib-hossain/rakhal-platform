"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query/keys";
import { purchasingApi } from "../api";
import type { CreatePurchasePayload, RecordExpensePayload } from "../types";

const STALE_TIME = 30_000;

export function useExpenses() {
  return useQuery({
    queryKey: qk.purchasing.expenses(),
    queryFn: () => purchasingApi.listExpenses(),
    staleTime: STALE_TIME,
  });
}

export function usePurchases() {
  return useQuery({
    queryKey: qk.purchasing.purchases(),
    queryFn: () => purchasingApi.listPurchases(),
    staleTime: STALE_TIME,
  });
}

/** Backs the payable-status chip on each expense/purchase row — see `api.ts#listPayables`'s doc
 * comment on why this is a client-side cross-reference by `purchaseId`/`expenseId` rather than a
 * server-side filter. Shared cache entry so both tables invalidate together. */
export function usePayables() {
  return useQuery({
    queryKey: qk.purchasing.payables(),
    queryFn: () => purchasingApi.listPayables(),
    staleTime: STALE_TIME,
  });
}

export function useCreateExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: RecordExpensePayload) => purchasingApi.createExpense(dto),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.purchasing.expenses() });
      void queryClient.invalidateQueries({ queryKey: qk.purchasing.payables() });
    },
  });
}

export function useCreatePurchase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreatePurchasePayload) => purchasingApi.createPurchase(dto),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.purchasing.purchases() });
      void queryClient.invalidateQueries({ queryKey: qk.purchasing.payables() });
      // A purchase increments real Medicine/FeedItem/Equipment stock (`PurchaseService`'s atomic
      // stock-increment side effect) — the Inventory module's own lists must refresh too, or a
      // farmer who just bought stock sees stale numbers there until an unrelated navigation.
      void queryClient.invalidateQueries({ queryKey: ["inventory"] });
    },
  });
}
