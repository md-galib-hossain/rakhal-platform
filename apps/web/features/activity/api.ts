"use client";

import { apiFetchPage } from "@/lib/api/client";
import type { CursorPage } from "@/types/api";
import type { ActivityListFilters, ActivityLogEntry } from "./types";

/** `/activity-log` — real backend route (`activity.controller.ts`), `activity.read`-gated. */
export const activityApi = {
  list(filters: ActivityListFilters, cursor?: string): Promise<CursorPage<ActivityLogEntry>> {
    return apiFetchPage<ActivityLogEntry>("/activity-log", {
      searchParams: {
        module: filters.module,
        from: filters.from,
        to: filters.to,
        aqrImpactOnly: filters.aqrImpactOnly,
        financialImpactOnly: filters.financialImpactOnly,
        cursor,
        limit: 20,
      },
    });
  },
};
