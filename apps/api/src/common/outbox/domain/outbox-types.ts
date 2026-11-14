/**
 * Shared types for the durable transactional outbox (RAKHAL-332). Kept
 * dependency-free (no Prisma import) so the domain layer stays pure per the
 * house `domain -> application -> infrastructure -> presentation` layering.
 */

/** Input to `OutboxWriterService.write` — one row, written inside the caller's own `$transaction`. */
export interface WriteOutboxEventInput {
  farmId: string;
  eventType: string;
  /** Must be JSON-serializable. */
  payload: Record<string, unknown>;
  /**
   * Unique per farm + operation. Derive from something stable about the
   * originating command (e.g. `${sourceType}:${sourceId}:${eventType}`) so a
   * retried/duplicated request can never enqueue the same event twice.
   */
  idempotencyKey: string;
}

/** A handler a module registers to receive dispatched events of one `eventType`. Throwing fails the delivery attempt (caught by the drainer, never the producer). */
export type OutboxEventHandler = (
  payload: Record<string, unknown>,
) => Promise<void> | void;

/** Outcome of one drain pass, for logging/tests. */
export interface OutboxDrainResult {
  claimed: number;
  processed: number;
  failed: number;
  deadLettered: number;
}
