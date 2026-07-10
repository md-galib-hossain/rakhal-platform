"use client";

import { useQuery } from "@tanstack/react-query";
import { qk } from "@/lib/query/keys";
import { useSession } from "@/lib/auth/use-session";
import { subscriptionApi } from "../api";

export function useSubscription() {
  const { data: session } = useSession();
  return useQuery({
    queryKey: qk.subscription.current(),
    queryFn: subscriptionApi.current,
    enabled: !!session,
    staleTime: 60_000,
  });
}
