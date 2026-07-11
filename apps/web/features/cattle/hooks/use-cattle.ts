"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query/keys";
import { cattleApi } from "../api";
import type { BulkAction, CattleListFilters } from "../types";

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
