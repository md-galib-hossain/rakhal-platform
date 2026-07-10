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
        queryClient.invalidateQueries({ queryKey: qk.auth.session() });
      }
    },
  });
}
