/** Tunables and stable machine-readable reasons for the Reports API (RPT-08). */

/** Max distinct metric ids one on-demand report may select. */
export const MAX_SELECTED_METRICS = 60;
/** Per-farm cap on reports that are QUEUED or PROCESSING at the same time. */
export const MAX_IN_FLIGHT_REPORTS = 3;
/** How many times one FAILED report may be manually retried (`Report.manualRetries`). */
export const MAX_MANUAL_RETRIES = 3;
/** A QUEUED/PROCESSING row older than this no longer counts toward the in-flight cap (lost job). */
export const STALE_IN_FLIGHT_MINUTES = 15;
/** A COMPLETED identical report younger than this is always a reusable duplicate. */
export const DUPLICATE_FRESH_MINUTES = 10;
/** A PROCESSING row whose `startedAt` is within this lease cannot be deleted. */
export const PROCESSING_LEASE_MINUTES = 10;
/** Concurrent previews allowed per farm / per process. */
export const MAX_PREVIEWS_PER_FARM = 1;
export const MAX_PREVIEWS_GLOBAL = 4;
/** Longest `Idempotency-Key` accepted. */
export const MAX_IDEMPOTENCY_KEY_LENGTH = 128;
/** Longest error message echoed to the client. */
export const MAX_ERROR_MESSAGE_LENGTH = 200;
/** Alias accepted for "the current on-demand template" in `templateId`. */
export const ON_DEMAND_TEMPLATE_ALIAS = 'on-demand';
/** Signed-URL-free storage: the presence-only flag exposed to the client. */
export const PDF_CONTENT_TYPE = 'application/pdf';

/** `details.reason` values (the global filter forwards `details` on 4xx). */
export const ReportApiReason = {
  NO_METRICS: 'REPORT_NO_METRICS',
  TOO_MANY_METRICS: 'REPORT_TOO_MANY_METRICS',
  METRIC_NOT_ALLOWED: 'REPORT_METRIC_NOT_ALLOWED',
  FINANCE_FORBIDDEN: 'REPORT_FINANCE_FORBIDDEN',
  INVALID_TEMPLATE: 'REPORT_INVALID_TEMPLATE',
  INVALID_SCOPE: 'REPORT_INVALID_SCOPE',
  INVALID_PERIOD: 'REPORT_INVALID_PERIOD',
  INVALID_IDEMPOTENCY_KEY: 'REPORT_INVALID_IDEMPOTENCY_KEY',
  IDEMPOTENCY_CONFLICT: 'REPORT_IDEMPOTENCY_CONFLICT',
  TOO_MANY_IN_FLIGHT: 'REPORT_TOO_MANY_IN_FLIGHT',
  PDF_NOT_AVAILABLE: 'REPORT_PDF_NOT_AVAILABLE',
  NOT_RETRYABLE: 'REPORT_NOT_RETRYABLE',
  RETRY_LIMIT: 'REPORT_RETRY_LIMIT',
  OWNER_ONLY: 'REPORT_OWNER_ONLY',
  TEMPLATE_UNAVAILABLE: 'REPORT_TEMPLATE_UNAVAILABLE',
  PROCESSING: 'REPORT_PROCESSING',
  PREVIEW_BUSY: 'REPORT_PREVIEW_BUSY',
  QUEUE_UNAVAILABLE: 'REPORT_QUEUE_UNAVAILABLE',
  STORAGE_UNAVAILABLE: 'REPORT_STORAGE_UNAVAILABLE',
} as const;
