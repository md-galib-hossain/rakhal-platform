"use client";

import { apiFetch, apiFetchPage } from "@/lib/api/client";
import type { CursorPage } from "@/types/api";
import type {
  CheckoutPayload,
  CheckoutResult,
  LegalConsentStatus,
  PublicInvoice,
  PublicPlan,
  SubscriptionSummary,
} from "./types";

/**
 * `/subscription`, `/plans`, `/billing/*`, `/legal/consent` — all through the generic `/api/backend`
 * proxy (tokens attached server-side; the browser never holds one). The receipt PDF is the one
 * exception: it's a binary stream the JSON-envelope proxy can't carry, so it goes through the
 * bespoke `app/api/billing/invoices/[id]/receipt` route instead.
 *
 * `GET /subscription` needs only the farm chain (any member, worker included, can read the farm's
 * own status). Invoice reads are `subscription.read`; checkout is `subscription.manage` (Owner).
 */
export const subscriptionApi = {
  current(): Promise<SubscriptionSummary> {
    return apiFetch<SubscriptionSummary>("/subscription");
  },
  /** Public pricing catalogue (`GET /plans`). */
  plans(): Promise<PublicPlan[]> {
    return apiFetch<PublicPlan[]>("/plans");
  },
  /** Cursor-paginated invoice history (`GET /billing/invoices`, `subscription.read`). */
  invoices(cursor?: string, limit = 10): Promise<CursorPage<PublicInvoice>> {
    return apiFetchPage<PublicInvoice>("/billing/invoices", { searchParams: { cursor, limit } });
  },
  /** Start a checkout (`POST /billing/checkout`, `subscription.manage`). The server computes the
   * total; a paid invoice returns a bKash `checkout.redirect_url`, a ৳0 invoice returns
   * `checkout: null` already PAID. */
  checkout(payload: CheckoutPayload): Promise<CheckoutResult> {
    return apiFetch<CheckoutResult>("/billing/checkout", { method: "POST", body: payload });
  },
  /** ToS/Privacy consent status (`GET /legal/consent`). */
  consentStatus(): Promise<LegalConsentStatus> {
    return apiFetch<LegalConsentStatus>("/legal/consent");
  },
  /** Accept all current legal documents (`POST /legal/consent`, empty body = accept-all). */
  acceptConsent(): Promise<LegalConsentStatus> {
    return apiFetch<LegalConsentStatus>("/legal/consent", { method: "POST", body: {} });
  },
};
