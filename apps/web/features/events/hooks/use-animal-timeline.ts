"use client"; // TanStack Query hooks

import { useMemo, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/errors";
import { dedupeById, shouldRetryInfinite } from "@/lib/hooks/use-infinite-cursor-list";
import { useCattleHealthSummary, useCattleOverview } from "@/features/cattle/hooks/use-cattle-detail-tabs";
import { useReproductionEvents } from "@/features/reproduction/hooks/use-reproduction";
import { eventsApi } from "../api";
import {
  fromCases,
  fromOverview,
  fromReproEvents,
  fromTreatments,
  inGroup,
  sortNewestFirst,
  type TimelineEvent,
  type TimelineGroup,
} from "../timeline-model";

const PAGE_SIZE = 30;

export type TimelineSource = "pending" | "route" | "fallback";

/**
 * One animal's event timeline (RFE-155). Tries the real route (`GET /cattle/:id/events`, RAKHAL-479); while it answers
 * 404 the same rows are built client-side from reproduction events, treatments, illness cases, weights and BCS, so the UI
 * ships either way and switches over on its own once the route exists. Same return shape in both modes.
 */
export function useAnimalTimeline({
  cattleId,
  gender,
  animalCategory,
  group,
  includeVoided,
}: {
  cattleId: string;
  gender: string;
  animalCategory: string;
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

  const routeMissing = route.error instanceof ApiError && route.error.status === 404;
  const showRepro = gender === "FEMALE" && animalCategory !== "CALF";
  const repro = useReproductionEvents({ cattleId: routeMissing && showRepro ? cattleId : undefined, limit: 100 });
  // Shared with the state cards (same query keys), so these add no requests while the workspace is open.
  const health = useCattleHealthSummary(cattleId);
  const overview = useCattleOverview(cattleId);

  // Fallback paging is local: show PAGE_SIZE rows, then more on demand. A group change starts over.
  const [shown, setShown] = useState<{ group: TimelineGroup | null; count: number }>({ group, count: PAGE_SIZE });
  const count = shown.group === group ? shown.count : PAGE_SIZE;

  const fallbackRows = useMemo(() => {
    if (!routeMissing) return [];
    const rows = [
      ...fromReproEvents(showRepro ? (repro.data?.items ?? []) : []),
      ...fromTreatments(health.data?.treatmentHistory ?? []),
      ...fromCases(health.data?.activeCases ?? []),
      ...fromOverview(overview.data),
    ];
    return sortNewestFirst(rows.filter((row) => inGroup(row, group)));
  }, [routeMissing, showRepro, repro.data, health.data, overview.data, group]);

  const routeRows = useMemo(
    () =>
      dedupeById(route.data?.pages.flatMap((page) => page.items) ?? []).filter(
        (row) => inGroup(row, group) && (includeVoided || row.status !== "VOIDED"),
      ),
    [route.data, group, includeVoided],
  );

  if (routeMissing) {
    const loading = repro.isLoading || health.isLoading || overview.isLoading;
    const failed = repro.isError || health.isError || overview.isError;
    return {
      source: "fallback" as TimelineSource,
      items: fallbackRows.slice(0, count),
      isLoading: loading,
      isError: failed,
      refetch: () => {
        void repro.refetch();
        void health.refetch();
        void overview.refetch();
      },
      hasNextPage: fallbackRows.length > count,
      isFetchingNextPage: false,
      isNextPageError: false,
      fetchNextPage: () => setShown({ group, count: count + PAGE_SIZE }),
    };
  }

  const hasLoaded = (route.data?.pages.length ?? 0) > 0;
  return {
    source: (route.isSuccess ? "route" : "pending") as TimelineSource,
    items: routeRows,
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
