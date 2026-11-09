"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SAFE_ERROR_MESSAGE = exports.SNAPSHOT_SCHEMA_VERSION = exports.DEFAULT_REPORT_RETENTION_DAYS = exports.REPORT_RECONCILE_BATCH = exports.REPORT_QUEUED_STALE_MS = exports.REPORT_LEASE_RECHECK_BUFFER_MS = exports.REPORT_STATEMENT_TIMEOUT_MS = exports.REPORT_TX_TIMEOUT_MS = exports.REPORT_TX_MAX_WAIT_MS = exports.REPORT_PROCESSING_LEASE_MS = exports.REPORT_WORKER_CONCURRENCY = exports.REPORT_JOB_BACKOFF_MS = exports.REPORT_JOB_ATTEMPTS = exports.REPORT_GENERATE_JOB = exports.REPORTS_QUEUE = void 0;
exports.REPORTS_QUEUE = 'reports-queue';
exports.REPORT_GENERATE_JOB = 'generate';
exports.REPORT_JOB_ATTEMPTS = 3;
exports.REPORT_JOB_BACKOFF_MS = 5000;
exports.REPORT_WORKER_CONCURRENCY = 2;
exports.REPORT_PROCESSING_LEASE_MS = 10 * 60 * 1000;
exports.REPORT_TX_MAX_WAIT_MS = 5_000;
exports.REPORT_TX_TIMEOUT_MS = 60_000;
exports.REPORT_STATEMENT_TIMEOUT_MS = 20_000;
exports.REPORT_LEASE_RECHECK_BUFFER_MS = 1_000;
exports.REPORT_QUEUED_STALE_MS = 10 * 60 * 1000;
exports.REPORT_RECONCILE_BATCH = 200;
exports.DEFAULT_REPORT_RETENTION_DAYS = 365;
exports.SNAPSHOT_SCHEMA_VERSION = 1;
exports.SAFE_ERROR_MESSAGE = {
    STORAGE_UNAVAILABLE: 'File storage is temporarily unavailable.',
    DB_TIMEOUT: 'The database was too busy to build this report.',
    QUEUE_UNAVAILABLE: 'The report queue is temporarily unavailable.',
    INVALID_CONFIG: 'The report configuration is no longer valid.',
    PLAN_LIMIT: 'The current plan does not allow this report.',
    PERMISSION_DENIED: 'The report cannot include the requested data.',
    RENDER_FAILED: 'The report could not be rendered.',
    GENERATION_FAILED: 'The report could not be generated.',
};
//# sourceMappingURL=report-pipeline.constants.js.map