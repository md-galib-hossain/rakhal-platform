"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query/keys";
import { useCursorPager } from "@/lib/hooks/use-cursor-pager";
import { buyersApi } from "../api";
import type {
  BuyerListFilters,
  CreateBuyerPayload,
  DispatchListFilters,
  RecordDispatchPayload,
  UpdateBuyerPayload,
} from "../types";

const STALE_TIME = 60_000;

export function useBuyersPagedList(filters: BuyerListFilters) {
  return useCursorPager(
    ["buyers", "list", "paged", filters as Record<string, string | boolean | undefined>],
    (cursor, limit) => buyersApi.list(filters, cursor, limit),
    { staleTime: STALE_TIME },
  );
}

export function useDispatchesPagedList(filters: DispatchListFilters) {
  return useCursorPager(
    ["buyers", "dispatches", "paged", filters as Record<string, string | undefined>],
    (cursor, limit) => buyersApi.dispatches(filters, cursor, limit),
    { staleTime: STALE_TIME },
  );
}

export function useBuyerStatement(buyerId: string | null, month: string) {
  return useQuery({
    queryKey: qk.buyers.statement(buyerId ?? "", month),
    queryFn: () => buyersApi.statement(buyerId as string, month),
    enabled: buyerId != null,
    staleTime: STALE_TIME,
  });
}

function useInvalidateBuyers() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ["buyers"] });
  };
}

export function useCreateBuyer() {
  const invalidate = useInvalidateBuyers();
  return useMutation({
    mutationFn: (dto: CreateBuyerPayload) => buyersApi.create(dto),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateBuyer() {
  const invalidate = useInvalidateBuyers();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateBuyerPayload }) => buyersApi.update(id, dto),
    onSuccess: () => invalidate(),
  });
}

export function useDeactivateBuyer() {
  const invalidate = useInvalidateBuyers();
  return useMutation({
    mutationFn: (id: string) => buyersApi.deactivate(id),
    onSuccess: () => invalidate(),
  });
}

/** Recording a dispatch also touches Inventory (SELLABLE tank SALE decrement) and Finance (a new
 * receivable) server-side — broad invalidation on purpose, same pattern as
 * `features/finance/hooks/use-finance.ts#useInvalidateFinance`. */
export function useRecordDispatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: RecordDispatchPayload) => buyersApi.recordDispatch(dto),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["buyers"] });
      void queryClient.invalidateQueries({ queryKey: ["finance"] });
      void queryClient.invalidateQueries({ queryKey: ["inventory"] });
    },
  });
}
