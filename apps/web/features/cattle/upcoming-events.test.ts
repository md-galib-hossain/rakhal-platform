import { describe, expect, it } from "vitest";
import type { UpcomingEvent } from "./types";
import { eventDue, eventLabel, eventVariant } from "./upcoming-events";

function ev(over: Partial<UpcomingEvent> = {}): UpcomingEvent {
  return {
    kind: "HEALTH_STEP",
    labelKey: "cattle.upcoming.healthStep",
    labelParams: { title: "Antibiotic day 2" },
    dueAt: "2026-10-12T06:00:00.000Z",
    daysUntil: 1,
    urgency: "DUE_SOON",
    actionable: true,
    ref: { type: "HEALTH_TASK", id: "ht1" },
    ...over,
  };
}

describe("eventLabel", () => {
  it.each([
    "healthStep",
    "preventiveStep",
    "pregnancyCheck",
    "calving",
    "dryOff",
    "task",
    "milkWithdrawalEnd",
    "meatWithdrawalEnd",
  ])("maps the backend key %s into the cattle namespace", (suffix) => {
    expect(eventLabel(ev({ labelKey: `cattle.upcoming.${suffix}` })).key).toBe(`upcoming.labels.${suffix}`);
  });

  it("passes the step or task title through as a param", () => {
    expect(eventLabel(ev()).values).toEqual({ title: "Antibiotic day 2" });
  });

  it("falls back to the generic per-kind label for a key a newer backend invented", () => {
    expect(eventLabel(ev({ labelKey: "cattle.upcoming.somethingNew", kind: "TASK" })).key).toBe("upcoming.kinds.TASK");
  });
});

describe("eventDue", () => {
  it.each([
    [-3, "upcoming.overdueDays", { count: 3 }],
    [-1, "upcoming.overdueDays", { count: 1 }],
    [0, "upcoming.today", undefined],
    [1, "upcoming.tomorrow", undefined],
    [5, "upcoming.inDays", { count: 5 }],
  ])("%i days -> %s", (days, key, values) => {
    expect(eventDue(ev({ daysUntil: days }))).toEqual(values ? { key, values } : { key });
  });
});

describe("eventVariant", () => {
  it("is red when overdue, amber when due soon, neutral later", () => {
    expect(eventVariant(ev({ urgency: "OVERDUE" }))).toBe("destructive");
    expect(eventVariant(ev({ urgency: "DUE_SOON" }))).toBe("warning");
    expect(eventVariant(ev({ urgency: "LATER" }))).toBe("muted");
  });

  it("never uses alarm colours for information that is not work", () => {
    expect(eventVariant(ev({ kind: "WITHDRAWAL_END", actionable: false, urgency: "DUE_SOON" }))).toBe("info");
  });
});
