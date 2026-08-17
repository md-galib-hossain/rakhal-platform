export const OUTBOX_QUEUE = 'outbox-queue';
export const OUTBOX_DRAIN_JOB = 'drain-outbox';
/** How often the repeatable drain job fires. Kept short — a drain pass is cheap (bounded batch, indexed query). */
export const OUTBOX_DRAIN_INTERVAL_MS = 5_000;
