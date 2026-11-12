"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query/keys";
import { useCursorPager } from "@/lib/hooks/use-cursor-pager";
import { useInfiniteCursorList } from "@/lib/hooks/use-infinite-cursor-list";
import { inventoryApi } from "../api";
import type {
  AdjustMedicineStockPayload,
  AdjustMilkTankVolumePayload,
  CreateEquipmentPayload,
  UpdateBatchNutritionPayload,
  CreateFeedItemBatchPayload,
  CreateFeedItemPayload,
  CreateMedicinePayload,
  CreateMilkTankPayload,
  CreateSemenBatchPayload,
  CreateSemenTankPayload,
  CreateUnitPayload,
  EquipmentListFilters,
  FeedItemListFilters,
  MedicineListFilters,
  MilkTankListFilters,
  MilkTankTeamMember,
  SemenBatchListFilters,
  UnitDimension,
  UpdateEquipmentPayload,
  UpdateFeedItemPayload,
  UpdateMedicinePayload,
  UpdateMilkTankPayload,
  UpdateSemenBatchPayload,
  UpdateSemenTankPayload,
} from "../types";

const STALE_TIME = 60_000;

/** Numbered-page adapter over the cursor-only `GET /inventory/medicines` — thin wrapper around the
 * shared `useCursorPager` (`lib/hooks/use-cursor-pager.ts`). */
export function useMedicinePagedList(filters: MedicineListFilters) {
  return useCursorPager(
    ["inventory", "medicine", "list", "paged", filters as Record<string, string | undefined>],
    (cursor, limit) => inventoryApi.listMedicines(filters, cursor, limit),
    { staleTime: STALE_TIME },
  );
}

/** Append-forever ("infinite scroll") variant of `useMedicinePagedList` — same endpoint and
 * filters, accumulated instead of numbered. Footer: `InfiniteScrollFooter`. */
