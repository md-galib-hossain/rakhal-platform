"use client";

import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query/keys";
import { inventoryApi } from "../api";
import type {
  AdjustMedicineStockPayload,
  AdjustMilkTankVolumePayload,
  CreateEquipmentPayload,
  CreateFeedItemPayload,
  CreateMedicinePayload,
  CreateMilkTankPayload,
  CreateSemenBatchPayload,
  CreateSemenTankPayload,
  EquipmentListFilters,
  FeedItemListFilters,
  MedicineListFilters,
  MilkTankListFilters,
  MilkTankTeamMember,
  SemenBatchListFilters,
  UpdateEquipmentPayload,
  UpdateFeedItemPayload,
  UpdateMedicinePayload,
  UpdateMilkTankPayload,
  UpdateSemenBatchPayload,
  UpdateSemenTankPayload,
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
 * `GET /inventory/feed-items`. */
export function useFeedItemPagedList(filters: FeedItemListFilters) {
  const filtersKey = JSON.stringify(filters);
  const [state, setState] = useState<PagerState>(() => initialPagerState(filtersKey));
  if (state.filtersKey !== filtersKey) {
    setState(initialPagerState(filtersKey));
  }

  const { pageIndex, cursors } = state;
  const cursor = cursors[pageIndex];

  const query = useQuery({
    queryKey: ["inventory", "feed-item", "list", "paged", filters as Record<string, string | undefined>, cursor],
    queryFn: () => inventoryApi.listFeedItems(filters, cursor),
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

export function useFeedItemDetail(id: string | undefined) {
  return useQuery({
    queryKey: qk.inventory.feedItemDetail(id ?? ""),
    queryFn: () => inventoryApi.findFeedItem(id!),
    enabled: Boolean(id),
    staleTime: STALE_TIME,
  });
}

function useInvalidateFeedItem() {
  const queryClient = useQueryClient();
  return (id?: string) => {
    void queryClient.invalidateQueries({ queryKey: ["inventory", "feed-item", "list"] });
    if (id) void queryClient.invalidateQueries({ queryKey: qk.inventory.feedItemDetail(id) });
  };
}

export function useCreateFeedItem() {
  const invalidate = useInvalidateFeedItem();
  return useMutation({
    mutationFn: (dto: CreateFeedItemPayload) => inventoryApi.createFeedItem(dto),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateFeedItem() {
  const invalidate = useInvalidateFeedItem();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateFeedItemPayload }) => inventoryApi.updateFeedItem(id, dto),
    onSuccess: (_data, { id }) => invalidate(id),
  });
}

export function useArchiveFeedItem() {
  const invalidate = useInvalidateFeedItem();
  return useMutation({
    mutationFn: (id: string) => inventoryApi.archiveFeedItem(id),
    onSuccess: (_data, id) => invalidate(id),
  });
}

export function useRestoreFeedItem() {
  const invalidate = useInvalidateFeedItem();
  return useMutation({
    mutationFn: (id: string) => inventoryApi.restoreFeedItem(id),
    onSuccess: (_data, id) => invalidate(id),
  });
}

/** `GET /inventory/milk-tanks` returns the full (small — a farm keeps a handful of tanks, never a
 * paged list) array directly, unlike Medicine/FeedItem — no cursor pager needed here. */
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

/** Same honest-frontier numbered-page adapter as `useMedicinePagedList`/`useFeedItemPagedList`, over
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
 * `createdBy` id isn't in the map, same graceful-degrade shape as FeedItem's no-photo fallback. */
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

/** `GET /inventory/semen/tanks` returns the full (small) array directly, same as milk tanks — no
 * cursor pager. */
export function useSemenTanks() {
  return useQuery({
    queryKey: qk.inventory.semenTanks(),
    queryFn: () => inventoryApi.listSemenTanks(),
    staleTime: STALE_TIME,
  });
}

function useInvalidateSemenTank() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: qk.inventory.semenTanks() });
    void queryClient.invalidateQueries({ queryKey: ["inventory", "semen-batch", "list"] });
  };
}

