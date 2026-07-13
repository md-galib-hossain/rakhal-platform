"use client";

import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query/keys";
import { inventoryApi } from "../api";
import type {
  AdjustMedicineStockPayload,
  AdjustMilkTankVolumePayload,
  CreateForagePayload,
  CreateMedicinePayload,
  CreateMilkTankPayload,
  ForageListFilters,
  MedicineListFilters,
  MilkTankListFilters,
  MilkTankTeamMember,
  UpdateForagePayload,
  UpdateMedicinePayload,
  UpdateMilkTankPayload,
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

/** Same honest-frontier numbered-page adapter as `useMedicinePagedList`, over the cursor-only
 * `GET /inventory/forages`. */
export function useForagePagedList(filters: ForageListFilters) {
  const filtersKey = JSON.stringify(filters);
  const [state, setState] = useState<PagerState>(() => initialPagerState(filtersKey));
  if (state.filtersKey !== filtersKey) {
    setState(initialPagerState(filtersKey));
  }

  const { pageIndex, cursors } = state;
  const cursor = cursors[pageIndex];

  const query = useQuery({
    queryKey: ["inventory", "forage", "list", "paged", filters as Record<string, string | undefined>, cursor],
    queryFn: () => inventoryApi.listForages(filters, cursor),
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

export function useForageDetail(id: string | undefined) {
  return useQuery({
    queryKey: qk.inventory.forageDetail(id ?? ""),
    queryFn: () => inventoryApi.findForage(id!),
    enabled: Boolean(id),
    staleTime: STALE_TIME,
  });
}

function useInvalidateForage() {
  const queryClient = useQueryClient();
  return (id?: string) => {
    void queryClient.invalidateQueries({ queryKey: ["inventory", "forage", "list"] });
    if (id) void queryClient.invalidateQueries({ queryKey: qk.inventory.forageDetail(id) });
  };
}

export function useCreateForage() {
  const invalidate = useInvalidateForage();
  return useMutation({
    mutationFn: (dto: CreateForagePayload) => inventoryApi.createForage(dto),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateForage() {
  const invalidate = useInvalidateForage();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateForagePayload }) => inventoryApi.updateForage(id, dto),
    onSuccess: (_data, { id }) => invalidate(id),
  });
}

export function useArchiveForage() {
  const invalidate = useInvalidateForage();
  return useMutation({
    mutationFn: (id: string) => inventoryApi.archiveForage(id),
    onSuccess: (_data, id) => invalidate(id),
  });
}

export function useRestoreForage() {
  const invalidate = useInvalidateForage();
  return useMutation({
    mutationFn: (id: string) => inventoryApi.restoreForage(id),
    onSuccess: (_data, id) => invalidate(id),
  });
}

/** `GET /inventory/milk-tanks` returns the full (small — a farm keeps a handful of tanks, never a
 * paged list) array directly, unlike Medicine/Forage — no cursor pager needed here. */
export function useMilkTanks(filters: MilkTankListFilters = {}) {
  return useQuery({
    queryKey: qk.inventory.milkTanks(filters as Record<string, string | undefined>),
    queryFn: () => inventoryApi.listMilkTanks(filters),
    staleTime: STALE_TIME,
  });
}

function useInvalidateMilkTank() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ["inventory", "milk-tank", "list"] });
    void queryClient.invalidateQueries({ queryKey: ["inventory", "milk-tank", "audit-log"] });
  };
}

export function useCreateMilkTank() {
  const invalidate = useInvalidateMilkTank();
  return useMutation({
    mutationFn: (dto: CreateMilkTankPayload) => inventoryApi.createMilkTank(dto),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateMilkTank() {
  const invalidate = useInvalidateMilkTank();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateMilkTankPayload }) => inventoryApi.updateMilkTank(id, dto),
    onSuccess: () => invalidate(),
  });
}

export function useAdjustMilkTankVolume() {
  const invalidate = useInvalidateMilkTank();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: AdjustMilkTankVolumePayload }) => inventoryApi.adjustMilkTankVolume(id, dto),
    onSuccess: () => invalidate(),
  });
}

export function useArchiveMilkTank() {
  const invalidate = useInvalidateMilkTank();
  return useMutation({
    mutationFn: (id: string) => inventoryApi.archiveMilkTank(id),
    onSuccess: () => invalidate(),
  });
}

/** Same honest-frontier numbered-page adapter as `useMedicinePagedList`/`useForagePagedList`, over
 * the cursor-only `GET /inventory/milk-tanks/audit-log`. */
export function useMilkTankAuditLogPagedList() {
  const filtersKey = "audit-log";
  const [state, setState] = useState<PagerState>(() => initialPagerState(filtersKey));

  const { pageIndex, cursors } = state;
  const cursor = cursors[pageIndex];

  const query = useQuery({
    queryKey: ["inventory", "milk-tank", "audit-log", "paged", cursor],
    queryFn: () => inventoryApi.milkTankAuditLog(undefined, cursor),
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

export function useShedsForMilkTank() {
  return useQuery({
    queryKey: ["inventory", "milk-tank", "sheds"],
    queryFn: () => inventoryApi.shedsForMilkTank(),
    staleTime: STALE_TIME,
  });
}

/** Best-effort `createdBy` → display-name map for the audit log's Operator column
 * (`types.ts#MilkTankTeamMember`). `team.read` may not be granted to every role viewing this page
 * (Worker likely can't), so a failed fetch resolves to an empty map instead of an error state —
 * `MilkAuditLogTable` falls back to a generic "Team member" label + tinted-icon avatar when a given
 * `createdBy` id isn't in the map, same graceful-degrade shape as Forage's no-photo fallback. */
export function useTeamMembersMap() {
  const query = useQuery({
    queryKey: qk.inventory.teamMembers(),
    queryFn: () => inventoryApi.teamMembersForMilkAudit(),
    staleTime: STALE_TIME,
    retry: false,
  });
  const map = new Map<string, MilkTankTeamMember>();
  for (const member of query.data?.members ?? []) map.set(member.id, member);
  return map;
}
