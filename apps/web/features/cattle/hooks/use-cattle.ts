"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query/keys";
import { cattleApi } from "../api";
import type { BulkAction, CattleFormPayload, CattleListFilters } from "../types";
import type { CattleArchiveInput, CattleStatusInput } from "../schemas";

const STALE_TIME = 60_000;

/** Cursor "load more" list — one page per `fetchNextPage`, matching `DataTable`'s
 * `hasNextPage`/`onLoadMore`/`isFetchingNextPage` props directly. */
export function useCattleList(filters: CattleListFilters) {
  return useInfiniteQuery({
    queryKey: qk.cattle.list(filters as Record<string, string | undefined>),
    queryFn: ({ pageParam }) => cattleApi.list(filters, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => (lastPage.meta.hasNextPage ? (lastPage.meta.endCursor ?? undefined) : undefined),
    staleTime: STALE_TIME,
  });
}

export function useCattleHighlights() {
  return useQuery({ queryKey: qk.cattle.highlights(), queryFn: cattleApi.highlights, staleTime: STALE_TIME });
}

export function useBreeds() {
  return useQuery({ queryKey: qk.cattle.breeds(), queryFn: cattleApi.breeds, staleTime: STALE_TIME });
}

export function useSheds() {
  return useQuery({ queryKey: qk.cattle.sheds(), queryFn: cattleApi.sheds, staleTime: STALE_TIME });
}

export function useFeedGroups() {
  return useQuery({ queryKey: qk.cattle.feedGroups(), queryFn: cattleApi.feedGroups, staleTime: STALE_TIME });
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

export function useArchiveCattle() {
  const invalidate = useInvalidateCattle();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: CattleArchiveInput }) => cattleApi.archive(id, dto),
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
