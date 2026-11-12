"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query/keys";
import { onboardingApi } from "../api";

export function useCreateFarm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: onboardingApi.createFarm,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.auth.session() });
    },
  });
}
