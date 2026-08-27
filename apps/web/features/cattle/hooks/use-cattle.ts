"use client";

import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query/keys";
import { useCursorPager } from "@/lib/hooks/use-cursor-pager";
import { settingsApi } from "@/features/settings/api";
import { cattleApi } from "../api";
import type { BulkAction, CattleFormPayload, CattleListFilters } from "../types";
import type {
  CattleDeleteInput,
  CattleDisposeInput,
  CattleStatusInput,
  CreateAnimalHoldInput,
  PurchasedLactationInput,
  ReleaseAnimalHoldInput,
} from "../schemas";

const STALE_TIME = 60_000;

/** One `GET /cattle` request per category tile in `CattleCategoryHighlights`. `meta.count` is only
 * the current page's row count (`toCursorPage`, `rakhal-backend/src/common/pagination`), NOT a
 * true total — there's no dedicated counts endpoint, and `CursorPaginationQueryDto.limit` is
 * server-capped at 100 (`@Max(100)`). One page covers most per-category subgroups even on a
 * 500-animal farm; when a category's page comes back full (`meta.hasNextPage`), the tile shows
 * "100+" instead of silently under-counting — see `CattleCategoryHighlights`. */
const CATEGORY_COUNT_LIMIT = 100;

export function useCattleCategoryCounts(categories: { key: string; filters: CattleListFilters }[]) {
  return useQueries({
    queries: categories.map(({ key, filters }) => ({
      queryKey: ["cattle", "category-count", key, filters as Record<string, string | undefined>],
      queryFn: () => cattleApi.list(filters, undefined, CATEGORY_COUNT_LIMIT),
      staleTime: STALE_TIME,
    })),
  });
}

/** Numbered-page adapter over the cursor-only `GET /cattle` endpoint, for the `Pagination` UI —
 * thin wrapper around the shared `useCursorPager` (`lib/hooks/use-cursor-pager.ts`). */
export function useCattlePagedList(filters: CattleListFilters) {
  return useCursorPager(
    ["cattle", "list", "paged", filters as Record<string, string | undefined>],
    (cursor, limit) => cattleApi.list(filters, cursor, limit),
    { staleTime: STALE_TIME },
  );
}

export function useCattleHighlights() {
  return useQuery({ queryKey: qk.cattle.highlights(), queryFn: cattleApi.highlights, staleTime: STALE_TIME });
}

export function useBreeds() {
  return useQuery({ queryKey: qk.cattle.breeds(), queryFn: cattleApi.breeds, staleTime: STALE_TIME });
}

export function useCreateBreed() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; description?: string }) => cattleApi.createBreed(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.cattle.breeds() }),
  });
}

export function useSheds() {
  return useQuery({ queryKey: qk.cattle.sheds(), queryFn: cattleApi.sheds, staleTime: STALE_TIME });
}

export function useFeedGroups() {
  return useQuery({ queryKey: qk.cattle.feedGroups(), queryFn: cattleApi.feedGroups, staleTime: STALE_TIME });
}

/** Inline "+ Create new shed" (`CreatableSelect`, `components/shared/creatable-select.tsx`) — same
 * `POST /settings/sheds` the Settings feature's own create form uses, but invalidates every query
 * key a shed picker anywhere in the app reads from (`cattle.sheds` + `settings.sheds`) so a shed
 * created from the Cattle page or a bulk "change shed" dialog shows up everywhere immediately,
 * not just where it was created. */
export function useCreateShedInline() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => settingsApi.createShed({ name }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.cattle.sheds() });
      void queryClient.invalidateQueries({ queryKey: qk.settings.sheds() });
    },
  });
}

/** Inline "+ Create new feed group" counterpart to `useCreateShedInline` — invalidates
 * `cattle.feedGroups` + `settings.feedGroups` + `feed.feedGroups` (the Feed Formulator module's
 * own picker reads a third, independent query key for the same backend resource). */
export function useCreateFeedGroupInline() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => settingsApi.createFeedGroup({ name }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.cattle.feedGroups() });
      void queryClient.invalidateQueries({ queryKey: qk.settings.feedGroups() });
      void queryClient.invalidateQueries({ queryKey: qk.feed.feedGroups() });
    },
  });
}

export function useBulkCattle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      cattleIds,
      action,
      payload,
    }: {
      cattleIds: string[];
      action: BulkAction;
      payload?: { shedId?: string; feedGroupId?: string };
    }) => cattleApi.bulk(cattleIds, action, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["cattle", "list"] });
      void queryClient.invalidateQueries({ queryKey: ["cattle", "category-count"] });
      void queryClient.invalidateQueries({ queryKey: qk.cattle.highlights() });
    },
  });
}

