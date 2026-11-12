/**
 * Reports v2 public surface (RFE-153). UI code outside this feature imports only from here.
 * Pure helpers are safe on the server; hooks and `reportsApi` are client-only (their files carry "use client").
 */
export * from "./types";
export * from "./schemas";
export { reportsApi, reportDownloadPath } from "./api";

export { useReportTemplates } from "./hooks/use-report-templates";
export { useReportsInfinite } from "./hooks/use-reports-infinite";
export { useReport } from "./hooks/use-report";
export { usePreviewReport } from "./hooks/use-preview-report";
export { useCreateReport } from "./hooks/use-create-report";
export { useRetryReport } from "./hooks/use-retry-report";
export { useDeleteReport } from "./hooks/use-delete-report";
export { useDownloadReport } from "./hooks/use-download-report";
export { useReportsAccess, REPORTS_GENERATE_FEATURE, type ReportsAccess } from "./hooks/use-reports-access";

export {
  ReportApiError,
  isReportApiError,
  isReportAccessDenied,
  toReportApiError,
  reportErrorMessageKey,
  reportErrorKeyFor,
  reportErrorCategoryKey,
  REPORT_REASON_KEYS,
} from "./lib/errors";
export {
  metricLabelKey,
  metricDefinitionKey,
  humanizeMetricId,
  resolveMetricLabel,
  resolveMetricDefinition,
  sourceLabelKey,
  resolveSourceLabel,
  resolveBackendKey,
  isReportsKey,
  reportStatusKey,
  reportTypeKey,
  reportOriginKey,
  reportScopeKindKey,
  datePresetKey,
  reportDomainKey,
  type ReportTranslator,
} from "./lib/labels";
export {
  formatMetricValue,
  formatMetricNumber,
  formatPercentChange,
  periodLabel,
  unitLabelKey,
  METRIC_STATE_KEYS,
  NOT_APPLICABLE_DASH,
} from "./lib/format";
export { statusTone, type ReportStatusTone } from "./lib/status";
export { toCreateResult } from "./lib/create-result";
export { nextReportPollInterval, REPORT_POLL_INTERVAL_MS, REPORT_POLL_MAX_MS } from "./lib/polling";
export { isValidYmd, inclusiveDays } from "./lib/ymd";
export {
  REPORT_METRIC_IDS,
  REPORT_EXPENSE_CATEGORIES,
  REPORT_EXCEPTION_CODES,
  REPORT_SOURCES,
  REPORT_UNITS,
  isKnownMetricId,
} from "./lib/metric-ids";
