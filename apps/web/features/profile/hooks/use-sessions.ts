"use client";

import { useQuery } from "@tanstack/react-query";
import { qk } from "@/lib/query/keys";
import { profileApi } from "../api";
import type { SessionItem } from "../types";

export function useSessions(initialData?: SessionItem[]) {
  return useQuery({
    queryKey: qk.profile.sessions(),
    queryFn: profileApi.sessions,
    initialData,
    staleTime: 30_000,
  });
}
