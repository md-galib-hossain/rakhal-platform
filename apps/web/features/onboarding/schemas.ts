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
