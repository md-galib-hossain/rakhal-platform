/**
 * Notifications v2 late-fire rule (RAKHAL-492, docs/EPIC_NOTIFICATIONS_V2.md §3.3 step 2). Pure.
 *
 * A job normally fires on time. After a restart or a short Redis outage it may run late: within two hours it still
 * fires, beyond that the occurrence is SKIPPED (LATE) — the overdue nag recovers anything that mattered.
 */

export const LATE_WINDOW_MS = 2 * 60 * 60 * 1000;

export type LateVerdict = 'FIRE' | 'LATE';

/** Exactly two hours late still fires; one millisecond more is LATE. A job that runs early (clock skew) fires. */
export function evaluateLate(fireAt: Date, now: Date): LateVerdict {
  return now.getTime() - fireAt.getTime() > LATE_WINDOW_MS ? 'LATE' : 'FIRE';
}
