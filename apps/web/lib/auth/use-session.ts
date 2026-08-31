"use client"; // TanStack Query hook — session state on the client

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { unwrapEnvelope } from "@/lib/api/envelope";
import { NetworkError } from "@/lib/api/errors";
import { qk } from "@/lib/query/keys";
import type { ApiEnvelope } from "@/types/api";

export interface ClientSessionUser {
  id: string;
  email: string;
  name: string;
  isEmailVerified: boolean;
}

export interface ClientSession {
  user: ClientSessionUser;
  farmId: string;
  /** `resource.action` strings from the backend's RBAC catalogue (RAKHAL-260 — `GET /auth/me`,
   * proxied server-side by `/api/auth/session`; that endpoint no longer leaks `passwordHash`
   * either, RAKHAL-259). Empty if the backend call fails — `<Can/>` just renders fallbacks. */
  permissions: string[];
}

async function fetchSession(): Promise<ClientSession | null> {
  let res: Response;
  try {
    res = await fetch("/api/auth/session", { credentials: "same-origin" });
  } catch (cause) {
    throw new NetworkError(cause);
  }
  const envelope = (await res.json()) as ApiEnvelope<ClientSession | null>;
  return unwrapEnvelope(envelope, res.status);
}

export function useSession() {
  return useQuery({
    queryKey: qk.auth.session(),
    queryFn: fetchSession,
    staleTime: 5 * 60_000,
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: async () => {
      await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    },
    onSuccess: () => {
      // Drop all farm-scoped cache (cattle, inventory, dashboard, ...), not just session —
      // else next login shows stale data from the previous account/farm until refresh.
      queryClient.clear();
      router.push("/login");
    },
  });
}