export function useCattleDetail(id: string | undefined) {
  return useQuery({
    queryKey: qk.cattle.detail(id ?? ""),
    queryFn: () => cattleApi.findOne(id!),
    enabled: Boolean(id),
    staleTime: STALE_TIME,
  });
}

/** Shared invalidation for any mutation that changes a cattle row's list/highlights-visible fields. */
function useInvalidateCattle() {
  const queryClient = useQueryClient();
  return (id?: string) => {
    void queryClient.invalidateQueries({ queryKey: ["cattle", "list"] });
    void queryClient.invalidateQueries({ queryKey: ["cattle", "category-count"] });
    void queryClient.invalidateQueries({ queryKey: qk.cattle.highlights() });
    if (id) void queryClient.invalidateQueries({ queryKey: qk.cattle.detail(id) });
  };
}

export function useCreateCattle() {
  const invalidate = useInvalidateCattle();
  return useMutation({
    mutationFn: (dto: CattleFormPayload) => cattleApi.create(dto),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateCattle() {
  const invalidate = useInvalidateCattle();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: CattleFormPayload }) => cattleApi.update(id, dto),
    onSuccess: (_data, { id }) => invalidate(id),
  });
}

export function useUpdateCattleStatus() {
  const invalidate = useInvalidateCattle();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: CattleStatusInput }) => cattleApi.updateStatus(id, dto),
    onSuccess: (_data, { id }) => invalidate(id),
  });
}

/** RAKHAL-296-F — mirrors `useUpdateCattleStatus`'s invalidation (this mutation flips
 * `productionStatus` to MILKING server-side too, same as that route). */
export function useCreatePurchasedLactation() {
  const invalidate = useInvalidateCattle();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: PurchasedLactationInput }) =>
      cattleApi.createPurchasedLactation(id, dto),
    onSuccess: (_data, { id }) => invalidate(id),
  });
}

export function useDeleteCattle() {
  const invalidate = useInvalidateCattle();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: CattleDeleteInput }) => cattleApi.deleteCattle(id, dto),
    onSuccess: (_data, { id }) => invalidate(id),
  });
}

export function useDisposeCattle() {
  const invalidate = useInvalidateCattle();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: CattleDisposeInput }) => cattleApi.dispose(id, dto),
    onSuccess: (_data, { id }) => invalidate(id),
  });
}

export function useRestoreCattle() {
  const invalidate = useInvalidateCattle();
  return useMutation({
    mutationFn: (id: string) => cattleApi.restore(id),
    onSuccess: (_data, id) => invalidate(id),
  });
}

export function useSetCattlePhoto() {
  const invalidate = useInvalidateCattle();
  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => cattleApi.setPhoto(id, file),
    onSuccess: (_data, { id }) => invalidate(id),
  });
}

export function useRemoveCattlePhoto() {
  const invalidate = useInvalidateCattle();
  return useMutation({
    mutationFn: (id: string) => cattleApi.removePhoto(id),
    onSuccess: (_data, id) => invalidate(id),
  });
}

// RFE-024 — CSV import (multipart preview → confirm). Preview is a plain mutation (no cache entry
// to invalidate, its result is the session itself); confirm invalidates the list on success.
export function useImportCattlePreview() {
  return useMutation({ mutationFn: (file: File) => cattleApi.importPreview(file) });
}

export function useImportCattleConfirm() {
  const invalidate = useInvalidateCattle();
  return useMutation({
    mutationFn: ({ importSessionId, skipErrors }: { importSessionId: string; skipErrors: boolean }) =>
      cattleApi.importConfirm(importSessionId, skipErrors),
    onSuccess: () => invalidate(),
  });
}

// MILESTONE 10 gap closure — generic per-animal hold (RAKHAL-280).
export function useAnimalHolds(cattleId: string | undefined) {
  return useQuery({
    queryKey: qk.cattle.holds(cattleId ?? ""),
    queryFn: () => cattleApi.holds(cattleId!),
    enabled: Boolean(cattleId),
    staleTime: STALE_TIME,
  });
}

export function useCreateAnimalHold() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ cattleId, dto }: { cattleId: string; dto: CreateAnimalHoldInput }) =>
      cattleApi.createHold(cattleId, dto),
    onSuccess: (_data, { cattleId }) =>
      void queryClient.invalidateQueries({ queryKey: qk.cattle.holds(cattleId) }),
  });
}

export function useReleaseAnimalHold() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      cattleId,
      holdId,
      dto,
    }: {
      cattleId: string;
      holdId: string;
      dto?: ReleaseAnimalHoldInput;
    }) => cattleApi.releaseHold(cattleId, holdId, dto),
    onSuccess: (_data, { cattleId }) =>
      void queryClient.invalidateQueries({ queryKey: qk.cattle.holds(cattleId) }),
  });
}
