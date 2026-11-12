import { describe, expect, it } from "vitest";
import {
  groupByDay,
  inGroup,
  sortNewestFirst,
  TIMELINE_TYPES,
  TYPE_GROUP,
  type TimelineEvent,
} from "./timeline-model";

const event = (id: string, eventAt: string, over: Partial<TimelineEvent> = {}): TimelineEvent => ({
  id,
  type: "NOTE",
  eventAt,
  provenance: "RECORDED",
  status: "ACTIVE",
  notes: null,
  findings: null,
  batchId: null,
  sourceEventId: null,
  detail: null,
  ...over,
});

describe("sortNewestFirst", () => {
  it("orders by event date, not entry order, and breaks ties on id", () => {
    const rows = [event("a", "2026-09-21T07:00:00"), event("b", "2026-10-28T07:00:00"), event("c", "2026-09-21T07:00:00")];
    expect(sortNewestFirst(rows).map((r) => r.id)).toEqual(["b", "c", "a"]);
  });
  it("does not mutate its input", () => {
    const rows = [event("a", "2026-09-01T00:00:00"), event("b", "2026-10-01T00:00:00")];
    sortNewestFirst(rows);
    expect(rows.map((r) => r.id)).toEqual(["a", "b"]);
  });
});

describe("groupByDay", () => {
  it("groups consecutive rows of the same local day", () => {
    const rows = sortNewestFirst([
      event("a", "2026-10-28T09:00:00"),
      event("b", "2026-10-28T07:00:00"),
      event("c", "2026-09-21T07:00:00"),
    ]);
    const days = groupByDay(rows);
    expect(days.map((d) => [d.day, d.events.length])).toEqual([
      ["2026-10-28", 2],
      ["2026-09-21", 1],
    ]);
  });
  it("returns nothing for an empty list", () => {
    expect(groupByDay([])).toEqual([]);
  });
});

describe("filters", () => {
  it("every event type belongs to exactly one filter group", () => {
    for (const type of TIMELINE_TYPES) expect(TYPE_GROUP[type]).toBeTruthy();
  });
  it("matches by group; null means all", () => {
    const heat = event("h", "2026-10-01T00:00:00", { type: "HEAT" });
    expect(inGroup(heat, "REPRODUCTION")).toBe(true);
    expect(inGroup(heat, "HEALTH")).toBe(false);
    expect(inGroup(heat, null)).toBe(true);
  });
});
