import { format } from "date-fns";
import type { CattleOverview, HealthCaseRow, TreatmentLogRow } from "@/features/cattle/detail-types";
import type { ReproEventEntry, ReproEventType } from "@/features/reproduction/types";

/**
 * MILESTONE 31 (RFE-155) — unified animal timeline model. Mirrors the backend `AnimalEvent` header + detail row
 * served by `GET /cattle/:id/events` (RAKHAL-479; enum in `prisma/schemas/animal-events/animal-event.prisma`).
 * Until that route answers, `use-animal-timeline.ts` builds the same rows from the per-domain hooks below.
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

// ---- Fallback: the same rows built from the existing per-domain endpoints ----------------------------------------

const REPRO_TYPE: Record<ReproEventType, TimelineEventType> = {
  heat: "HEAT",
  breeding: "BREEDING",
  pregnancy_diagnosis: "PREG_CHECK",
  calving: "CALVING",
  abortion: "ABORTION",
};

const base = { provenance: "RECORDED", status: "ACTIVE", findings: null, batchId: null, sourceEventId: null } as const;

export function fromReproEvents(items: ReproEventEntry[]): TimelineEvent[] {
  return items.map((event) => ({
    ...base,
    id: `repro-${event.id}`,
    type: REPRO_TYPE[event.event_type],
    eventAt: event.event_date,
    notes: null,
    detail: event.details,
  }));
}

export function fromTreatments(items: TreatmentLogRow[]): TimelineEvent[] {
  return items.map((log) => ({
    ...base,
    id: `treatment-${log.id}`,
    type: "TREATMENT",
    eventAt: log.administeredAt,
    notes: log.notes,
    detail: { medicineName: log.medicineName, route: log.route },
  }));
}

export function fromCases(items: HealthCaseRow[]): TimelineEvent[] {
  return items.map((c) => ({
    ...base,
    id: `case-${c.id}`,
    type: "ILLNESS",
    eventAt: c.startDate,
    notes: c.note,
    detail: { condition: c.condition },
  }));
}

export function fromOverview(overview: Pick<CattleOverview, "weight_history" | "bcs_records"> | undefined): TimelineEvent[] {
  if (!overview) return [];
  return [
    ...overview.weight_history.map((w) => ({
      ...base,
      id: `weight-${w.date}`,
      type: "WEIGHT" as const,
      eventAt: w.date,
      notes: null,
      detail: { weightKg: w.weight_kg },
    })),
    ...overview.bcs_records.map((b) => ({
      ...base,
      id: `bcs-${b.date}`,
      type: "BCS" as const,
      eventAt: b.date,
      notes: null,
      detail: { score: b.score },
    })),
  ];
}
