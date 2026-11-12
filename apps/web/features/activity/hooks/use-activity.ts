"use client";

import { useQuery } from "@tanstack/react-query";
import { qk } from "@/lib/query/keys";
import { useCursorPager } from "@/lib/hooks/use-cursor-pager";
import { useInfiniteCursorList } from "@/lib/hooks/use-infinite-cursor-list";
import { activityApi } from "../api";
import type { ActivityListFilters } from "../types";

const STALE_TIME = 30_000;

/** Shared-pager adapter (`useCursorPager`) over the cursor-only `GET /activity-log`. */
export function useActivityPagedList(filters: ActivityListFilters) {
  return useCursorPager(
    qk.activity.list(filters as Record<string, string | undefined>),
    (cursor, limit) => activityApi.list(filters, cursor, limit),
    { staleTime: STALE_TIME },
  );
}

/** Infinite-scroll variant of `useActivityPagedList`. */
export function useActivityInfiniteList(filters: ActivityListFilters) {
  return useInfiniteCursorList(
    qk.activity.list(filters as Record<string, string | undefined>),
    (cursor, limit) => activityApi.list(filters, cursor, limit),
    { staleTime: STALE_TIME },
  );
}

/** RFE-042's own "hash-chain badge" AC — recomputes the farm's hash chain server-side
 * (`ActivityLogService#verifyChain`) and reports whether it's intact. */
export function useChainIntegrity() {
  return useQuery({
    queryKey: qk.activity.chainIntegrity(),
    queryFn: () => activityApi.verifyChain(),
    staleTime: STALE_TIME,
  });
}
