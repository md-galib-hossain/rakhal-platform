"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query/keys";
import { useSession } from "@/lib/auth/use-session";
import { useCursorPager } from "@/lib/hooks/use-cursor-pager";
import { subscriptionApi } from "../api";
import type {
  CheckoutPayload,
  PreviewCheckoutPayload,
  ScheduleDowngradePayload,
  UpdateFarmProfilePayload,
} from "../types";

const STALE_TIME = 60_000;

/** `GET /plans` — public pricing catalogue (upgrade options + the ৳ price the summary card matches
 * against `GET /subscription`'s `plan_id`). */
export function usePlans() {
  return useQuery({
    queryKey: qk.billing.plans(),
    queryFn: subscriptionApi.plans,
    staleTime: 5 * STALE_TIME,
  });
}

/** `GET /billing/invoices` — cursor-paginated invoice history (`subscription.read`). */
export function useInvoices() {
  return useCursorPager(
    qk.billing.invoices(),
    (cursor, limit) => subscriptionApi.invoices(cursor, limit),
    { staleTime: STALE_TIME, initialPageSize: 10 },
  );
}

/** `GET /legal/consent` — the ToS/Privacy gate the plan picker checks before enabling checkout. */
export function useConsentStatus() {
  const { data: session } = useSession();
  return useQuery({
    queryKey: qk.legal.consent(),
    queryFn: subscriptionApi.consentStatus,
    enabled: !!session,
    staleTime: STALE_TIME,
  });
}

/** `POST /billing/checkout`. Invalidates subscription + billing so the summary/invoices refresh on a
 * ৳0 instant-PAID; on a bKash redirect the caller navigates away before the invalidation matters. */
export function useCheckout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CheckoutPayload) => subscriptionApi.checkout(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["subscription"] });
      void queryClient.invalidateQueries({ queryKey: ["billing"] });
    },
  });
}

/** `POST /legal/consent` (accept-all). */
export function useAcceptConsent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => subscriptionApi.acceptConsent(),
    onSuccess: (data) => queryClient.setQueryData(qk.legal.consent(), data),
  });
}

/** `GET /settings/farm` — pre-fill source for the upgrade modal's profile-completion stage.
 * `enabled` so it only fetches once that stage is actually reachable (Free plan selected). */
export function useFarmProfile(enabled: boolean) {
  return useQuery({
    queryKey: qk.settings.farm(),
    queryFn: subscriptionApi.farmProfile,
    enabled,
    staleTime: STALE_TIME,
  });
}

/** `PATCH /billing/profile` — the mandatory profile-completion step gating Free-plan checkout. */
export function useUpdateFarmProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateFarmProfilePayload) => subscriptionApi.updateProfile(payload),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: qk.settings.farm() }),
  });
}

/** `POST /billing/checkout/preview` — on-demand "Apply" action for the coupon stage, not a query;
 * the real `checkout()` re-validates the coupon regardless of whether this was ever called. */
export function usePreviewCheckout() {
  return useMutation({
    mutationFn: (payload: PreviewCheckoutPayload) => subscriptionApi.previewCheckout(payload),
  });
}

/** `POST /billing/downgrade/schedule` — never charges; invalidates `subscription` so the Current
 * Plan card immediately reflects the pending switch. */
export function useScheduleDowngrade() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ScheduleDowngradePayload) => subscriptionApi.scheduleDowngrade(payload),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["subscription"] }),
  });
}

/** `POST /billing/downgrade/cancel`. */
export function useCancelScheduledDowngrade() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => subscriptionApi.cancelScheduledDowngrade(),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["subscription"] }),
  });
}
