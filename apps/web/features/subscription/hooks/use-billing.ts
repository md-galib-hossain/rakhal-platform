"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query/keys";
import { useSession } from "@/lib/auth/use-session";
import { useCursorPager } from "@/lib/hooks/use-cursor-pager";
import { subscriptionApi } from "../api";
import type { CheckoutPayload } from "../types";

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
