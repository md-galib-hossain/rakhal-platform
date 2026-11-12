"use client";

import { useQuery } from "@tanstack/react-query";
import { qk } from "@/lib/query/keys";
import { profileApi } from "../api";
import type { ProfileUser } from "../types";

/** `initialData` comes from the Server Component's `serverFetch` call — this hook only takes
 * over for client-side revalidation after a mutation (e.g. language change). */
export function useProfile(initialData?: ProfileUser) {
  return useQuery({
    queryKey: qk.profile.me(),
    queryFn: profileApi.me,
    initialData,
    staleTime: 60_000,
  });
}
