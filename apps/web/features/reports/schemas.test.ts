import { describe, expect, it } from "vitest";
import {
  createReportSchema,
  dedupeMetricIds,
  previewReportSchema,
  reportListFiltersSchema,
  reportPeriodInputSchema,
  reportScopeInputSchema,
  reportWizardDefaults,
  reportWizardFormSchema,
  REPORT_VALIDATION_KEYS,
  wizardFormToRequest,
} from "./schemas";
import { inclusiveDays, isValidYmd } from "./lib/ymd";

const base = {
  templateId: "on-demand",
  period: { preset: "this_month" as const },
  scope: { kind: "ALL_ELIGIBLE" as const },
  selectedMetricIds: ["milk.total_yield"],
};

const messages = (r: { success: boolean; error?: { issues: { message: string }[] } }) =>
  r.success ? [] : r.error!.issues.map((i) => i.message);

describe("isValidYmd / inclusiveDays", () => {
  it("rejects impossible calendar dates", () => {
    expect(isValidYmd("2026-02-31")).toBe(false);
    expect(isValidYmd("2026-13-01")).toBe(false);
    expect(isValidYmd("2026-00-10")).toBe(false);
    expect(isValidYmd("2026-04-31")).toBe(false);
    expect(isValidYmd("2026-2-3")).toBe(false);
    expect(isValidYmd("not-a-date")).toBe(false);
  });
  it("accepts real dates incl. leap day", () => {
    expect(isValidYmd("2028-02-29")).toBe(true);
    expect(isValidYmd("2026-02-28")).toBe(true);
    expect(isValidYmd("2026-02-29")).toBe(false);
  });
  it("counts days inclusively", () => {
    expect(inclusiveDays("2026-01-01", "2026-01-01")).toBe(1);
    expect(inclusiveDays("2026-01-01", "2026-12-31")).toBe(365);
    expect(inclusiveDays("2028-01-01", "2028-12-31")).toBe(366);
    expect(inclusiveDays("2026-02-31", "2026-03-01")).toBeNaN();
  });
});

describe("reportPeriodInputSchema", () => {
  it("accepts presets without dates", () => {
    expect(reportPeriodInputSchema.safeParse({ preset: "today" }).success).toBe(true);
  });
  it("rejects custom dates on a non-custom preset", () => {
    const r = reportPeriodInputSchema.safeParse({ preset: "this_week", customStartDate: "2026-01-01" });
    expect(messages(r)).toContain(REPORT_VALIDATION_KEYS.customDatesNotAllowed);
  });
  it("requires both dates for custom", () => {
    const r = reportPeriodInputSchema.safeParse({ preset: "custom", customStartDate: "2026-01-01" });
    expect(messages(r)).toContain(REPORT_VALIDATION_KEYS.customDatesRequired);
  });
  it("rejects invalid calendar dates like 2026-02-31", () => {
    const r = reportPeriodInputSchema.safeParse({ preset: "custom", customStartDate: "2026-02-31", customEndDate: "2026-03-10" });
    expect(messages(r)).toContain(REPORT_VALIDATION_KEYS.invalidDate);
  });
  it("rejects start after end", () => {
    const r = reportPeriodInputSchema.safeParse({ preset: "custom", customStartDate: "2026-03-10", customEndDate: "2026-03-01" });
    expect(messages(r)).toContain(REPORT_VALIDATION_KEYS.rangeInverted);
  });
  it("allows exactly 366 days and rejects 367", () => {
    expect(
      reportPeriodInputSchema.safeParse({ preset: "custom", customStartDate: "2028-01-01", customEndDate: "2028-12-31" }).success,
    ).toBe(true);
    const r = reportPeriodInputSchema.safeParse({ preset: "custom", customStartDate: "2027-12-31", customEndDate: "2028-12-31" });
    expect(messages(r)).toContain(REPORT_VALIDATION_KEYS.rangeTooLong);
  });
  it("accepts a single-day custom range", () => {
    expect(
      reportPeriodInputSchema.safeParse({ preset: "custom", customStartDate: "2026-05-05", customEndDate: "2026-05-05" }).success,
    ).toBe(true);
  });
  it("rejects an unknown preset", () => {
    expect(reportPeriodInputSchema.safeParse({ preset: "last_week" }).success).toBe(false);
  });
});

describe("reportScopeInputSchema", () => {
  it("requires the matching id", () => {
    expect(reportScopeInputSchema.safeParse({ kind: "SINGLE_COW" }).success).toBe(false);
    expect(reportScopeInputSchema.safeParse({ kind: "GROUP" }).success).toBe(false);
    expect(reportScopeInputSchema.safeParse({ kind: "SINGLE_COW", cattleId: "c1" }).success).toBe(true);
    expect(reportScopeInputSchema.safeParse({ kind: "GROUP", groupId: "g1" }).success).toBe(true);
    expect(reportScopeInputSchema.safeParse({ kind: "ALL_ELIGIBLE" }).success).toBe(true);
  });
  it("rejects ids longer than 64 and extra ids on ALL_ELIGIBLE", () => {
    expect(reportScopeInputSchema.safeParse({ kind: "SINGLE_COW", cattleId: "x".repeat(65) }).success).toBe(false);
    expect(reportScopeInputSchema.safeParse({ kind: "ALL_ELIGIBLE", cattleId: "c1" }).success).toBe(false);
  });
});

