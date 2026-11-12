"use client"; // TanStack Query hook

import { useQuery } from "@tanstack/react-query";
import { eventsApi } from "../api";

/** One animal's most recent reproduction events: `GET /cattle/:id/events?group=REPRODUCTION`, newest first. */
export function useReproductionTimeline(cattleId: string | undefined, limit = 50) {
  return useQuery({
    queryKey: ["events", "timeline", cattleId, "reproduction-tab", limit],
    queryFn: () => eventsApi.timeline(cattleId as string, { group: "REPRODUCTION", includeVoided: false }, undefined, limit),
    enabled: Boolean(cattleId),
    staleTime: 30_000,
  });
}
