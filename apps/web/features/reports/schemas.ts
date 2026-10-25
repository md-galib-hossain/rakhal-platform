import { z } from "zod";
import {
  DATE_PRESETS,
  MAX_CUSTOM_RANGE_DAYS,
  MAX_RAW_METRIC_IDS,
  MAX_SELECTED_METRICS,
  ON_DEMAND_TEMPLATE_ALIAS,
  REPORT_ORIGINS,
  REPORT_SCOPE_KINDS,
  REPORT_STATUSES,
  REPORT_TYPES,
  type CreateReportRequest,
  type PreviewReportRequest,
  type ReportScopeInput,
} from "./types";
import { inclusiveDays, isValidYmd } from "./lib/ymd";

/**
 * Mirrors the backend `PreviewReportDto`/`CreateReportDto`/`ListReportsQueryDto`
 * (`presentation/dto/reports.dto.ts`) plus the service's real rules (dedupe, 60-metric cap,
 * <=366-day custom range). Every `message` is an i18n key under the root translator
 * (`t("reports.validation.…")`) — never a literal.
 */
export const REPORT_VALIDATION_KEYS = {
  noMetrics: "reports.validation.noMetrics",
  tooManyMetrics: "reports.validation.tooManyMetrics",
  invalidDate: "reports.validation.invalidDate",
  customDatesRequired: "reports.validation.customDatesRequired",
  customDatesNotAllowed: "reports.validation.customDatesNotAllowed",
  rangeInverted: "reports.validation.rangeInverted",
  rangeTooLong: "reports.validation.rangeTooLong",
  cattleRequired: "reports.validation.cattleRequired",
  groupRequired: "reports.validation.groupRequired",
  scopeExtraId: "reports.validation.scopeExtraId",
  templateRequired: "reports.validation.templateRequired",
} as const;
const K = REPORT_VALIDATION_KEYS;

export const ymdSchema = z.string().refine(isValidYmd, { message: K.invalidDate });

/** Trim, drop empties, dedupe preserving first-seen order. */
export function dedupeMetricIds(ids: readonly string[]): string[] {
  return [...new Set(ids.map((id) => id.trim()).filter((id) => id.length > 0))];
}

export const datePresetSchema = z.enum(DATE_PRESETS);
export const reportScopeKindSchema = z.enum(REPORT_SCOPE_KINDS);

export const reportPeriodInputSchema = z
  .object({
    preset: datePresetSchema,
    customStartDate: z.string().optional(),
    customEndDate: z.string().optional(),
  })
  .superRefine((p, ctx) => {
    if (p.preset !== "custom") {
      if (p.customStartDate || p.customEndDate) {
        ctx.addIssue({ code: "custom", message: K.customDatesNotAllowed, path: ["preset"] });
      }
      return;
    }
    let ok = true;
    if (!p.customStartDate) {
      ctx.addIssue({ code: "custom", message: K.customDatesRequired, path: ["customStartDate"] });
      ok = false;
    } else if (!isValidYmd(p.customStartDate)) {
      ctx.addIssue({ code: "custom", message: K.invalidDate, path: ["customStartDate"] });
      ok = false;
    }
    if (!p.customEndDate) {
      ctx.addIssue({ code: "custom", message: K.customDatesRequired, path: ["customEndDate"] });
      ok = false;
    } else if (!isValidYmd(p.customEndDate)) {
      ctx.addIssue({ code: "custom", message: K.invalidDate, path: ["customEndDate"] });
      ok = false;
    }
    if (!ok || !p.customStartDate || !p.customEndDate) return;
    if (p.customStartDate > p.customEndDate) {
      ctx.addIssue({ code: "custom", message: K.rangeInverted, path: ["customEndDate"] });
    } else if (inclusiveDays(p.customStartDate, p.customEndDate) > MAX_CUSTOM_RANGE_DAYS) {
      ctx.addIssue({ code: "custom", message: K.rangeTooLong, path: ["customEndDate"] });
    }
  });

const idString = z.string().min(1).max(64);

export const reportScopeInputSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("ALL_ELIGIBLE") }).strict(),
  z.object({ kind: z.literal("SINGLE_COW"), cattleId: idString }),
  z.object({ kind: z.literal("GROUP"), groupId: idString }),
]);

/** Dedupes first, then enforces 1..60 (the backend's real cap; raw payload bound is 200). */
export const selectedMetricIdsSchema = z
  .array(z.string().max(100))
  .max(MAX_RAW_METRIC_IDS, { message: K.tooManyMetrics })
  .transform(dedupeMetricIds)
  .pipe(
    z
      .array(z.string().min(1).max(100))
      .min(1, { message: K.noMetrics })
      .max(MAX_SELECTED_METRICS, { message: K.tooManyMetrics }),
  );

