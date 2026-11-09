/**
 * Notifications v2 queue seam (RAKHAL-493, docs/EPIC_NOTIFICATIONS_V2.md §3.3). The scheduler talks to this port only;
 * production binds the BullMQ adapter, specs and e2e bind `InMemoryScheduleQueue`. Job id == occurrence id, so every
 * method is idempotent by construction.
 */
export const SCHEDULE_QUEUE_PORT = Symbol('SCHEDULE_QUEUE_PORT');

/** BullMQ queue name (registered next to `OUTBOX_QUEUE`). */
export const NOTIFICATION_OCCURRENCE_QUEUE = 'notification-occurrence';
export const NOTIFICATION_FIRE_JOB = 'fire';

/** Only occurrences due within this horizon get a Redis job; later ones wait in Postgres (§1 change 3). */
export const ENQUEUE_HORIZON_MS = 48 * 60 * 60 * 1000;

export interface ScheduleQueuePort {
  /** Adds a delayed job for the occurrence. Re-adding an id that is already queued is a no-op. */
  add(occurrenceId: string, delayMs: number): Promise<void>;
  /** Removes the job if present. Never throws for a missing job. */
  remove(occurrenceId: string): Promise<void>;
  /** Ids of every delayed / waiting / active job. */
  liveJobIds(): Promise<string[]>;
}
