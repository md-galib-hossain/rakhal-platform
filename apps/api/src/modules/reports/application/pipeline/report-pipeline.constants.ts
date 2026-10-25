import type { ReportErrorCategory } from '../../domain/contracts/enums';

export const REPORTS_QUEUE = 'reports-queue';
export const REPORT_GENERATE_JOB = 'generate';

/** BullMQ retry policy for one report job. */
export const REPORT_JOB_ATTEMPTS = 3;
export const REPORT_JOB_BACKOFF_MS = 5000;
export const REPORT_WORKER_CONCURRENCY = 2;

/** A PROCESSING row older than this is treated as owned by a dead worker and may be re-claimed. */
export const REPORT_PROCESSING_LEASE_MS = 10 * 60 * 1000;

/** Snapshot transaction limits (first RepeatableRead use in the repo). */
export const REPORT_TX_MAX_WAIT_MS = 5_000;
export const REPORT_TX_TIMEOUT_MS = 60_000;
/** Per-statement cap inside the compute transaction (`SET LOCAL statement_timeout`). */
export const REPORT_STATEMENT_TIMEOUT_MS = 20_000;

/** Extra delay added past a live lease before a redelivered job re-checks the row. */
export const REPORT_LEASE_RECHECK_BUFFER_MS = 1_000;
/** A QUEUED row untouched this long with no live queue job is re-enqueued by reconcile. */
export const REPORT_QUEUED_STALE_MS = 10 * 60 * 1000;
export const REPORT_RECONCILE_BATCH = 200;

/** Fallback when the farm has no subscription row (`SubscriptionPlan.reportRetentionDays` default). */
export const DEFAULT_REPORT_RETENTION_DAYS = 365;

export const SNAPSHOT_SCHEMA_VERSION = 1;

/** Short, fixed, non-sensitive text persisted on `Report.errorMessage`. Never raw error text. */
export const SAFE_ERROR_MESSAGE: Readonly<Record<ReportErrorCategory, string>> =
  {
    STORAGE_UNAVAILABLE: 'File storage is temporarily unavailable.',
    DB_TIMEOUT: 'The database was too busy to build this report.',
    QUEUE_UNAVAILABLE: 'The report queue is temporarily unavailable.',
    INVALID_CONFIG: 'The report configuration is no longer valid.',
    PLAN_LIMIT: 'The current plan does not allow this report.',
    PERMISSION_DENIED: 'The report cannot include the requested data.',
    RENDER_FAILED: 'The report could not be rendered.',
    GENERATION_FAILED: 'The report could not be generated.',
  };
