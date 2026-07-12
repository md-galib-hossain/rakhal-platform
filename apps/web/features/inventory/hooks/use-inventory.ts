"use client";

import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query/keys";
import { inventoryApi } from "../api";
import type {
  AdjustMedicineStockPayload,
  CreateMedicinePayload,
  MedicineListFilters,
  UpdateMedicinePayload,
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

/** Numbered-page adapter over the cursor-only `GET /inventory/medicines` — same honest-frontier
 * approach as `useCattlePagedList` (`features/cattle/hooks/use-cattle.ts`): the backend never
 * returns a total/offset, so `totalPages` only ever grows by 1 as the user actually pages past the
 * previously-discovered frontier. */
export function useMedicinePagedList(filters: MedicineListFilters) {
  const filtersKey = JSON.stringify(filters);
  const [state, setState] = useState<PagerState>(() => initialPagerState(filtersKey));
  if (state.filtersKey !== filtersKey) {
    setState(initialPagerState(filtersKey));
  }

  const { pageIndex, cursors } = state;
  const cursor = cursors[pageIndex];

  const query = useQuery({
    queryKey: ["inventory", "medicine", "list", "paged", filters as Record<string, string | undefined>, cursor],
    queryFn: () => inventoryApi.listMedicines(filters, cursor),
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
    page: pageIndex + 1,
    totalPages,
    isLoading: query.isLoading,
    isError: query.isError,
    isFetching: query.isFetching,
    refetch: query.refetch,
    goToPage,
  };
}

export function useMedicineDetail(id: string | undefined) {
  return useQuery({
    queryKey: qk.inventory.medicineDetail(id ?? ""),
    queryFn: () => inventoryApi.findMedicine(id!),
    enabled: Boolean(id),
    staleTime: STALE_TIME,
  });
}

function useInvalidateMedicine() {
  const queryClient = useQueryClient();
  return (id?: string) => {
    void queryClient.invalidateQueries({ queryKey: ["inventory", "medicine", "list"] });
    if (id) void queryClient.invalidateQueries({ queryKey: qk.inventory.medicineDetail(id) });
  };
}

export function useCreateMedicine() {
  const invalidate = useInvalidateMedicine();
  return useMutation({
    mutationFn: (dto: CreateMedicinePayload) => inventoryApi.createMedicine(dto),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateMedicine() {
  const invalidate = useInvalidateMedicine();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateMedicinePayload }) => inventoryApi.updateMedicine(id, dto),
    onSuccess: (_data, { id }) => invalidate(id),
  });
}

export function useAdjustMedicineStock() {
  const invalidate = useInvalidateMedicine();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: AdjustMedicineStockPayload }) => inventoryApi.adjustMedicineStock(id, dto),
    onSuccess: (_data, { id }) => invalidate(id),
  });
}

export function useArchiveMedicine() {
  const invalidate = useInvalidateMedicine();
  return useMutation({
    mutationFn: (id: string) => inventoryApi.archiveMedicine(id),
    onSuccess: (_data, id) => invalidate(id),
  });
}

export function useRestoreMedicine() {
  const invalidate = useInvalidateMedicine();
  return useMutation({
    mutationFn: (id: string) => inventoryApi.restoreMedicine(id),
    onSuccess: (_data, id) => invalidate(id),
  });
}

export function useSetMedicinePhoto() {
  const invalidate = useInvalidateMedicine();
  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => inventoryApi.setMedicinePhoto(id, file),
    onSuccess: (_data, { id }) => invalidate(id),
  });
}

export function useRemoveMedicinePhoto() {
  const invalidate = useInvalidateMedicine();
  return useMutation({
    mutationFn: (id: string) => inventoryApi.removeMedicinePhoto(id),
    onSuccess: (_data, id) => invalidate(id),
  });
}