describe("selectedMetricIds", () => {
  it("dedupes, trims and keeps first-seen order", () => {
    expect(dedupeMetricIds([" a ", "b", "a", "", "b"])).toEqual(["a", "b"]);
    const r = previewReportSchema.parse({ ...base, selectedMetricIds: ["milk.total_yield", "milk.total_yield", "milk.cows_with_data"] });
    expect(r.selectedMetricIds).toEqual(["milk.total_yield", "milk.cows_with_data"]);
  });
  it("requires at least one", () => {
    expect(messages(previewReportSchema.safeParse({ ...base, selectedMetricIds: [] }))).toContain(REPORT_VALIDATION_KEYS.noMetrics);
    expect(messages(previewReportSchema.safeParse({ ...base, selectedMetricIds: ["", "  "] }))).toContain(
      REPORT_VALIDATION_KEYS.noMetrics,
    );
  });
  it("caps at 60 distinct ids (61 fails, 60 passes, duplicates do not count)", () => {
    const ids = (n: number) => Array.from({ length: n }, (_, i) => `milk.m${i}`);
    expect(previewReportSchema.safeParse({ ...base, selectedMetricIds: ids(60) }).success).toBe(true);
    expect(messages(previewReportSchema.safeParse({ ...base, selectedMetricIds: ids(61) }))).toContain(
      REPORT_VALIDATION_KEYS.tooManyMetrics,
    );
    expect(previewReportSchema.safeParse({ ...base, selectedMetricIds: [...ids(60), ...ids(60)] }).success).toBe(true);
  });
  it("rejects a raw array above the 200 DoS bound", () => {
    const many = Array.from({ length: 201 }, () => "milk.total_yield");
    expect(previewReportSchema.safeParse({ ...base, selectedMetricIds: many }).success).toBe(false);
  });
});

describe("createReportSchema / list filters", () => {
  it("accepts forceNew and rejects a missing template", () => {
    expect(createReportSchema.safeParse({ ...base, forceNew: true }).success).toBe(true);
    expect(messages(createReportSchema.safeParse({ ...base, templateId: "" }))).toContain(REPORT_VALIDATION_KEYS.templateRequired);
  });
  it("list filters accept only backend enum values", () => {
    expect(reportListFiltersSchema.safeParse({ type: "WEEKLY", origin: "SCHEDULED", status: "FAILED" }).success).toBe(true);
    expect(reportListFiltersSchema.safeParse({ status: "DONE" }).success).toBe(false);
  });
});

describe("wizard form", () => {
  const ok = { ...reportWizardDefaults, selectedMetricIds: ["milk.total_yield", "milk.total_yield"] };
  it("accepts defaults plus one metric and builds a deduped request", () => {
    expect(reportWizardFormSchema.safeParse(ok).success).toBe(true);
    const req = wizardFormToRequest(ok);
    expect(req.selectedMetricIds).toEqual(["milk.total_yield"]);
    expect(req.period).toEqual({ preset: "this_month" });
    expect(req.scope).toEqual({ kind: "ALL_ELIGIBLE" });
    expect(req.forceNew).toBeUndefined();
  });
  it("requires a metric, and the id matching the scope kind", () => {
    expect(messages(reportWizardFormSchema.safeParse(reportWizardDefaults))).toContain(REPORT_VALIDATION_KEYS.noMetrics);
    expect(messages(reportWizardFormSchema.safeParse({ ...ok, scopeKind: "SINGLE_COW" }))).toContain(REPORT_VALIDATION_KEYS.cattleRequired);
    expect(messages(reportWizardFormSchema.safeParse({ ...ok, scopeKind: "GROUP" }))).toContain(REPORT_VALIDATION_KEYS.groupRequired);
    expect(messages(reportWizardFormSchema.safeParse({ ...ok, scopeKind: "GROUP", groupId: "g", cattleId: "c" }))).toContain(
      REPORT_VALIDATION_KEYS.scopeExtraId,
    );
  });
  it("validates the custom range and carries the dates only for custom", () => {
    const bad = reportWizardFormSchema.safeParse({ ...ok, preset: "custom", customStartDate: "2026-02-31", customEndDate: "2026-03-01" });
    expect(messages(bad)).toContain(REPORT_VALIDATION_KEYS.invalidDate);
    const good = { ...ok, preset: "custom" as const, customStartDate: "2026-03-01", customEndDate: "2026-03-31", forceNew: true };
    expect(reportWizardFormSchema.safeParse(good).success).toBe(true);
    expect(wizardFormToRequest(good)).toMatchObject({
      period: { preset: "custom", customStartDate: "2026-03-01", customEndDate: "2026-03-31" },
      forceNew: true,
    });
  });
});
