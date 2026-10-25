"use client"; // session + subscription are client caches

import { useSyncExternalStore } from "react";
import { useSession } from "@/lib/auth/use-session";
import { useSubscription } from "@/features/subscription/hooks/use-subscription";
import { useReportsAccess, type ReportsAccess } from "@/features/reports";

const noopSubscribe = () => () => {};

export interface ReportsAccessState extends ReportsAccess {
  /** Session known and hydrated: before this, `canRead` is false only because nothing has loaded, so show a skeleton, not "no access". */
  ready: boolean;
  /** Plan is known to lack `reports.generate` (false while loading or when the subscription could not be read). */
  planBlocked: boolean;
}

/** `useReportsAccess` plus the "do we know yet" flags the landing page needs to avoid flashing a false no-access state. */
export function useReportsAccessState(): ReportsAccessState {
  const access = useReportsAccess();
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const session = useSession();
  const subscription = useSubscription();
  const ready = mounted && !session.isPending;
  const planKnown = ready && !!session.data && subscription.isSuccess;
  return { ...access, ready, planBlocked: planKnown && !access.canUseFeature };
}
