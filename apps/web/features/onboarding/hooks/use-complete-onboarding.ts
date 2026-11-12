"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query/keys";
import { onboardingApi } from "../api";

export function useCompleteOnboarding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: onboardingApi.complete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.onboarding.status() });
    },
  });
}
