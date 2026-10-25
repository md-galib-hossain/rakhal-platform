"use client";

import { useInfiniteCursorList } from "@/lib/hooks/use-infinite-cursor-list";
import { qk } from "@/lib/query/keys";
import { reportsApi } from "../api";
import type { ReportListFilters, ReportSummary } from "../types";

const LIST_STALE_MS = 15_000;

/**
 * Cursor-paginated report history (`GET /reports`, newest first), append-forever via the shared
 * `useInfiniteCursorList` (dedupe by `id`, repeated-cursor guard, 4xx-aware retries). Each filter
 * combination is its own cache entry. Feed `items`/`hasNextPage`/`isFetchingNextPage`/`isNextPageError`/
 * `fetchNextPage` to `InfiniteScrollFooter`.
 */
export function useReportsInfinite(filters: ReportListFilters = {}, options: { enabled?: boolean; pageSize?: number } = {}) {
  return useInfiniteCursorList<ReportSummary>(
    qk.reports.list({ type: filters.type, origin: filters.origin, status: filters.status }),
    (cursor, limit) => reportsApi.list(filters, cursor, limit),
    { staleTime: LIST_STALE_MS, enabled: options.enabled, pageSize: options.pageSize },
  );
}
