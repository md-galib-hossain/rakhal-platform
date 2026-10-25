/** How many most-recent closed periods a sweep may generate (current closed period + the one before). */
export const SCHEDULE_CATCH_UP_PERIODS = 2;

/** Farms loaded per page by the sweep (cursor by id). */
export const SCHEDULE_FARM_BATCH = 100;

/** Soft-deleted reports are kept this long (since `deletedAt`) before the hard delete. */
export const RETENTION_SOFT_DELETE_GRACE_DAYS = 7;
/** FAILED reports older than this are removed like expired ones. */
export const RETENTION_FAILED_AGE_DAYS = 30;
/**
 * A SCHEDULED report row is never hard-deleted until its `periodEnd` is older than this many days, so a
 * deleted / failed / expired scheduled report stays as a tombstone and the sweep cannot recreate it.
 * Arithmetic: the sweep may generate the SCHEDULE_CATCH_UP_PERIODS (2) most recent closed periods. For
 * weekly that is at most ~14 days after the older period's end; for monthly the older of months M-2 / M-1
 * stays in the window until month M closes, i.e. up to 31 + 31 = 62 days after its periodEnd. 62 days plus
 * an 8 day margin (clock skew, delayed sweeps, 31-day months) = 70.
 */
export const SCHEDULE_TOMBSTONE_DAYS = 70;

/** Rows examined per retention batch, and the max batches per run. */
export const RETENTION_BATCH = 200;
export const RETENTION_MAX_BATCHES = 5;

export const DAY_MS = 24 * 60 * 60 * 1000;
export const HOUR_MS = 60 * 60 * 1000;

/** Named crons (listed by GET /admin/crons) and their advisory-lock keys. */
export const REPORT_CRON = {
  SCHEDULE_SWEEP: 'reports-schedule-sweep',
  RECONCILE: 'reports-reconcile',
  RETENTION: 'reports-retention-cleanup',
} as const;
