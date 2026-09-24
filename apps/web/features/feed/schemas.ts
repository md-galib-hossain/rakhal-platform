import { z } from "zod";
import type { EffectiveIngredientNutrition } from "./lib/formula-math";

/**
 * "Create New Feed Formulator" wizard — Figma Step 1 "Estimated Daily Requirements of Cow Group"
 * (`1065:35227`) + Step 2 ingredient table / Feed Mixture (`1065:35817`), file
 * `SCfMPdxP6vgW1uTxfqCtz7`. One flat schema for both steps (`trigger()` a step's fields before
 * advancing) — same shape as `finance/schemas.ts#recordTransactionFormSchema`.
 *
 * Mirrors `CreateConcentrationDto`: `targetType` picks Whole Herd vs Individual Cow (Figma's
 * "Tabular Option" tab-pill, `1065:35268`); `cattleId` is required for the Individual Cow tab.
 *
 * As of 2026-07-18, `kind` splits this into two genuinely different required-field shapes (see
 * `types.ts`'s doc comment on `FeedConcentrationKind` for why): a `CONCENTRATE_TEMPLATE` needs only
 * `name`/`items` — no target fields are shown or required for it, on purpose, since making them
 * required unconditionally for *every* concentration was the exact bug behind "why does creating a
 * concentrate add to my feeds" (every concentration ended up with a target, hence a balance score,
 * hence always bucketed as a mixture). A `FEED_MIXTURE` requires a real target (whole herd, or
 * `cattleId`).
 *
 * `targetWeightKg`/`targetMilkL` are **deliberately not required** here (Phase 12.3, 2026-07-18
 * follow-up, reversing the previous unconditional-required rule) — once a real cow target is
 * picked, the backend already resolves them from that target's own weight/milk records (same
 * derivation `GET /feed/requirements` uses for the live "Estimated Daily Requirements" preview), so
 * forcing manual entry on top would just be busywork most of the time. They stay in the schema as
 * plain optional numeric fields — a farmer can still type an override, and the backend falls back to
 * it when the target's own records are incomplete.
 */
/** `HERD` ("herd default -> individual override, most specific wins") requires no `cattleId`, so
 * it deliberately isn't named in the `.refine()` below — that only fires when `targetType` is
 * INDIVIDUAL. */
export const feedTargetTypes = ["INDIVIDUAL", "HERD"] as const;
export const feedConcentrationKinds = ["CONCENTRATE_TEMPLATE", "FEED_MIXTURE"] as const;

export const createFeedConcentrationItemSchema = z.object({
  /** Optional since RAKHAL-447: a line may name only an inventory product (`feedItemId`), whose lot
   * carries its own nutrition. Identify a line with `formLineKey`, never by this field alone. */
  ingredientId: z.string().optional(),
  ingredientName: z.string(),
  amountKg: z.number().min(0),
  /** RAKHAL-447 — pin the line to one lot of `feedItemId`; absent = the FIFO head at the time of use. */
  feedItemBatchId: z.string().optional(),
  /** Client-only preview of the linked lot's nutrition + price (never sent): drives the live totals for a
   * lot-backed line, which the catalogue map can't supply. */
  lotEffective: z.custom<EffectiveIngredientNutrition>().optional(),
  /** RAKHAL-422 — optional link to a specific inventory batch. At most one is ever set; the
   * `BatchLinkPicker` UI enforces this by construction (a single-select control), so no `.refine`
   * is added here — the backend validates the pair authoritatively regardless. */
  feedItemId: z.string().optional(),
  feedStockId: z.string().optional(),
  availableStockKg: z.number().optional(),
});

export const createFeedFormSchema = z
  .object({
    kind: z.enum(feedConcentrationKinds),
    name: z.string().trim().min(1),
    durationDays: z.number().int().min(1).optional(),
    targetType: z.enum(feedTargetTypes),
    cattleId: z.string().optional(),
    targetWeightKg: z.number().min(1).max(2000).optional(),
    targetMilkL: z.number().min(0).max(100).optional(),
    items: z.array(createFeedConcentrationItemSchema),
  })
  .refine((v) => v.kind !== "FEED_MIXTURE" || v.targetType !== "INDIVIDUAL" || Boolean(v.cattleId), {
    message: "An animal must be selected",
    path: ["cattleId"],
  });

export type CreateFeedFormInput = z.infer<typeof createFeedFormSchema>;
export type CreateFeedFormItem = z.infer<typeof createFeedConcentrationItemSchema>;

/** "Feed Today" (Phase 12.4, 2026-07-18) — logs an actual feeding against a TMR's own target
 * (one cow or the herd, derived server-side from `concentrationId`). Mirrors `LogDistributionDto`:
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
