"use client";

import { apiFetch } from "@/lib/api/client";
import { unwrapEnvelope } from "@/lib/api/envelope";
import { NetworkError } from "@/lib/api/errors";
import type { ApiEnvelope } from "@/types/api";
import type { ConfigureOnboardingInput, CreateFarmInput, InviteTeamMemberInput } from "./schemas";
import type {
  CompleteOnboardingResult,
  ConfigureOnboardingResult,
  CreateFarmResult,
  InviteTeamMemberResult,
  OnboardingStatus,
} from "./types";

/**
 * Calls our own BFF route (`/api/onboarding/create-farm`), NOT the generic
 * `/api/backend/[...path]` proxy — it has bespoke cookie-escalation logic
 * (`lib/auth/session.ts#createFirstFarm`) a pass-through proxy can't do. Mirrors
 * `features/auth/api.ts`'s `login`.
 */
export const onboardingApi = {
  async createFarm(input: CreateFarmInput): Promise<CreateFarmResult> {
    let res: Response;
    try {
      res = await fetch("/api/onboarding/create-farm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(input),
      });
    } catch (cause) {
      throw new NetworkError(cause);
    }
    const envelope = (await res.json()) as ApiEnvelope<CreateFarmResult>;
    return unwrapEnvelope(envelope, res.status);
  },

  /** Steps 2/3/5/6 go through the standard `/api/backend` proxy (`onboarding.controller.ts`) —
   * unlike `createFarm` above, these run against an already-real farm-scoped token, no bespoke
   * cookie escalation needed. */
  status(): Promise<OnboardingStatus> {
    return apiFetch<OnboardingStatus>("/onboarding/status");
  },
  configure(input: ConfigureOnboardingInput): Promise<ConfigureOnboardingResult> {
    return apiFetch<ConfigureOnboardingResult>("/onboarding/configure", { method: "POST", body: input });
  },
  complete(): Promise<CompleteOnboardingResult> {
    return apiFetch<CompleteOnboardingResult>("/onboarding/complete", { method: "POST", body: {} });
  },
  /** `POST /settings/team/invite` (RAKHAL-030) — called directly (not through a Settings feature
   * import, RFE-045 isn't built yet) since the Owner already has `team.invite` on their own farm. */
  inviteTeamMember(input: InviteTeamMemberInput): Promise<InviteTeamMemberResult> {
    return apiFetch<InviteTeamMemberResult>("/settings/team/invite", { method: "POST", body: input });
  },
};
