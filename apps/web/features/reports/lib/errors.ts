import { ApiError } from "@/lib/api/errors";
import {
  PERIOD_ERROR_CODES,
  REPORT_ERROR_CATEGORIES,
  isReportApiReason,
  type PeriodErrorCode,
  type ReportApiReasonCode,
  type ReportErrorCategory,
} from "../types";

/**
 * An `ApiError` from a `/reports*` route whose `details.reason` is a known backend reason
 * (`ReportApiReason`). Extends `ApiError`, so any generic handler (`error instanceof ApiError`,
 * `.status`, `.isForbidden`) keeps working. `reason` is null for errors without one (auth, throttle,
 * subscription guard, plain 404).
 */
export class ReportApiError extends ApiError {
  readonly reason: ReportApiReasonCode | null;
  /** Backend `PeriodErrorCode` (only with REPORT_INVALID_PERIOD). */
  readonly periodCode: PeriodErrorCode | null;

  constructor(source: ApiError) {
    super(source.code, source.message, source.status, source.requestId, source.details);
    this.name = "ReportApiError";
    const reason = source.details?.reason;
    this.reason = isReportApiReason(reason) ? reason : null;
    const code = source.details?.code;
    this.periodCode =
      typeof code === "string" && (PERIOD_ERROR_CODES as readonly string[]).includes(code) ? (code as PeriodErrorCode) : null;
  }
}

/** Wraps an `ApiError` as a `ReportApiError`; passes everything else (network errors, aborts) through untouched. */
export function toReportApiError(error: unknown): unknown {
  if (error instanceof ReportApiError) return error;
  if (error instanceof ApiError) return new ReportApiError(error);
  return error;
}

export const isReportApiError = (error: unknown): error is ReportApiError => error instanceof ReportApiError;

/** reason -> i18n key (root translator). `Record<ReportApiReasonCode, …>` makes a missing reason a compile error. */
export const REPORT_REASON_KEYS: Record<ReportApiReasonCode, string> = {
  REPORT_NO_METRICS: "reports.errors.noMetrics",
  REPORT_TOO_MANY_METRICS: "reports.errors.tooManyMetrics",
  REPORT_METRIC_NOT_ALLOWED: "reports.errors.metricNotAllowed",
  REPORT_FINANCE_FORBIDDEN: "reports.errors.financeForbidden",
  REPORT_INVALID_TEMPLATE: "reports.errors.invalidTemplate",
  REPORT_INVALID_SCOPE: "reports.errors.invalidScope",
  REPORT_INVALID_PERIOD: "reports.errors.invalidPeriod",
  REPORT_INVALID_IDEMPOTENCY_KEY: "reports.errors.invalidIdempotencyKey",
  REPORT_IDEMPOTENCY_CONFLICT: "reports.errors.idempotencyConflict",
  REPORT_TOO_MANY_IN_FLIGHT: "reports.errors.tooManyInFlight",
  REPORT_PDF_NOT_AVAILABLE: "reports.errors.pdfNotAvailable",
  REPORT_NOT_RETRYABLE: "reports.errors.notRetryable",
  REPORT_RETRY_LIMIT: "reports.errors.retryLimit",
  REPORT_OWNER_ONLY: "reports.errors.ownerOnly",
  REPORT_TEMPLATE_UNAVAILABLE: "reports.errors.templateUnavailable",
  REPORT_PROCESSING: "reports.errors.processing",
  REPORT_PREVIEW_BUSY: "reports.errors.previewBusy",
  REPORT_QUEUE_UNAVAILABLE: "reports.errors.queueUnavailable",
  REPORT_STORAGE_UNAVAILABLE: "reports.errors.storageUnavailable",
};

export const REPORT_PERIOD_CODE_KEYS: Record<PeriodErrorCode, string> = {
  INVALID_TIMEZONE: "reports.errors.period.invalidTimezone",
  INVALID_DATE: "reports.errors.period.invalidDate",
  INVALID_RANGE: "reports.errors.period.invalidRange",
  RANGE_TOO_LONG: "reports.errors.period.rangeTooLong",
  PERIOD_KIND_MISMATCH: "reports.errors.period.kindMismatch",
  INVALID_PRESET: "reports.errors.period.invalidPreset",
};

export const REPORT_GENERIC_ERROR_KEY = "reports.errors.generic";
export const REPORT_FORBIDDEN_ERROR_KEY = "reports.errors.forbidden";
export const REPORT_NOT_FOUND_ERROR_KEY = "reports.errors.notFound";
export const REPORT_RATE_LIMITED_ERROR_KEY = "reports.errors.rateLimited";
export const REPORT_NETWORK_ERROR_KEY = "reports.errors.network";

/** i18n key for a backend `details.reason`. Unknown/absent reasons map to the generic message. */
export function reportErrorMessageKey(reason: string | null | undefined): string {
  return isReportApiReason(reason) ? REPORT_REASON_KEYS[reason] : REPORT_GENERIC_ERROR_KEY;
}

/**
 * Best i18n key for any thrown value: reason (and period code) first, then HTTP status, then generic.
 * Never returns raw backend text, so the UI always speaks the active locale.
 */
export function reportErrorKeyFor(error: unknown): string {
  const e = toReportApiError(error);
  if (e instanceof ReportApiError) {
    if (e.reason === "REPORT_INVALID_PERIOD" && e.periodCode) return REPORT_PERIOD_CODE_KEYS[e.periodCode];
    if (e.reason) return REPORT_REASON_KEYS[e.reason];
    if (e.status === 404) return REPORT_NOT_FOUND_ERROR_KEY;
    // No reason on a 403 = permission or plan guard (the plan guard has no reason code).
    if (e.status === 403) return REPORT_FORBIDDEN_ERROR_KEY;
    if (e.status === 429) return REPORT_RATE_LIMITED_ERROR_KEY;
    return REPORT_GENERIC_ERROR_KEY;
  }
  if (e instanceof Error && e.name === "NetworkError") return REPORT_NETWORK_ERROR_KEY;
  return REPORT_GENERIC_ERROR_KEY;
}

/** True when the failure is a plan/permission block rather than a request problem (UI shows an upgrade/permission state). */
export function isReportAccessDenied(error: unknown): boolean {
  const e = toReportApiError(error);
  return e instanceof ReportApiError && e.status === 403 && e.reason === null;
}

/** Failed-report `errorCategory` -> i18n key. */
export function reportErrorCategoryKey(category: ReportErrorCategory | null | undefined): string {
  return category && (REPORT_ERROR_CATEGORIES as readonly string[]).includes(category)
    ? `reports.errorCategory.${category}`
    : "reports.errorCategory.GENERATION_FAILED";
}
