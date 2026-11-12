import { describe, expect, it } from "vitest";
import type { CreateReportRequest, ReportSummary } from "../types";
import { isCreateDuplicate, isTerminalStatus, isValueMetric, isPendingStatus } from "../types";
import { toCreateResult } from "./create-result";
import { fallbackReportFilename, parseContentDispositionFilename } from "./filename";
import { createIdempotencyKeyStore, isValidIdempotencyKey, newIdempotencyKey, requestFingerprint } from "./idempotency";
import { statusTone } from "./status";
import { humanizeMetricId, metricLabelKey, resolveBackendKey, resolveMetricLabel, sourceLabelKey } from "./labels";
import type { ReportTranslator } from "./labels";

const summary = (id: string): ReportSummary => ({
  id,
  type: "ON_DEMAND",
  origin: "ON_DEMAND",
  status: "QUEUED",
  templateVersion: 1,
  period: { startDate: "2026-10-01", endDate: "2026-10-31", timezone: "Asia/Dhaka" },
  scope: { kind: "ALL_ELIGIBLE" },
  selectedMetricIds: ["milk.total_yield"],
  includesFinance: false,
  hasPdf: false,
  pdfBytes: null,
  attempts: 0,
  errorCategory: null,
  errorMessage: null,
  createdAt: "2026-10-24T00:00:00.000Z",
  startedAt: null,
  completedAt: null,
  expiresAt: null,
});

describe("toCreateResult", () => {
  it("maps 201 body to created", () => {
    const r = toCreateResult({ duplicate: false, replayed: false, report: summary("r1") });
    expect(r).toEqual({ kind: "created", report: summary("r1"), replayed: false });
  });
  it("maps an idempotent replay to created with replayed=true", () => {
    const r = toCreateResult({ duplicate: false, replayed: true, report: summary("r1") });
    expect(r.kind).toBe("created");
    expect(r.kind === "created" && r.replayed).toBe(true);
  });
  it("maps the 200 duplicate shape to duplicate", () => {
    const body = { duplicate: true as const, existing: summary("old") };
    expect(isCreateDuplicate(body)).toBe(true);
    expect(toCreateResult(body)).toEqual({ kind: "duplicate", existing: summary("old") });
  });
});

describe("parseContentDispositionFilename", () => {
  const fb = "fallback.pdf";
  it("reads a quoted filename", () => {
    expect(parseContentDispositionFilename('attachment; filename="Rakhal-Report-2026-10.pdf"', fb)).toBe("Rakhal-Report-2026-10.pdf");
  });
  it("reads an unquoted filename", () => {
    expect(parseContentDispositionFilename("attachment; filename=report.pdf", fb)).toBe("report.pdf");
  });
  it("prefers RFC 5987 filename* and decodes it", () => {
    expect(
      parseContentDispositionFilename("attachment; filename=\"x.pdf\"; filename*=UTF-8''%E0%A6%B0%E0%A6%BF%E0%A6%AA%E0%A7%8B%E0%A6%B0%E0%A7%8D%E0%A6%9F.pdf", fb),
    ).toBe("রিপোর্ট.pdf");
  });
  it("falls back when missing, empty or malformed", () => {
    expect(parseContentDispositionFilename(null, fb)).toBe(fb);
    expect(parseContentDispositionFilename("attachment", fb)).toBe(fb);
    expect(parseContentDispositionFilename('attachment; filename=""', fb)).toBe(fb);
    expect(parseContentDispositionFilename("attachment; filename*=UTF-8''%E0%A6", fb)).toBe(fb);
  });
  it("never lets a header name a path", () => {
    expect(parseContentDispositionFilename('attachment; filename="../../etc/passwd"', fb)).toBe("_.._etc_passwd");
    expect(parseContentDispositionFilename('attachment; filename="a\\b.pdf"', fb)).not.toMatch(/[\\/]/);
  });
  it("builds a safe fallback name from the id", () => {
    expect(fallbackReportFilename("abc-123")).toBe("report-abc-123.pdf");
    expect(fallbackReportFilename("a/../b")).toBe("report-a..b.pdf");
  });
});

