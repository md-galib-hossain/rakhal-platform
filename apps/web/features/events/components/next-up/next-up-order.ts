import type { UpcomingEvent } from "@/features/cattle/types";

/** Cards the sidebar shows before "Show all" (RFE-187): enough to act on, never enough to push At a glance away. */
export const NEXT_UP_VISIBLE = 3;

const isOverdue = (event: UpcomingEvent) => event.urgency === "OVERDUE" || event.daysUntil < 0;

/** Overdue first, then by due date; stable for ties so the server's order survives. */
export function orderNextUp(events: UpcomingEvent[]): UpcomingEvent[] {
  return events
    .map((event, index) => ({ event, index }))
    .sort((a, b) => Number(isOverdue(b.event)) - Number(isOverdue(a.event)) || a.event.daysUntil - b.event.daysUntil || a.index - b.index)
    .map(({ event }) => event);
}

/** The first `limit` events, and how many are left for "Show all (N)". `total` may exceed the loaded rows (server cap). */
export function capNextUp(events: UpcomingEvent[], total: number, limit = NEXT_UP_VISIBLE) {
  const ordered = orderNextUp(events);
  return {
    shown: ordered.slice(0, limit),
    all: ordered,
    overflow: Math.max(total, ordered.length) > limit,
    count: Math.max(total, ordered.length),
  };
}
