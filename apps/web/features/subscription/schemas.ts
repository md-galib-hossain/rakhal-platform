import { z } from "zod";

/**
 * Checkout form (plan-picker sheet). The client picks a plan + period only — the **server** computes
 * the total, so no amount is ever part of this form (security: never trust a client-sent price).
 * `consent` mirrors the backend's ToS/Privacy gate (`LegalConsentService.assertConsent`, which 403s
 * checkout without acceptance) — the submit stays disabled until it's true.
 */
export const checkoutSchema = z.object({
  planId: z.string().min(1),
  billingPeriod: z.enum(["MONTHLY", "YEARLY"]),
  couponCode: z.string().trim().optional(),
  consent: z.boolean().refine((v) => v === true),
});

export type CheckoutFormValues = z.infer<typeof checkoutSchema>;
