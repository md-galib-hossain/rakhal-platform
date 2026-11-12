"use client";

import { useInfiniteCursorList } from "@/lib/hooks/use-infinite-cursor-list";
import { qk } from "@/lib/query/keys";
import { notificationsApi } from "../api";
import type { UpcomingItem, UpcomingQuery } from "../types";

const PAGE_SIZE = 30;

/**
 * Upcoming tab feed — `GET /notifications/upcoming` (RAKHAL-494), cursor-paged, soonest first. The window is
 * farm-local `YYYY-MM-DD` (`from`/`to`); omit both for the server default (today..+14 days). Rows are keyed by
 * `occurrence_id`. No polling: the sheet refetches on focus and mutations in `use-schedules` invalidate
 * `qk.notifications.upcomingAll()`.
 */
export function useUpcoming(query: UpcomingQuery = {}, options: { enabled?: boolean; pageSize?: number } = {}) {
  const sortOrder = query.sortOrder ?? "asc";
  return useInfiniteCursorList<UpcomingItem>(
    qk.notifications.upcoming({ from: query.from, to: query.to, sortOrder }),
    (cursor, limit) => notificationsApi.upcoming({ ...query, sortOrder }, cursor, limit),
    {
      getId: (row) => row.occurrence_id,
      pageSize: options.pageSize ?? PAGE_SIZE,
      enabled: options.enabled,
      staleTime: 30_000,
    },
  );
}
