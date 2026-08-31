"use client";

import { useQuery } from "@tanstack/react-query";
import { qk } from "@/lib/query/keys";
import { useSession } from "@/lib/auth/use-session";
import { farmApi } from "../api";

/** Resolves the active farm's real name/slug for display (sidebar `OrgSwitcher`). Fetches the full
 * `GET /farms` list and matches on the JWT's `farmId` — there is no single-farm-by-id endpoint. */
export function useCurrentFarm() {
  const { data: session, isLoading: sessionLoading } = useSession();
  const query = useQuery({
    queryKey: qk.farm.list(),
    queryFn: farmApi.list,
    enabled: !!session?.farmId,
    staleTime: 5 * 60_000,
  });

  return {
    farm: query.data?.find((f) => f.id === session?.farmId),
    farmId: session?.farmId,
    farms: query.data ?? [],
    isLoading: sessionLoading || query.isLoading,
    isError: query.isError,
  };
}