export function useMedicineInfiniteList(filters: MedicineListFilters) {
  return useInfiniteCursorList(
    ["inventory", "medicine", "list", filters as Record<string, string | undefined>],
    (cursor, limit) => inventoryApi.listMedicines(filters, cursor, limit),
    { staleTime: STALE_TIME },
  );
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

/** Multi-select delete (bulk-action dock, 2026-07-21). */
export function useBulkDeleteMedicines() {
  const invalidate = useInvalidateMedicine();
  return useMutation({
    mutationFn: (ids: string[]) => inventoryApi.bulkDeleteMedicines(ids),
    onSuccess: () => invalidate(),
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

/** Same shared-pager adapter as `useMedicinePagedList`, over the cursor-only
 * `GET /inventory/feed-items`. */
export function useFeedItemPagedList(filters: FeedItemListFilters) {
  return useCursorPager(
    ["inventory", "feed-item", "list", "paged", filters as Record<string, string | undefined>],
    (cursor, limit) => inventoryApi.listFeedItems(filters, cursor, limit),
    { staleTime: STALE_TIME },
  );
}

/** Infinite-scroll variant of `useFeedItemPagedList`. */
export function useFeedItemInfiniteList(filters: FeedItemListFilters) {
  return useInfiniteCursorList(
    ["inventory", "feed-item", "list", filters as Record<string, string | undefined>],
    (cursor, limit) => inventoryApi.listFeedItems(filters, cursor, limit),
    { staleTime: STALE_TIME },
  );
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

export function useCreateFeedItemBatch() {
  const invalidate = useInvalidateFeedItem();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: CreateFeedItemBatchPayload }) => inventoryApi.createFeedItemBatch(id, dto),
    onSuccess: (_data, { id }) => invalidate(id),
  });
}

export function useReviseFeedBatchNutrition() {
  const invalidate = useInvalidateFeedItem();
  return useMutation({
    mutationFn: ({ id, batchId, dto }: { id: string; batchId: string; dto: UpdateBatchNutritionPayload }) =>
      inventoryApi.reviseFeedBatchNutrition(id, batchId, dto),
    onSuccess: (_data, { id }) => invalidate(id),
  });
}

export function useRevertFeedBatchNutrition() {
  const invalidate = useInvalidateFeedItem();
  return useMutation({
    mutationFn: ({ id, batchId }: { id: string; batchId: string }) => inventoryApi.revertFeedBatchNutrition(id, batchId),
    onSuccess: (_data, { id }) => invalidate(id),
  });
}

export function useResyncFeedBatchNutrition() {
  const invalidate = useInvalidateFeedItem();
  return useMutation({
    mutationFn: ({ id, batchId }: { id: string; batchId: string }) => inventoryApi.resyncFeedBatchNutrition(id, batchId),
    onSuccess: (_data, { id }) => invalidate(id),
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

/** Multi-select delete (bulk-action dock, 2026-07-21). */
export function useBulkDeleteFeedItems() {
  const invalidate = useInvalidateFeedItem();
  return useMutation({
    mutationFn: (ids: string[]) => inventoryApi.bulkDeleteFeedItems(ids),
    onSuccess: () => invalidate(),
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

export function useSetPrimaryMilkTank() {
  const invalidate = useInvalidateMilkTank();
  return useMutation({
    mutationFn: (id: string) => inventoryApi.setPrimaryMilkTank(id),
    onSuccess: () => invalidate(),
  });
}

/** Same shared-pager adapter as `useMedicinePagedList`/`useFeedItemPagedList`, over the cursor-only
 * `GET /inventory/milk-tanks/audit-log`. Default 10/page (denser log rows) — no page-size selector
 * exposed for this one, `initialPageSize` just keeps its previous fixed page size. */
export function useMilkTankAuditLogPagedList() {
  return useCursorPager(
    ["inventory", "milk-tank", "audit-log", "paged"],
    (cursor, limit) => inventoryApi.milkTankAuditLog(undefined, cursor, limit),
    { staleTime: STALE_TIME, initialPageSize: 10 },
  );
}

/** Infinite-scroll variant of `useMilkTankAuditLogPagedList` (10 rows per request, denser log). */
export function useMilkTankAuditLogInfiniteList() {
  return useInfiniteCursorList(
    ["inventory", "milk-tank", "audit-log"],
    (cursor, limit) => inventoryApi.milkTankAuditLog(undefined, cursor, limit),
    { staleTime: STALE_TIME, pageSize: 10 },
  );
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

/** Same shared-pager adapter as `useMedicinePagedList`/`useFeedItemPagedList`, over the cursor-only
 * `GET /inventory/semen/batches`. */
export function useSemenBatchPagedList(filters: SemenBatchListFilters) {
  return useCursorPager(
    ["inventory", "semen-batch", "list", "paged", filters as Record<string, string | undefined>],
    (cursor, limit) => inventoryApi.listSemenBatches(filters, cursor, limit),
    { staleTime: STALE_TIME },
  );
}

/** Infinite-scroll variant of `useSemenBatchPagedList`. */
export function useSemenBatchInfiniteList(filters: SemenBatchListFilters) {
  return useInfiniteCursorList(
    ["inventory", "semen-batch", "list", filters as Record<string, string | undefined>],
    (cursor, limit) => inventoryApi.listSemenBatches(filters, cursor, limit),
    { staleTime: STALE_TIME },
  );
}

function useInvalidateSemenBatch() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ["inventory", "semen-batch", "list"] });
    void queryClient.invalidateQueries({ queryKey: ["semen-batches"] });
    void queryClient.invalidateQueries({ queryKey: qk.inventory.semenTanks() });
  };
}

/** `GET /inventory/semen/batches` (`inventory.read`-gated) — full list for pickers (e.g. Reproduction's AI event). */
export function useSemenBatches(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["semen-batches", "picker"],
    queryFn: () => inventoryApi.listSemenBatches({}, undefined, 100),
    enabled: options?.enabled ?? true,
    staleTime: 30_000,
    select: (page) => page.items.filter((b) => b.strawQuantity > 0),
  });
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

/** Same shared-pager adapter as `useMedicinePagedList`, over the cursor-only
 * `GET /inventory/equipment`. */
export function useEquipmentPagedList(filters: EquipmentListFilters) {
  return useCursorPager(
    ["inventory", "equipment", "list", "paged", filters as Record<string, string | undefined>],
    (cursor, limit) => inventoryApi.listEquipment(filters, cursor, limit),
    { staleTime: STALE_TIME },
  );
}

/** Infinite-scroll variant of `useEquipmentPagedList`. */
export function useEquipmentInfiniteList(filters: EquipmentListFilters) {
  return useInfiniteCursorList(
    ["inventory", "equipment", "list", filters as Record<string, string | undefined>],
    (cursor, limit) => inventoryApi.listEquipment(filters, cursor, limit),
    { staleTime: STALE_TIME },
  );
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

/** Multi-select delete (bulk-action dock, 2026-07-21). */
export function useBulkDeleteEquipment() {
  const invalidate = useInvalidateEquipment();
  return useMutation({
    mutationFn: (ids: string[]) => inventoryApi.bulkDeleteEquipment(ids),
    onSuccess: () => invalidate(),
  });
}

export function useRestoreEquipment() {
  const invalidate = useInvalidateEquipment();
  return useMutation({
    mutationFn: (id: string) => inventoryApi.restoreEquipment(id),
    onSuccess: (_data, id) => invalidate(id),
  });
}

/** Unit catalog (RAKHAL-326) — merged system + farm units, small list, no cursor pager. Used by
 * `UnitPicker` (`features/inventory/components/unit-picker.tsx`), same pattern as
 * `useFeedIngredients()`. */
export function useUnits(dimension?: UnitDimension) {
  return useQuery({
    queryKey: qk.inventory.units(dimension),
    queryFn: () => inventoryApi.listUnits(dimension),
    staleTime: STALE_TIME,
  });
}

/** "+ Add custom unit" quick-add — invalidates every dimension-filtered units query so the new unit
 * shows up in the picker immediately (same broad-invalidate shape `useCreateCustomIngredient` uses). */
export function useCreateCustomUnit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateUnitPayload) => inventoryApi.createUnit(dto),
    onSuccess: () =>
      void queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === "inventory" && query.queryKey[1] === "units",
      }),
  });
}

/** Archive a farm-custom unit — same broad-invalidate shape `useCreateCustomUnit` uses so it
 * drops out of every dimension-filtered picker list immediately. */
export function useArchiveUnit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => inventoryApi.archiveUnit(id),
    onSuccess: () =>
      void queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === "inventory" && query.queryKey[1] === "units",
      }),
  });
}
