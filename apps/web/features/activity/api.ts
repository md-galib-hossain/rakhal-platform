"use client";

import { apiFetch, apiFetchPage } from "@/lib/api/client";
import type { CursorPage } from "@/types/api";
import type { ActivityListFilters, ActivityLogEntry, ChainIntegrityResult } from "./types";

/** `/activity-log` — real backend route (`activity.controller.ts`), `activity.read`-gated. */
export const activityApi = {
  list(filters: ActivityListFilters, cursor?: string, limit = 20): Promise<CursorPage<ActivityLogEntry>> {
    return apiFetchPage<ActivityLogEntry>("/activity-log", {
      searchParams: {
        module: filters.module,
        from: filters.from,
        to: filters.to,
        aqrImpactOnly: filters.aqrImpactOnly,
        financialImpactOnly: filters.financialImpactOnly,
        cursor,
        limit,
      },
    });
  },
  verifyChain(): Promise<ChainIntegrityResult> {
    return apiFetch<ChainIntegrityResult>("/activity-log/verify-chain");
  },
};
