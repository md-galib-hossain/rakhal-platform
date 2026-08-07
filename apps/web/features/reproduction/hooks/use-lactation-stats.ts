"use client";

import { useQuery } from "@tanstack/react-query";
import { qk } from "@/lib/query/keys";
import { reproductionApi } from "../api";

const STALE_TIME = 60_000;

/** RAKHAL-291-F. `GET /reproduction/lactations/:id/stats` (RAKHAL-283/284) — today/7d/30d yield,
 * lactation-to-date totals by disposition, peak, persistency for the cow profile's Lactation
 * Summary card. Disabled until `lactationId` is known — callers resolve the cow's current
 * lactation first via `useLactationCompare` (`current.lactationId`/`current.dim`), the same
 * pattern `useLactationCurve` (RAKHAL-292-F) already established, so this hook doesn't duplicate
 * a second "find the active lactation" query. */
export function useLactationStats(lactationId: string | undefined) {
  return useQuery({
    queryKey: qk.reproduction.lactationStats(lactationId),
    queryFn: () => reproductionApi.lactationStats(lactationId as string),
    enabled: Boolean(lactationId),
    staleTime: STALE_TIME,
  });
}
