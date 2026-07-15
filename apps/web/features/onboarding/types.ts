import type { SessionUser } from "@/lib/auth/session-types";

/** Response shape of `POST /api/onboarding/create-farm` (`lib/auth/session.ts#createFirstFarm`). */
export interface CreateFarmResult {
  user: SessionUser;
}
