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
  /** A scheduled downgrade/lateral switch (RFE-036 follow-up) — set once
   * `POST /billing/downgrade/schedule` has been called and not yet cancelled or applied. */
  pending_plan_id: string | null;
  pending_plan_name: string | null;
  pending_effective_at: string | null;
}

/* ---------------------------------------------------------------------------
 * Billing (RFE-036) — shapes verified live against the backend
 * (`PlanCatalogueService.listPlans`, `BillingService.PublicInvoice`/`checkout`,
 * `LegalConsentService.getConsentStatus`). snake_case per the API convention.
 * ------------------------------------------------------------------------- */

export type BillingPeriod = "MONTHLY" | "YEARLY";

/** Prisma `InvoiceStatus`. */
export type InvoiceStatus = "DRAFT" | "PENDING" | "PAID" | "FAILED" | "VOID" | "REFUNDED";

/** `GET /plans` item (public pricing catalogue). */
export interface PublicPlan {
  id: string;
  name: string;
  description: string | null;
  monthly_price: number;
  yearly_price: number | null;
  limits: { max_cattle: number | null; max_farm_members: number | null };
  features: string[];
}

/** `GET /billing/invoices` item. */
export interface PublicInvoice {
  id: string;
  invoice_number: string | null;
  plan_id: string;
  billing_period: BillingPeriod;
  currency: string;
  subtotal: number;
  discount_total: number;
  referral_credit_applied: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  status: InvoiceStatus;
  paid_at: string | null;
  created_at: string;
}

/** `POST /billing/checkout` body. The client picks plan + period only — it **never** sends an
 * amount; the server computes the total (PAY-01). */
export interface CheckoutPayload {
  planId: string;
  billingPeriod: BillingPeriod;
  couponCode?: string;
}

/** `POST /billing/checkout` result. `checkout.redirect_url` carries the bKash redirect for a paid
 * invoice; `checkout` is `null` for a ৳0 invoice that is instantly PAID (PAY-07). */
export interface CheckoutResult {
  invoice: PublicInvoice;
  checkout:
    | { provider: string; provider_payment_id: string; redirect_url: string | null }
    | { provider_configured: boolean; initiation_failed?: boolean }
    | null;
  idempotent: boolean;
}

/** `GET /legal/consent` — the ToS/Privacy gate `POST /billing/checkout` enforces. */
export interface LegalConsentStatus {
  documents: { id: string; type: string; version: string; title: string; accepted: boolean }[];
  all_accepted: boolean;
}

/* ---------------------------------------------------------------------------
 * Upgrade modal (multi-stage): Free-plan profile gate + coupon preview.
 * ------------------------------------------------------------------------- */

/** `GET /settings/farm` (subset used for the profile-completion stage's pre-fill). */
export interface FarmProfile {
  farm_id: string;
  farm_name: string;
  phone: string | null;
  address: string | null;
}

/** `PATCH /billing/profile` body — the mandatory step before a Free-plan checkout can activate. */
export interface UpdateFarmProfilePayload {
  phone: string;
  address: string;
  farm_name?: string;
}

/** `POST /billing/checkout/preview` body — `couponCode` is required (unlike `CheckoutPayload`). */
export interface PreviewCheckoutPayload {
  planId: string;
  billingPeriod: BillingPeriod;
  couponCode: string;
}

/** `POST /billing/checkout/preview` result — mirrors `PublicInvoice`'s pricing fields. */
export interface PreviewCheckoutResult {
  plan_id: string;
  billing_period: BillingPeriod;
  currency: string;
  subtotal: number;
  discount_total: number;
  estimated_credit_applied: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
}

/* ---------------------------------------------------------------------------
 * Scheduled downgrade (RFE-036 follow-up) — never charges; the switch lands at
 * the current period's `expires_at`, applied by the backend's daily sweep.
 * ------------------------------------------------------------------------- */

export interface ScheduleDowngradePayload {
  planId: string;
  billingPeriod: BillingPeriod;
}

export interface ScheduleDowngradeResult {
  pending_plan_id: string;
  pending_plan_name: string;
  pending_billing_period: BillingPeriod;
  effective_at: string;
}
