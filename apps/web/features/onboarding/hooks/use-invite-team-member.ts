"use client";

import { useMutation } from "@tanstack/react-query";
import { onboardingApi } from "../api";

export function useInviteTeamMember() {
  return useMutation({
    mutationFn: onboardingApi.inviteTeamMember,
  });
}