export const previewReportSchema = z.object({
  templateId: z.string().min(1, { message: K.templateRequired }).max(64),
  period: reportPeriodInputSchema,
  scope: reportScopeInputSchema,
  selectedMetricIds: selectedMetricIdsSchema,
  compare: z.boolean().optional(),
});

export const createReportSchema = previewReportSchema.extend({
  forceNew: z.boolean().optional(),
});

/** Validated request, ready for the API (deduped ids). */
export type PreviewReportParsed = z.output<typeof previewReportSchema>;
export type CreateReportParsed = z.output<typeof createReportSchema>;

/** Filters for `GET /reports`. Unknown values fail fast instead of producing a 400. */
export const reportListFiltersSchema = z.object({
  type: z.enum(REPORT_TYPES).optional(),
  origin: z.enum(REPORT_ORIGINS).optional(),
  status: z.enum(REPORT_STATUSES).optional(),
});

/* ------------------------------------------------------------ wizard form */

/**
 * Flat, transform-free shape for react-hook-form (input type === output type, so `zodResolver`
 * generics stay simple). Convert with {@link wizardFormToRequest}.
 */
export const reportWizardFormSchema = z
  .object({
    templateId: z.string(),
    preset: datePresetSchema,
    customStartDate: z.string().optional(),
    customEndDate: z.string().optional(),
    scopeKind: reportScopeKindSchema,
    cattleId: z.string().optional(),
    groupId: z.string().optional(),
    selectedMetricIds: z.array(z.string()),
    compare: z.boolean(),
    forceNew: z.boolean(),
  })
  .superRefine((v, ctx) => {
    const ids = dedupeMetricIds(v.selectedMetricIds);
    if (ids.length === 0) ctx.addIssue({ code: "custom", message: K.noMetrics, path: ["selectedMetricIds"] });
    else if (ids.length > MAX_SELECTED_METRICS) {
      ctx.addIssue({ code: "custom", message: K.tooManyMetrics, path: ["selectedMetricIds"] });
    }
    const period = reportPeriodInputSchema.safeParse({
      preset: v.preset,
      customStartDate: v.customStartDate || undefined,
      customEndDate: v.customEndDate || undefined,
    });
    if (!period.success) {
      for (const issue of period.error.issues) {
        ctx.addIssue({ code: "custom", message: issue.message, path: issue.path.length ? issue.path : ["preset"] });
      }
    }
    if (v.scopeKind === "SINGLE_COW") {
      if (!v.cattleId) ctx.addIssue({ code: "custom", message: K.cattleRequired, path: ["cattleId"] });
      if (v.groupId) ctx.addIssue({ code: "custom", message: K.scopeExtraId, path: ["groupId"] });
    } else if (v.scopeKind === "GROUP") {
      if (!v.groupId) ctx.addIssue({ code: "custom", message: K.groupRequired, path: ["groupId"] });
      if (v.cattleId) ctx.addIssue({ code: "custom", message: K.scopeExtraId, path: ["cattleId"] });
    } else if (v.cattleId || v.groupId) {
      ctx.addIssue({ code: "custom", message: K.scopeExtraId, path: ["scopeKind"] });
    }
  });
export type ReportWizardFormValues = z.infer<typeof reportWizardFormSchema>;

export const reportWizardDefaults: ReportWizardFormValues = {
  templateId: ON_DEMAND_TEMPLATE_ALIAS,
  preset: "this_month",
  customStartDate: undefined,
  customEndDate: undefined,
  scopeKind: "ALL_ELIGIBLE",
  cattleId: undefined,
  groupId: undefined,
  selectedMetricIds: [],
  compare: true,
  forceNew: false,
};

function scopeFromForm(v: ReportWizardFormValues): ReportScopeInput {
  if (v.scopeKind === "SINGLE_COW") return { kind: "SINGLE_COW", cattleId: v.cattleId ?? "" };
  if (v.scopeKind === "GROUP") return { kind: "GROUP", groupId: v.groupId ?? "" };
  return { kind: "ALL_ELIGIBLE" };
}

/** Maps validated wizard values to the preview payload (deduped ids, no empty strings, no stray custom dates). */
export function wizardFormToPreviewRequest(v: ReportWizardFormValues): PreviewReportRequest {
  return {
    templateId: v.templateId || ON_DEMAND_TEMPLATE_ALIAS,
    period:
      v.preset === "custom"
        ? { preset: "custom", customStartDate: v.customStartDate, customEndDate: v.customEndDate }
        : { preset: v.preset },
    scope: scopeFromForm(v),
    selectedMetricIds: dedupeMetricIds(v.selectedMetricIds),
    compare: v.compare,
  };
}

export function wizardFormToRequest(v: ReportWizardFormValues): CreateReportRequest {
  return { ...wizardFormToPreviewRequest(v), forceNew: v.forceNew || undefined };
}
