"use client"; // session + team query

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { qk } from "@/lib/query/keys";
import { useCan } from "@/lib/auth/permissions";
import { useSession } from "@/lib/auth/use-session";
import { settingsApi } from "@/features/settings/api";

/**
 * Who recorded each event (RFE-178): user id -> display name. Events carry only `recordedById`. The signed-in user is
 * known from the session; everyone else comes from the team list, which needs `team.read` (workers do not have it, so
 * their rows simply show no name for other people rather than failing).
 */
export function useRecorderNames(): (id: string | null | undefined) => string | null {
  const can = useCan();
  const { data: session } = useSession();
  const team = useQuery({ queryKey: qk.settings.team(), queryFn: settingsApi.listTeam, enabled: can("team.read"), staleTime: 5 * 60_000 });
  const meId = session?.user.id;
  const meName = session?.user.name;

  return useMemo(() => {
    const names = new Map<string, string>();
    for (const row of team.data?.members ?? []) if (row.status === "active" && row.name) names.set(row.id, row.name);
    if (meId && meName) names.set(meId, meName);
    return (id) => (id ? (names.get(id) ?? null) : null);
  }, [team.data, meId, meName]);
}
