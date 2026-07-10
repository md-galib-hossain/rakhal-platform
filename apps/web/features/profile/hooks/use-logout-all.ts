"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { qk } from "@/lib/query/keys";
import { logoutAllDevices } from "../api";

/** Revokes every session including the current one — backend clears the refresh cookie
 * server-side, so the only correct next step is to send the user back to `/login`. */
export function useLogoutAll() {
  const queryClient = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: logoutAllDevices,
    onSuccess: () => {
      queryClient.setQueryData(qk.auth.session(), null);
      router.push("/login");
    },
  });
}
