import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/errors";
import { PERIOD_ERROR_CODES, REPORT_API_REASONS, REPORT_ERROR_CATEGORIES } from "../types";
import {
  isReportAccessDenied,
  ReportApiError,
  REPORT_PERIOD_CODE_KEYS,
  REPORT_REASON_KEYS,
  reportErrorCategoryKey,
  reportErrorKeyFor,
  reportErrorMessageKey,
  toReportApiError,
} from "./errors";

const apiError = (status: number, details?: Record<string, unknown>) => new ApiError("X", "msg", status, "req-1", details);

describe("reason mapping", () => {
  it("maps every known reason to a distinct, non-generic i18n key", () => {
    const keys = new Set<string>();
    for (const reason of REPORT_API_REASONS) {
      const key = reportErrorMessageKey(reason);
      expect(key).toMatch(/^reports\.errors\./);
      expect(key).not.toBe("reports.errors.generic");
      keys.add(key);
    }
    expect(keys.size).toBe(REPORT_API_REASONS.length);
    expect(Object.keys(REPORT_REASON_KEYS).sort()).toEqual([...REPORT_API_REASONS].sort());
  });
  it("falls back to the generic key for unknown or missing reasons", () => {
    expect(reportErrorMessageKey("SOMETHING_NEW")).toBe("reports.errors.generic");
    expect(reportErrorMessageKey(undefined)).toBe("reports.errors.generic");
    expect(reportErrorMessageKey(null)).toBe("reports.errors.generic");
  });
  it("covers every period error code and error category", () => {
    for (const code of PERIOD_ERROR_CODES) expect(REPORT_PERIOD_CODE_KEYS[code]).toMatch(/^reports\.errors\.period\./);
    for (const c of REPORT_ERROR_CATEGORIES) expect(reportErrorCategoryKey(c)).toBe(`reports.errorCategory.${c}`);
    expect(reportErrorCategoryKey(null)).toBe("reports.errorCategory.GENERATION_FAILED");
  });

  // Exhaustiveness against the REAL backend constants (sibling repo). Skipped, not failed, when the repo is not checked out.
  const backendFile = path.resolve(
    __dirname,
    "../../../../rakhal-backend/src/modules/reports/application/api/reports-api.constants.ts",
  );
  it.skipIf(!existsSync(backendFile))("matches the backend ReportApiReason list exactly", () => {
    const src = readFileSync(backendFile, "utf8");
    const block = /export const ReportApiReason = \{([\s\S]*?)\} as const;/.exec(src);
    expect(block).not.toBeNull();
    const backend = [...block![1].matchAll(/'(REPORT_[A-Z_]+)'/g)].map((m) => m[1]).sort();
    expect(backend.length).toBeGreaterThan(10);
    expect([...REPORT_API_REASONS].sort()).toEqual(backend);
  });
});

describe("ReportApiError", () => {
  it("wraps an ApiError, keeps ApiError semantics and exposes a typed reason", () => {
    const e = toReportApiError(apiError(409, { reason: "REPORT_PROCESSING" }));
    expect(e).toBeInstanceOf(ReportApiError);
    expect(e).toBeInstanceOf(ApiError);
    expect((e as ReportApiError).reason).toBe("REPORT_PROCESSING");
    expect((e as ReportApiError).status).toBe(409);
    expect((e as ReportApiError).requestId).toBe("req-1");
  });
  it("ignores unknown reasons and passes non-API errors through", () => {
    expect((toReportApiError(apiError(400, { reason: "NOPE" })) as ReportApiError).reason).toBeNull();
    const plain = new Error("boom");
    expect(toReportApiError(plain)).toBe(plain);
  });
  it("is idempotent", () => {
    const once = toReportApiError(apiError(400, { reason: "REPORT_NO_METRICS" }));
    expect(toReportApiError(once)).toBe(once);
  });
});

describe("reportErrorKeyFor", () => {
  it("prefers the specific period code, then the reason", () => {
    expect(reportErrorKeyFor(apiError(400, { reason: "REPORT_INVALID_PERIOD", code: "RANGE_TOO_LONG" }))).toBe(
      "reports.errors.period.rangeTooLong",
    );
    expect(reportErrorKeyFor(apiError(400, { reason: "REPORT_INVALID_PERIOD" }))).toBe("reports.errors.invalidPeriod");
    expect(reportErrorKeyFor(apiError(403, { reason: "REPORT_FINANCE_FORBIDDEN" }))).toBe("reports.errors.financeForbidden");
  });
  it("falls back by HTTP status when there is no reason", () => {
    expect(reportErrorKeyFor(apiError(403))).toBe("reports.errors.forbidden");
    expect(reportErrorKeyFor(apiError(404))).toBe("reports.errors.notFound");
    expect(reportErrorKeyFor(apiError(429))).toBe("reports.errors.rateLimited");
    expect(reportErrorKeyFor(apiError(500))).toBe("reports.errors.generic");
    expect(reportErrorKeyFor("weird")).toBe("reports.errors.generic");
  });
  it("recognises network failures", () => {
    const net = new Error("Network request failed");
    net.name = "NetworkError";
    expect(reportErrorKeyFor(net)).toBe("reports.errors.network");
  });
  it("flags a reason-less 403 as plan/permission denial only", () => {
    expect(isReportAccessDenied(apiError(403))).toBe(true);
    expect(isReportAccessDenied(apiError(403, { reason: "REPORT_OWNER_ONLY" }))).toBe(false);
    expect(isReportAccessDenied(apiError(404))).toBe(false);
  });
});
