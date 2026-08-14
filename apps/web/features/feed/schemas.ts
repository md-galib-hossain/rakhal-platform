import { z } from "zod";

/**
 * "Create New Feed Formulator" wizard — Figma Step 1 "Estimated Daily Requirements of Cow Group"
 * (`1065:35227`) + Step 2 ingredient table / Feed Mixture (`1065:35817`), file
 * `SCfMPdxP6vgW1uTxfqCtz7`. One flat schema for both steps (`trigger()` a step's fields before
 * advancing) — same shape as `finance/schemas.ts#recordTransactionFormSchema`.
 *
 * Mirrors `CreateConcentrationDto`: `targetType` picks Cow Group vs Individual Cow (Figma's
 * "Tabular Option" tab-pill, `1065:35268`), `feedGroupId`/`cattleId` are mutually required by which
 * tab is active.
 *
 * As of 2026-07-18, `kind` splits this into two genuinely different required-field shapes (see
 * `types.ts`'s doc comment on `FeedConcentrationKind` for why): a `CONCENTRATE_TEMPLATE` needs only
 * `name`/`items` — no target fields are shown or required for it, on purpose, since making them
 * required unconditionally for *every* concentration was the exact bug behind "why does creating a
 * concentrate add to my feeds" (every concentration ended up with a target, hence a balance score,
 * hence always bucketed as a mixture). A `FEED_MIXTURE` requires a real cow/group target
 * (`feedGroupId`/`cattleId`) and `durationDays` (Phase 12.2 — a farmer building a real ration always
 * knows how many days it's meant to cover; a template has no such concept).
 *
 * `targetWeightKg`/`targetMilkL` are **deliberately not required** here (Phase 12.3, 2026-07-18
 * follow-up, reversing the previous unconditional-required rule) — once a real cow/group target is
 * picked, the backend already resolves them from that target's own weight/milk records (same
 * derivation `GET /feed/requirements` uses for the live "Estimated Daily Requirements" preview), so
 * forcing manual entry on top would just be busywork most of the time. They stay in the schema as
 * plain optional numeric fields — a farmer can still type an override, and the backend falls back to
 * it when the target's own records are incomplete.
 */
/** `HERD` added 2026-08-13 (user request — "herd default -> group -> individual override, most
 * specific wins"): requires neither `feedGroupId` nor `cattleId`, so it deliberately isn't named
 * in either `.refine()` below — those only fire when `targetType` is GROUP/INDIVIDUAL. */
export const feedTargetTypes = ["GROUP", "INDIVIDUAL", "HERD"] as const;
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
  .refine((v) => v.kind !== "FEED_MIXTURE" || (v.durationDays != null && v.durationDays >= 1), {
    message: "Duration is required for a Total Mixed Ration",
    path: ["durationDays"],
  });

export type CreateFeedFormInput = z.infer<typeof createFeedFormSchema>;
export type CreateFeedFormItem = z.infer<typeof createFeedConcentrationItemSchema>;

/** "Feed Today" (Phase 12.4, 2026-07-18) — logs an actual feeding against a TMR's own target
 * (group or one cow, derived server-side from `concentrationId`). Mirrors `LogDistributionDto`:
 * every field but `concentrationId` is optional, since a farmer confirming exactly the planned
 * amounts needs to enter nothing at all beyond opening the dialog. */
export const logDistributionItemSchema = z.object({
  ingredientId: z.string().min(1),
  ingredientName: z.string(),
  plannedKg: z.number(),
  actualKg: z.number().min(0),
  refusalKg: z.number().min(0).optional(),
});

export const logDistributionFormSchema = z.object({
  concentrationId: z.string().min(1),
  distributedAt: z.string().optional(),
  notes: z.string().trim().optional(),
  items: z.array(logDistributionItemSchema),
});

export type LogDistributionFormInput = z.infer<typeof logDistributionFormSchema>;
export type LogDistributionFormItem = z.infer<typeof logDistributionItemSchema>;
