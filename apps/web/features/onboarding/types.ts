import type { SessionUser } from "@/lib/auth/session-types";

/** Response shape of `POST /api/onboarding/create-farm` (`lib/auth/session.ts#createFirstFarm`). */
export interface CreateFarmResult {
  user: SessionUser;
}

/** `GET /onboarding/status` (`onboarding.service.ts#status`). */
export interface OnboardingStatus {
  has_completed_onboarding: boolean;
  steps: {
    farm: { done: true };
    configure: { done: boolean; sheds: number };
    cattle: { done: boolean; count: number };
    team: { done: boolean; members: number };
  };
}

/** `POST /onboarding/configure` result (`onboarding.service.ts#configure`). */
export interface ConfigureOnboardingResult {
  sheds_created: number;
  sessions_configured: string[] | null;
}

/** `POST /onboarding/complete` result. */
export interface CompleteOnboardingResult {
  has_completed_onboarding: true;
}

/** `POST /settings/team/invite` result (`team.service.ts#invite`) — only the fields this wizard
 * step needs (the real shape carries more; not fully modelled since Settings' own Team tab isn't
 * built yet, RFE-045). */
export interface InviteTeamMemberResult {
  id: string;
  email: string;
  role: string;
}
