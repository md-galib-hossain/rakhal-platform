"use client";

import { useQuery } from "@tanstack/react-query";
import { qk } from "@/lib/query/keys";
import { onboardingApi } from "../api";

/** `GET /onboarding/status` — drives the wizard's step progress + resume state. Only meaningful
 * once the session has a real farm-scoped token (post `createFirstFarm`), same gate as `OnboardingWizard`. */
export function useOnboardingStatus() {
  return useQuery({
    queryKey: qk.onboarding.status(),
    queryFn: onboardingApi.status,
  });
}
