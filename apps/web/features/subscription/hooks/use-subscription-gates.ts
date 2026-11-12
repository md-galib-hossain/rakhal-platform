"use client";

import { useSubscription } from "./use-subscription";

/** Mirrors `lib/auth/permissions.tsx`'s `useCan()` — never compare `status`/`plan_name` directly in
 * components, always gate through one of these. */

const USABLE_STATUSES = new Set(["ACTIVE", "TRIALING", "PAST_DUE"]);

/** `resource.action`-style feature keys from the backend's plan catalogue, e.g. "scoreboard.read". */
export function useHasFeature() {
  const { data } = useSubscription();
  return (feature: string) => data?.features.includes(feature) ?? false;
}

/** True once EXPIRED/CANCELLED/PAST_DUE/NONE — mirrors the backend's own `SubscriptionGuard` (ACTIVE/
 * TRIALING = full access, everything else blocks mutating verbs with a 403). `undefined` while the
 * subscription hasn't loaded yet — don't flash a banner before we actually know the status. */
export function useIsReadOnly(): boolean {
  const { data } = useSubscription();
  if (!data) return false;
  return !USABLE_STATUSES.has(data.status);
}

/** The top-tier-only feature key (see backend `domain/subscription-features.ts`) — a plan that has
 * it has nothing left to upgrade into. */
const TOP_TIER_FEATURE = "reports.scheduled";

/** Gates the sidebar's periodic upgrade ad (RFE-008): only worth showing to farms that (a) aren't
 * already locked out — nagging an expired account to "upgrade" when they can't even use the app is
 * the wrong message, that's the read-only banner's job — and (b) haven't already got the top plan. */
export function useIsEligibleForUpgradeAd(): boolean {
  const { data } = useSubscription();
  if (!data) return false;
  if (!USABLE_STATUSES.has(data.status)) return false;
  return !data.features.includes(TOP_TIER_FEATURE);
}
