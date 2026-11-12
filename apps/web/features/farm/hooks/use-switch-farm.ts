"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { unwrapEnvelope } from "@/lib/api/envelope";
import { NetworkError } from "@/lib/api/errors";
import type { ApiEnvelope } from "@/types/api";

interface SwitchFarmData {
  user: { id: string; email: string; name: string; isEmailVerified: boolean };
}

async function switchFarm(farmId: string): Promise<SwitchFarmData> {
  let res: Response;
  try {
    res = await fetch("/api/auth/select-farm", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ farmId }),
    });
  } catch (cause) {
    throw new NetworkError(cause);
  }
  const envelope = (await res.json()) as ApiEnvelope<SwitchFarmData>;
  return unwrapEnvelope(envelope, res.status);
}

/** Switches the active farm on an already-logged-in session via `/api/auth/select-farm`
 * (`/auth/refresh` under the hood — same mechanism the login-time multi-farm picker uses,
 * now also reachable post-login). All farm-scoped cache must be dropped, not just the
 * session key, or the previous farm's cattle/inventory/dashboard data flashes stale. */
export function useSwitchFarm() {
  const queryClient = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: switchFarm,
    onSuccess: () => {
      queryClient.clear();
      router.refresh();
    },
  });
}
