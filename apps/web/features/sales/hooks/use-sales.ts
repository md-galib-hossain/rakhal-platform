"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query/keys";
import { salesApi } from "../api";
import type {
  AllocatePaymentPayload,
  CreateIncomeCategoryPayload,
  CreatePaymentPayload,
  RecordOtherIncomePayload,
  SellAnimalPayload,
} from "../types";

const STALE_TIME = 30_000;

/** RAKHAL-343 — `GET /milk/availability`, backs the wizard's live available-quantity display on
 * the Milk sub-type step. Short stale time — this is a "how much can I sell right now" number,
 * not a slow-changing catalogue. */
export function useMilkAvailability(enabled: boolean) {
  return useQuery({
    queryKey: qk.finance.milkAvailabilityV2(undefined),
    queryFn: () => salesApi.milkAvailability(),
    enabled,
    staleTime: STALE_TIME,
  });
}

export function useIncomeCategories(enabled: boolean) {
  return useQuery({
    queryKey: qk.finance.incomeCategoriesV2(),
    queryFn: () => salesApi.listIncomeCategories(),
    enabled,
    staleTime: 60_000,
  });
}

export function useCreateIncomeCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateIncomeCategoryPayload) => salesApi.createIncomeCategory(dto),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: qk.finance.incomeCategoriesV2() }),
  });
}

/** Other Income posts + settles in one call — broad invalidation mirrors `useRecordDispatch`'s own
 * precedent (`features/buyers/hooks/use-buyers.ts`). */
export function useRecordOtherIncome() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: RecordOtherIncomePayload) => salesApi.recordOtherIncome(dto),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["finance"] });
    },
  });
}

/** `POST /sales/animal/:cattleId` (RAKHAL-345/399) — the real atomic sell-animal flow. Broad
 * `["cattle"]` invalidation since the sold animal's `herdStatus` flips to SOLD and drops out of
 * the active-herd list/detail views, plus `["finance"]` for the ledger posting this always makes. */
export function useSellAnimal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ cattleId, dto }: { cattleId: string; dto: SellAnimalPayload }) =>
      salesApi.sellAnimal(cattleId, dto),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["cattle"] });
      void queryClient.invalidateQueries({ queryKey: ["finance"] });
    },
  });
}

export function useCreatePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreatePaymentPayload) => salesApi.createPayment(dto),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["finance"] });
    },
  });
}

export function useAllocatePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ paymentId, dto }: { paymentId: string; dto: AllocatePaymentPayload }) =>
      salesApi.allocatePayment(paymentId, dto),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["finance"] });
    },
  });
}

/**
 * Finds the `Receivable` a just-recorded milk sale raised, so the wizard can allocate the
 * farmer's "Amount Received" against it. `Receivable.saleId` is `@unique` server-side, but no
 * `?saleId=` filter exists on `GET /finance/receivables` — and live-verifying this ticket against
 * the real backend found `?customerId=` (the filter that looked right) never actually matches
 * anything, because `Receivable.customerId` is never persisted (`api.ts#listRecentReceivables`'s
 * doc comment has the full story). So this fetches the newest few receivables, unfiltered
 * (default sort is newest-first — proven live: a fresh dispatch's `saleId` matched `items[0]`),
 * and matches `saleId` client-side. Called imperatively inside the submit flow (not a cached
 * `useQuery`) — there's nothing to cache, this is a one-shot lookup the moment after a sale is
 * created.
 */
export async function findReceivableBySale(saleId: string) {
  const page = await salesApi.listRecentReceivables();
  return page.items.find((r) => r.saleId === saleId) ?? page.items[0];
}