describe("idempotency key store", () => {
  const req: CreateReportRequest = {
    templateId: "on-demand",
    period: { preset: "this_month" },
    scope: { kind: "ALL_ELIGIBLE" },
    selectedMetricIds: ["b", "a"],
  };
  it("generates backend-valid keys", () => {
    const k = newIdempotencyKey();
    expect(isValidIdempotencyKey(k)).toBe(true);
    expect(k.length).toBeLessThanOrEqual(128);
    expect(isValidIdempotencyKey("")).toBe(false);
    expect(isValidIdempotencyKey("has space")).toBe(false);
    expect(isValidIdempotencyKey("x".repeat(129))).toBe(false);
  });
  it("reuses the key for the identical payload (retry after failure) regardless of id order", () => {
    const store = createIdempotencyKeyStore();
    const a = store.keyFor(req);
    expect(store.keyFor({ ...req, selectedMetricIds: ["a", "b", "a"] })).toBe(a);
  });
  it("issues a new key when the payload changes or after settle()", () => {
    const store = createIdempotencyKeyStore();
    const a = store.keyFor(req);
    expect(store.keyFor({ ...req, forceNew: true })).not.toBe(a);
    const b = store.keyFor(req);
    store.settle();
    expect(store.keyFor(req)).not.toBe(b);
  });
  it("fingerprint ignores id order and duplicates", () => {
    expect(requestFingerprint(req)).toBe(requestFingerprint({ ...req, selectedMetricIds: ["a", "b"] }));
  });
});

describe("status helpers", () => {
  it("terminal vs pending", () => {
    expect(isTerminalStatus("COMPLETED")).toBe(true);
    expect(isTerminalStatus("FAILED")).toBe(true);
    expect(isTerminalStatus("QUEUED")).toBe(false);
    expect(isPendingStatus("PROCESSING")).toBe(true);
    expect(isPendingStatus("COMPLETED")).toBe(false);
  });
  it("badge tones", () => {
    expect(statusTone("QUEUED")).toBe("secondary");
    expect(statusTone("PROCESSING")).toBe("info");
    expect(statusTone("COMPLETED")).toBe("success");
    expect(statusTone("FAILED")).toBe("destructive");
  });
  it("metric type guard narrows only the value state", () => {
    expect(isValueMetric({ state: "value", value: 0, unit: "L" })).toBe(true);
    expect(isValueMetric({ state: "missing", reason: "x" })).toBe(false);
    expect(isValueMetric({ state: "not_applicable" })).toBe(false);
  });
});

describe("label helpers", () => {
  const t = Object.assign((k: string) => `T(${k})`, { has: (k: string) => k === "reports.metrics.milk.total_yield.label" || k === "reports.dq.scope_empty" }) as ReportTranslator;
  it("builds keys for known ids only", () => {
    expect(metricLabelKey("milk.total_yield")).toBe("reports.metrics.milk.total_yield.label");
    expect(metricLabelKey("finance.expenses_by_category.SALARY")).toBe("reports.metrics.finance.expenses_by_category.SALARY.label");
    expect(metricLabelKey("finance.expenses_by_category.NOPE")).toBeNull();
    expect(metricLabelKey("milk.brand_new")).toBeNull();
  });
  it("falls back to a humanized label for unknown ids and missing translations", () => {
    expect(resolveMetricLabel("milk.total_yield", t)).toBe("T(reports.metrics.milk.total_yield.label)");
    expect(resolveMetricLabel("milk.brand_new_thing", t)).toBe("Brand new thing");
    expect(resolveMetricLabel("health.cases_opened", t)).toBe("Cases opened");
    expect(humanizeMetricId("")).toBe("");
  });
  it("resolves backend keys, humanizes unknown keys, passes free text through", () => {
    expect(resolveBackendKey("reports.dq.scope_empty", t)).toBe("T(reports.dq.scope_empty)");
    expect(resolveBackendKey("reports.dq.brand_new_unknown_key", t)).toBe("Brand new unknown key");
    expect(resolveBackendKey("no per-cow feeding rows in period", t)).toBe("no per-cow feeding rows in period");
    expect(resolveBackendKey(null, t)).toBe("");
  });
  it("source keys: known only; offeredMinusRefusal exists", () => {
    expect(sourceLabelKey("offeredMinusRefusal")).toBe("reports.sources.offeredMinusRefusal");
    expect(sourceLabelKey("mystery")).toBeNull();
    expect(sourceLabelKey(null)).toBeNull();
  });
});
