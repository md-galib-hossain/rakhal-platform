"use client";

import { useQuery } from "@tanstack/react-query";
import { qk } from "@/lib/query/keys";
import { reproductionApi } from "../api";
import type { LactationComparisonGroupBy } from "../types";

const STALE_TIME = 60_000;

/** RAKHAL-292-F/287. Resolves the cow's current (and, if it exists, previous) lactation without the
 * caller needing to know a lactation id up front — the lactation-curve chart uses `current.lactationId`
 * to drive `useLactationCurve`, and `previous.lactationId` for the "previous lactation" overlay toggle. */
export function useLactationCompare(cattleId: string | undefined, byLactationNumber = true) {
  return useQuery({
    queryKey: qk.reproduction.lactationCompare(cattleId, byLactationNumber),
    queryFn: () => reproductionApi.compareLactations(cattleId as string, byLactationNumber),
    enabled: Boolean(cattleId),
    staleTime: STALE_TIME,
  });
}

/** RAKHAL-292-F/287. Farm-wide average yield per DIM-range bucket — the "farm average" overlay
 * option, always grouped by `dimRange` here since that's the only `groupBy` whose buckets line up
 * with a DIM-axis chart (`parity`/`shed`/`feedGroup` describe cows, not days-in-milk). */
export function useLactationCompareGroups(groupBy: LactationComparisonGroupBy = "dimRange", enabled = true) {
  return useQuery({
    queryKey: qk.reproduction.lactationCompareGroups(groupBy),
    queryFn: () => reproductionApi.compareLactationGroups(groupBy),
    enabled,
    staleTime: STALE_TIME,
  });
}
