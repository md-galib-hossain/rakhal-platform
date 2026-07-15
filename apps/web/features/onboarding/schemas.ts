import { z } from "zod";

/** Mirrors the backend's CreateFarmDto (`src/modules/farm/presentation/dto/create-farm.dto.ts`). */
export const createFarmSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
});
export type CreateFarmInput = z.infer<typeof createFarmSchema>;
