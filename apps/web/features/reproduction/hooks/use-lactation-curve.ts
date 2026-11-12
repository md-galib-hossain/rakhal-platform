"use client";

import { useQuery } from "@tanstack/react-query";
import { qk } from "@/lib/query/keys";
import { reproductionApi } from "../api";

const STALE_TIME = 60_000;

/** RAKHAL-292-F. Daily-yield-by-DIM series (with per-day data-quality markers, RAKHAL-283) for one
 * lactation; optionally overlays a second DIM-aligned series via `compareLactationId`. Disabled until
 * `lactationId` is known (the caller resolves the cow's current active lactation first, e.g. via
 * `useLactationCompare`, before mounting the chart). */
export function useLactationCurve(lactationId: string | undefined, compareLactationId?: string) {
  return useQuery({
    queryKey: qk.reproduction.lactationCurve(lactationId, compareLactationId),
    queryFn: () => reproductionApi.lactationCurve(lactationId as string, compareLactationId),
    enabled: Boolean(lactationId),
    staleTime: STALE_TIME,
  });
}
