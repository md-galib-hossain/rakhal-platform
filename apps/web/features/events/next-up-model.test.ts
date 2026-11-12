import { describe, expect, it } from "vitest";
import type { UpcomingEvent } from "@/features/cattle/types";
import { canSnoozeSkip, hasActions, recordKeyFor, snoozeDay, snoozeDueAt } from "./next-up-model";

const event = (over: Partial<UpcomingEvent> = {}): UpcomingEvent => ({
  kind: "TASK",
  labelKey: "cattle.upcoming.task",
  dueAt: "2026-10-30T06:00:00.000Z",
  daysUntil: 0,
  urgency: "DUE_SOON",
  actionable: true,
  ref: { type: "TASK", id: "t1" },
  ...over,
});

describe("recordKeyFor", () => {
  it("maps actionable kinds to their event form", () => {
    expect(recordKeyFor(event({ kind: "PREGNANCY_CHECK" }))).toBe("PREG_CHECK");
    expect(recordKeyFor(event({ kind: "DRY_OFF" }))).toBe("DRY_OFF");
    expect(recordKeyFor(event({ kind: "CALVING" }))).toBe("CALVING");
    expect(recordKeyFor(event({ kind: "HEALTH_STEP" }))).toBe("TREATMENT");
    expect(recordKeyFor(event({ kind: "PREVENTIVE_STEP" }))).toBe("VACCINATION");
  });
  it("a plain task has no event form, and information-only rows never do", () => {
    expect(recordKeyFor(event({ kind: "TASK" }))).toBeNull();
    expect(recordKeyFor(event({ kind: "WITHDRAWAL_END", actionable: false }))).toBeNull();
    expect(recordKeyFor(event({ kind: "CALVING", actionable: false }))).toBeNull();
  });
});

describe("snooze and skip", () => {
  it("only Task Hub reminders can be snoozed or skipped", () => {
    expect(canSnoozeSkip(event())).toBe(true);
    expect(canSnoozeSkip(event({ kind: "PREGNANCY_CHECK", ref: { type: "BREEDING_EVENT", id: "b1" } }))).toBe(false);
    expect(canSnoozeSkip(event({ actionable: false }))).toBe(false);
  });
  it("info-only rows have no actions at all", () => {
    expect(hasActions(event({ kind: "WITHDRAWAL_END", actionable: false, ref: { type: "SAFETY_WITHDRAWAL", id: "w1" } }))).toBe(false);
    expect(hasActions(event())).toBe(true);
  });
  it("snooze counts from today and keeps the task's time of day", () => {
    expect(snoozeDay("2026-10-30", 1)).toBe("2026-10-31");
    expect(snoozeDay("2026-10-30", 7)).toBe("2026-11-06");
    const original = "2026-10-20T09:30:00";
    const moved = new Date(snoozeDueAt(original, "2026-11-06"));
    expect(moved.getFullYear()).toBe(2026);
    expect(moved.getMonth()).toBe(10);
    expect(moved.getDate()).toBe(6);
    expect(moved.getHours()).toBe(9);
    expect(moved.getMinutes()).toBe(30);
  });
});
