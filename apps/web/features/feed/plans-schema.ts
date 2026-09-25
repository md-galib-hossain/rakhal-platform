import { z } from "zod";

/**
 * Feed Plan editor form (MILESTONE 27, RFE-126). Mirrors `CreateFeedPlanDto`: a name, optional notes and 1-30
 * lines — each a bought feed item or a made recipe (concentrate/TMR) with kg per head per day (as-fed).
 * Validation messages are i18n keys under `feed.plans.editor.errors`; the form translates them.
 */
export const feedPlanLineSchema = z.object({
  lineType: z.enum(["FEED_ITEM", "PREPARED"]),
  feedItemId: z.string().optional(),
  concentrationId: z.string().optional(),
  /** Display only — the server resolves names. */
  name: z.string(),
  kgPerDay: z
    .number({ error: "kgRequired" })
    .gt(0, { error: "kgPositive" })
    .max(500, { error: "kgMax" }),
});

export const feedPlanFormSchema = z
  .object({
    name: z.string().trim().min(1, { error: "nameRequired" }).max(80, { error: "nameMax" }),
    notes: z.string().max(1000).optional(),
    targetType: z.enum(["INDIVIDUAL", "GROUP", "HERD"]).optional(),
    cattleId: z.string().optional(),
    groupId: z.string().optional(),
    targetWeightKg: z.number().optional(),
    targetMilkL: z.number().optional(),
    lines: z.array(feedPlanLineSchema).min(1, { error: "linesRequired" }).max(30),
  })
  .superRefine((value, ctx) => {
    const seen = new Set<string>();
    value.lines.forEach((line, index) => {
      const key = line.lineType === "FEED_ITEM" ? `i:${line.feedItemId}` : `c:${line.concentrationId}`;
      if (seen.has(key)) {
        ctx.addIssue({ code: "custom", path: ["lines", index, "kgPerDay"], message: "duplicateLine" });
      }
      seen.add(key);
    });
  });

export type FeedPlanFormInput = z.input<typeof feedPlanFormSchema>;
export type FeedPlanFormValues = z.output<typeof feedPlanFormSchema>;
