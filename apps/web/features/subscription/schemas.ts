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

/**
 * Profile-completion stage (upgrade modal, Free-plan path). Phone regex mirrors the backend's
 * `UpdateBillingProfileDto` exactly (`^01[0-9]{9}$`) so client and server reject the same inputs.
 */
export const profileCompletionSchema = z.object({
  phone: z.string().trim().regex(/^01[0-9]{9}$/, "Enter a valid Bangladeshi mobile number (01XXXXXXXXX)"),
  // Optional here — the farm almost always already has a name. The modal only shows/requires this
  // field when the farm truly has none yet (checked at submit time against the fetched farm profile).
  farmName: z.string().trim().max(100).optional(),
  address: z.string().trim().min(1).max(300),
});

export type ProfileCompletionFormValues = z.infer<typeof profileCompletionSchema>;