export function useCreateSemenTank() {
  const invalidate = useInvalidateSemenTank();
  return useMutation({
    mutationFn: (dto: CreateSemenTankPayload) => inventoryApi.createSemenTank(dto),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateSemenTank() {
  const invalidate = useInvalidateSemenTank();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateSemenTankPayload }) => inventoryApi.updateSemenTank(id, dto),
    onSuccess: () => invalidate(),
  });
}

export function useArchiveSemenTank() {
  const invalidate = useInvalidateSemenTank();
  return useMutation({
    mutationFn: (id: string) => inventoryApi.archiveSemenTank(id),
    onSuccess: () => invalidate(),
  });
}

/** Same honest-frontier numbered-page adapter as `useMedicinePagedList`/`useFeedItemPagedList`, over
 * the cursor-only `GET /inventory/semen/batches`. */
export function useSemenBatchPagedList(filters: SemenBatchListFilters) {
  const filtersKey = JSON.stringify(filters);
  const [state, setState] = useState<PagerState>(() => initialPagerState(filtersKey));
  if (state.filtersKey !== filtersKey) {
    setState(initialPagerState(filtersKey));
  }

  const { pageIndex, cursors } = state;
  const cursor = cursors[pageIndex];

  const query = useQuery({
    queryKey: ["inventory", "semen-batch", "list", "paged", filters as Record<string, string | undefined>, cursor],
    queryFn: () => inventoryApi.listSemenBatches(filters, cursor),
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

function useInvalidateSemenBatch() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ["inventory", "semen-batch", "list"] });
    void queryClient.invalidateQueries({ queryKey: qk.inventory.semenTanks() });
  };
}

export function useCreateSemenBatch() {
  const invalidate = useInvalidateSemenBatch();
  return useMutation({
    mutationFn: (dto: CreateSemenBatchPayload) => inventoryApi.createSemenBatch(dto),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateSemenBatch() {
  const invalidate = useInvalidateSemenBatch();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateSemenBatchPayload }) => inventoryApi.updateSemenBatch(id, dto),
    onSuccess: () => invalidate(),
  });
}

export function useArchiveSemenBatch() {
  const invalidate = useInvalidateSemenBatch();
  return useMutation({
    mutationFn: (id: string) => inventoryApi.archiveSemenBatch(id),
    onSuccess: () => invalidate(),
  });
}

/** Same honest-frontier numbered-page adapter as `useMedicinePagedList`, over the cursor-only
 * `GET /inventory/equipment`. */
export function useEquipmentPagedList(filters: EquipmentListFilters) {
  const filtersKey = JSON.stringify(filters);
  const [state, setState] = useState<PagerState>(() => initialPagerState(filtersKey));
  if (state.filtersKey !== filtersKey) {
    setState(initialPagerState(filtersKey));
  }

  const { pageIndex, cursors } = state;
  const cursor = cursors[pageIndex];

  const query = useQuery({
    queryKey: ["inventory", "equipment", "list", "paged", filters as Record<string, string | undefined>, cursor],
    queryFn: () => inventoryApi.listEquipment(filters, cursor),
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

function useInvalidateEquipment() {
  const queryClient = useQueryClient();
  return (id?: string) => {
    void queryClient.invalidateQueries({ queryKey: ["inventory", "equipment", "list"] });
    if (id) void queryClient.invalidateQueries({ queryKey: qk.inventory.equipmentDetail(id) });
  };
}

export function useCreateEquipment() {
  const invalidate = useInvalidateEquipment();
  return useMutation({
    mutationFn: (dto: CreateEquipmentPayload) => inventoryApi.createEquipment(dto),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateEquipment() {
  const invalidate = useInvalidateEquipment();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateEquipmentPayload }) => inventoryApi.updateEquipment(id, dto),
    onSuccess: (_data, { id }) => invalidate(id),
  });
}

export function useArchiveEquipment() {
  const invalidate = useInvalidateEquipment();
  return useMutation({
    mutationFn: (id: string) => inventoryApi.archiveEquipment(id),
    onSuccess: (_data, id) => invalidate(id),
  });
}

export function useRestoreEquipment() {
  const invalidate = useInvalidateEquipment();
  return useMutation({
    mutationFn: (id: string) => inventoryApi.restoreEquipment(id),
    onSuccess: (_data, id) => invalidate(id),
  });
}
