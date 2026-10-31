import { format } from "date-fns";

/**
 * MILESTONE 31 (RFE-155) — unified animal timeline model. Mirrors the backend `AnimalEvent` header + detail row
 * served by `GET /cattle/:id/events` (RAKHAL-479; enum in `prisma/schemas/animal-events/animal-event.prisma`).
 */

export const TIMELINE_TYPES = [
  "HEAT", "BREEDING", "PREG_CHECK", "CALVING", "ABORTION", "DRY_OFF", "ILLNESS", "TREATMENT", "VACCINATION",
  "DEWORMING", "WEIGHT", "BCS", "WEANING", "CASTRATION", "ENTER_FATTENING", "LEAVE_FATTENING", "MOVE", "SOLD",
  "DIED", "CULLED", "NOTE", "HOOF_TRIM", "DEHORN", "CUSTOM",
] as const;
export type TimelineEventType = (typeof TIMELINE_TYPES)[number];

/** Filter chips: All + the backend catalogue groups (`animal-events/domain/catalogue.ts`, `?group=`). Dry off is filed under
 * Reproduction there, so there is no separate Milk chip. */
export const TIMELINE_GROUPS = ["REPRODUCTION", "HEALTH", "GROWTH", "MOVEMENT", "OTHER"] as const;
export type TimelineGroup = (typeof TIMELINE_GROUPS)[number];

export const TYPE_GROUP: Record<TimelineEventType, TimelineGroup> = {
  HEAT: "REPRODUCTION", BREEDING: "REPRODUCTION", PREG_CHECK: "REPRODUCTION", CALVING: "REPRODUCTION",
  ABORTION: "REPRODUCTION", DRY_OFF: "REPRODUCTION",
  ILLNESS: "HEALTH", TREATMENT: "HEALTH", VACCINATION: "HEALTH", DEWORMING: "HEALTH", HOOF_TRIM: "HEALTH", DEHORN: "HEALTH",
  WEIGHT: "GROWTH", BCS: "GROWTH", WEANING: "GROWTH", CASTRATION: "GROWTH", ENTER_FATTENING: "GROWTH", LEAVE_FATTENING: "GROWTH",
  MOVE: "MOVEMENT", SOLD: "MOVEMENT", DIED: "MOVEMENT", CULLED: "MOVEMENT",
  NOTE: "OTHER", CUSTOM: "OTHER",
};

export interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  /** ISO instant — when it happened, not when it was entered. */
  eventAt: string;
  provenance: "RECORDED" | "HISTORICAL";
  status: "ACTIVE" | "VOIDED";
  notes: string | null;
  /** Warnings accepted at save time (e.g. heat while pregnant). */
  findings: unknown[] | null;
  batchId: string | null;
  /** The earlier event this one follows from (a preg check's AI). */
  sourceEventId: string | null;
  /** Who entered it and when (route rows only) — the 24 h author window of Edit / Void is measured from `createdAt`. */
  recordedById?: string | null;
  createdAt?: string | null;
  detail: Record<string, unknown> | null;
}

export function inGroup(event: TimelineEvent, group: TimelineGroup | null): boolean {
  return group === null || TYPE_GROUP[event.type] === group;
}

/** Newest first by event date; ties break on id so the order is stable across renders. */
export function sortNewestFirst(events: TimelineEvent[]): TimelineEvent[] {
  return [...events].sort((a, b) => (a.eventAt === b.eventAt ? b.id.localeCompare(a.id) : b.eventAt.localeCompare(a.eventAt)));
}

/** Local calendar day (`YYYY-MM-DD`) — a day heading is the farmer's day, not UTC's. */
export function dayKey(iso: string): string {
  return format(new Date(iso), "yyyy-MM-dd");
}

export function groupByDay(events: TimelineEvent[]): { day: string; events: TimelineEvent[] }[] {
  const days: { day: string; events: TimelineEvent[] }[] = [];
  for (const event of events) {
    const day = dayKey(event.eventAt);
    const last = days[days.length - 1];
    if (last && last.day === day) last.events.push(event);
    else days.push({ day, events: [event] });
  }
  return days;
}
