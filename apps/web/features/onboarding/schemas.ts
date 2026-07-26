import { z } from "zod";

/**
 * Mirrors the backend's CreateFarmDto (`src/modules/farm/presentation/dto/create-farm.dto.ts`),
 * plus `agreeToTerms` — `FarmService.create` gates on `LegalConsentService.assertConsent` (LGL-02)
 * before creating a farm, so the onboarding form must collect consent up front rather than let the
 * create call fail. `lib/auth/session.ts#createFirstFarm` records it (`POST /legal/consent`) before
 * creating the farm.
 */
export const createFarmSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
  agreeToTerms: z.boolean().refine((v) => v === true, { message: "agreeToTermsRequired" }),
});
export type CreateFarmInput = z.infer<typeof createFarmSchema>;

/** Wizard Step 2 — mirrors the backend's `ConfigureOnboardingDto` (RAKHAL-022, PRD §5.1 Step 3). */
export const configureOnboardingSchema = z.object({
  sheds: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(80),
        capacity: z.number().int().min(1).optional(),
        purpose: z.string().trim().max(20).optional(),
      }),
    )
    .max(10),
  active_sessions: z.array(z.enum(["morning", "noon", "evening", "night"])).min(1, { message: "sessionRequired" }),
  milk_unit: z.enum(["litres", "kg"]),
});
export type ConfigureOnboardingInput = z.infer<typeof configureOnboardingSchema>;

/** Form-level variant of the schema above — HTML number inputs round-trip through `value: string`,
 * so `capacity` stays a string in the form and is parsed to a number only when submitting
 * (`configure-step.tsx#onSubmit`), keeping `ConfigureOnboardingInput` itself faithful to the real
 * `POST /onboarding/configure` payload shape. */
export const configureOnboardingFormSchema = z.object({
  // `name` deliberately has no `.min(1)` here (unlike the API-facing schema above) — a row left
  // blank by the user is dropped client-side (`configure-step.tsx#onSubmit`) rather than blocking
  // "Continue" with a silent, unsurfaced nested-array validation error.
  sheds: z
    .array(
      z.object({
        name: z.string().trim().max(80),
        capacity: z.string().trim().optional(),
        purpose: z.string().trim().max(20).optional(),
      }),
    )
    .max(10),
  active_sessions: z.array(z.enum(["morning", "noon", "evening", "night"])).min(1, { message: "sessionRequired" }),
  milk_unit: z.enum(["litres", "kg"]),
});
export type ConfigureOnboardingFormInput = z.infer<typeof configureOnboardingFormSchema>;

/** Wizard Step 4 — mirrors the backend's `InviteTeamMemberDto` (RAKHAL-030). Reused here directly
 * (not through a Settings feature import — RFE-045 isn't built yet). */
export const inviteTeamMemberSchema = z.object({
  email: z.string().trim().email(),
  name: z.string().trim().max(100).optional(),
  role: z.enum(["Manager", "Worker"]),
});
export type InviteTeamMemberInput = z.infer<typeof inviteTeamMemberSchema>;
