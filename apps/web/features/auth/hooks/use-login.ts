"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query/keys";
import { authApi } from "../api";
import type { LoginInput } from "../schemas";

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: LoginInput & { farmId?: string }) => authApi.login(input),
    onSuccess: (result) => {
      if (result.status === "ok") {
        // Prior account/farm's cached data (cattle, inventory, dashboard, ...) must not
        // leak into this session — clear before refetching session.
        queryClient.clear();
        queryClient.invalidateQueries({ queryKey: qk.auth.session() });
      }
    },
  });
}
