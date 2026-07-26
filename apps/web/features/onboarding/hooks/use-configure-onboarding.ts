"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query/keys";
import { onboardingApi } from "../api";

export function useConfigureOnboarding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: onboardingApi.configure,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.onboarding.status() });
    },
  });
}
