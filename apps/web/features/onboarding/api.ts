"use client";

import { unwrapEnvelope } from "@/lib/api/envelope";
import { NetworkError } from "@/lib/api/errors";
import type { ApiEnvelope } from "@/types/api";
import type { CreateFarmInput } from "./schemas";
import type { CreateFarmResult } from "./types";

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
};
