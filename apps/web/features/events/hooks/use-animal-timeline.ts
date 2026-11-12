"use client"; // TanStack Query hooks

import { useMemo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { dedupeById, shouldRetryInfinite } from "@/lib/hooks/use-infinite-cursor-list";
import { eventsApi } from "../api";
import { inGroup, type TimelineEvent, type TimelineGroup } from "../timeline-model";

const PAGE_SIZE = 30;

/** One animal's event timeline (RFE-155): `GET /cattle/:id/events` (RAKHAL-479), cursor-paged, newest first. */
export function useAnimalTimeline({
  cattleId,
  group,
  includeVoided,
}: {
  cattleId: string;
  group: TimelineGroup | null;
  includeVoided: boolean;
}) {
  const route = useInfiniteQuery({
    queryKey: ["events", "timeline", cattleId, { group, includeVoided }],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      eventsApi.timeline(cattleId, { group, includeVoided }, pageParam, PAGE_SIZE),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage, _all, lastParam, allParams) => {
      if (!lastPage.meta.hasNextPage) return undefined;
      const next = lastPage.meta.endCursor ?? undefined;
      return !next || next === lastParam || allParams.includes(next) ? undefined : next;
    },
    staleTime: 30_000,
    retry: shouldRetryInfinite,
  });

  const items = useMemo(
    () =>
      dedupeById(route.data?.pages.flatMap((page) => page.items) ?? []).filter(
        (row) => inGroup(row, group) && (includeVoided || row.status !== "VOIDED"),
      ),
    [route.data, group, includeVoided],
  );

  const hasLoaded = (route.data?.pages.length ?? 0) > 0;
  return {
    items,
    isLoading: route.isLoading,
    isError: route.isError && !hasLoaded,
    refetch: () => void route.refetch(),
    hasNextPage: Boolean(route.hasNextPage),
    isFetchingNextPage: route.isFetchingNextPage,
    isNextPageError: route.isError && hasLoaded,
    fetchNextPage: () => void route.fetchNextPage(),
  };
}

export type { TimelineEvent };
