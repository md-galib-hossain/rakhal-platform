import type { QueryClient } from "@tanstack/react-query";

// Cattle query keys that are farm-wide lookups, not part of any one animal's state.
const STATIC_CATTLE_KEYS = new Set(["breeds", "sheds", "animal-groups"]);

/**
 * Refetch what an event on one animal can change: that animal's detail/overview/summaries/timeline/Next up, the cattle
 * lists and highlights, and the cross-module caches. Replaces the old blanket `["cattle"]` invalidation, which also
 * refetched every other animal ever opened and made a failed background refetch blank the open workspace (RFE-170).
 * Without an id, only the farm-wide lookups are spared.
 */
export function invalidateAnimal(queryClient: QueryClient, cattleId?: string, extraKeys: readonly string[] = []) {
  void queryClient.invalidateQueries({
    predicate: ({ queryKey }) => {
      if (queryKey[0] !== "cattle") return false;
      const scope = queryKey[1];
      if (typeof scope === "string" && STATIC_CATTLE_KEYS.has(scope)) return false;
      if (scope === "list" || scope === "highlights" || scope === "category-count") return true;
      return cattleId ? queryKey[2] === cattleId : true;
    },
  });
  if (cattleId) void queryClient.invalidateQueries({ queryKey: ["events", "timeline", cattleId] });
  else void queryClient.invalidateQueries({ queryKey: ["events"] });
  for (const key of extraKeys) void queryClient.invalidateQueries({ queryKey: [key] });
}
