/** `GET /subscription` response — verified live against `subscription.controller.ts`
 * (`Rakhal_API.md` has no §31 section for this route; PRD §31.3 SUB-07 matches). "NONE" means no
 * `FarmSubscription` row exists at all, distinct from the Prisma `SubscriptionStatus` enum values. */
export type SubscriptionStatus = "ACTIVE" | "TRIALING" | "PAST_DUE" | "EXPIRED" | "CANCELLED" | "NONE";

export interface SubscriptionSummary {
  status: SubscriptionStatus;
  plan_id: string | null;
  plan_name: string | null;
  expires_at: string | null;
  /** Feature keys the resolved plan grants — empty when the status isn't "usable"
   * (EXPIRED/CANCELLED/NONE). See `domain/subscription-features.ts` on the backend for the catalogue. */
  features: string[];
  limits: { max_cattle: number | null; max_farm_members: number | null };
  usage: { cattle: number; farm_members: number };
}
