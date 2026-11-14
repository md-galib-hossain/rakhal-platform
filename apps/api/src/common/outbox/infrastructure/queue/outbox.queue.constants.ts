export const OUTBOX_QUEUE = 'outbox-queue';
export const OUTBOX_DRAIN_JOB = 'drain-outbox';
/** One-off drain queued right after an outbox row is written (see `OutboxWriterService`). */
export const OUTBOX_NUDGE_JOB = 'drain-outbox-nudge';
/** Delay before the nudge runs, so the writer's own transaction has committed first. */
export const OUTBOX_NUDGE_DELAY_MS = 2_000;
/**
 * Safety-net poll only — rows are normally drained by the nudge above within
 * seconds. Kept well over Neon's 5-minute scale-to-zero window so an idle
 * backend lets the database suspend (a 5s poll kept it awake 24/7 and burned
 * the monthly compute allowance). Override with `OUTBOX_DRAIN_INTERVAL_MS`.
 */
export const OUTBOX_DRAIN_INTERVAL_MS =
  Number(process.env.OUTBOX_DRAIN_INTERVAL_MS) || 15 * 60_000;
