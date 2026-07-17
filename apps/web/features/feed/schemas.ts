import { z } from "zod";

/**
 * "Create New Feed Formulator" wizard — Figma Step 1 "Estimated Daily Requirements of Cow Group"
 * (`1065:35227`) + Step 2 ingredient table / Feed Mixture (`1065:35817`), file
 * `SCfMPdxP6vgW1uTxfqCtz7`. One flat schema for both steps (`trigger()` a step's fields before
 * advancing) — same shape as `finance/schemas.ts#recordTransactionFormSchema`.
 *
 * Mirrors `CreateConcentrationDto`: `targetType` picks Cow Group vs Individual Cow (Figma's
 * "Tabular Option" tab-pill, `1065:35268`), `feedGroupId`/`cattleId` are mutually required by which
 * tab is active. `targetWeightKg`/`targetMilkL` are required here (unlike the DTO, where they're
 * optional) because Figma's Step 1 always shows Avg. Weight/Avg. Milk Target as required inputs and
 * the "Estimated Daily Requirements" box needs both to call `GET /feed/requirements`.
 *
 * As of 2026-07-18, `kind` splits this into two genuinely different required-field shapes (see
 * `types.ts`'s doc comment on `FeedConcentrationKind` for why): a `CONCENTRATE_TEMPLATE` needs only
 * `name`/`durationDays`/`items` — no target fields are shown or required for it, on purpose, since
 * making them required unconditionally for *every* concentration was the exact bug behind "why does
 * creating a concentrate add to my feeds" (every concentration ended up with a target, hence a
 * balance score, hence always bucketed as a mixture). A `FEED_MIXTURE` keeps every field this schema
 * required before.
 */
export const feedTargetTypes = ["GROUP", "INDIVIDUAL"] as const;
export const feedConcentrationKinds = ["CONCENTRATE_TEMPLATE", "FEED_MIXTURE"] as const;

export const createFeedConcentrationItemSchema = z.object({
  ingredientId: z.string().min(1),
  ingredientName: z.string(),
  amountKg: z.number().min(0),
});

export const createFeedFormSchema = z
  .object({
    kind: z.enum(feedConcentrationKinds),
    name: z.string().trim().min(1),
    durationDays: z.number().int().min(1).optional(),
    targetType: z.enum(feedTargetTypes),
    feedGroupId: z.string().optional(),
    cattleId: z.string().optional(),
    targetWeightKg: z.number().min(1).max(2000).optional(),
    targetMilkL: z.number().min(0).max(100).optional(),
    items: z.array(createFeedConcentrationItemSchema),
  })
  .refine((v) => v.kind !== "FEED_MIXTURE" || v.targetType !== "GROUP" || Boolean(v.feedGroupId), {
    message: "A cow group must be selected",
    path: ["feedGroupId"],
  })
  .refine((v) => v.kind !== "FEED_MIXTURE" || v.targetType !== "INDIVIDUAL" || Boolean(v.cattleId), {
    message: "An animal must be selected",
    path: ["cattleId"],
  })
  .refine((v) => v.kind !== "FEED_MIXTURE" || v.targetWeightKg != null, {
    message: "Average weight is required",
    path: ["targetWeightKg"],
  })
  .refine((v) => v.kind !== "FEED_MIXTURE" || v.targetMilkL != null, {
    message: "Average milk target is required",
    path: ["targetMilkL"],
  });

export type CreateFeedFormInput = z.infer<typeof createFeedFormSchema>;
export type CreateFeedFormItem = z.infer<typeof createFeedConcentrationItemSchema>;
