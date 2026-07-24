"use client";

import { qk } from "@/lib/query/keys";
import { useCursorPager } from "@/lib/hooks/use-cursor-pager";
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
