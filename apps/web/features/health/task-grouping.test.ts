import { describe, expect, it } from "vitest";
import { dayKeyOf, daysFromToday, groupScheduledTasks, nextReminder, noticeDaysFor, reminderSchedule } from "./task-grouping";
import type { HealthTask } from "./types";

/** Local-time constructor → ISO, so the tests read the same in any timezone the runner happens to use. */
const local = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h, 0, 0);
const iso = (date: Date) => date.toISOString();

describe("dayKeyOf", () => {
  it("is the local calendar day, not the UTC date", () => {
    // 02:00 local on 4 Oct is 'the 4th' on the farm whatever the UTC date is (UTC+6 → still the 3rd in UTC)
    expect(dayKeyOf(iso(local(2026, 10, 4, 2)))).toBe("2026-10-04");
    expect(dayKeyOf(iso(local(2026, 10, 4, 23)))).toBe("2026-10-04");
  });
});

describe("daysFromToday", () => {
  const now = local(2026, 10, 1, 15);
  it("counts calendar days, not 24h windows", () => {
    expect(daysFromToday(iso(local(2026, 10, 1, 1)), now)).toBe(0);
    expect(daysFromToday(iso(local(2026, 10, 2, 0)), now)).toBe(1);
    expect(daysFromToday(iso(local(2026, 10, 8, 23)), now)).toBe(7);
    expect(daysFromToday(iso(local(2026, 9, 29, 12)), now)).toBe(-2);
  });
});

describe("reminderSchedule / nextReminder (automatic notice leads: round 7-1-day-of, treatment day-of)", () => {
  const now = local(2026, 10, 1, 9);

  it("a round step a week out has all three notices still to come", () => {
    const slots = reminderSchedule(iso(local(2026, 10, 8)), now);
    expect(slots.map((s) => s.daysBefore)).toEqual([7, 1, 0]);
    expect(slots.every((s) => s.willFire)).toBe(true);
    expect(dayKeyOf(iso(slots[0].date))).toBe("2026-10-01");
    expect(dayKeyOf(iso(slots[2].date))).toBe("2026-10-08");
  });

  it("stages already behind us are skipped, never back-filled", () => {
    // due in 2 days: the 7-day notice would have been in the past
    const slots = reminderSchedule(iso(local(2026, 10, 3)), now);
    expect(slots.map((s) => s.willFire)).toEqual([false, true, true]);
  });

  it("next notice is the earliest one still to come", () => {
    expect(nextReminder(iso(local(2026, 10, 8)), now)?.daysBefore).toBe(7);
    expect(nextReminder(iso(local(2026, 10, 3)), now)?.daysBefore).toBe(1);
    expect(nextReminder(iso(local(2026, 10, 1)), now)?.daysBefore).toBe(0); // today counts
  });

  it("a treatment protocol is notified on the day only", () => {
    expect(noticeDaysFor("TREATMENT")).toEqual([0]);
    expect(noticeDaysFor("PREVENTION")).toEqual([7, 1, 0]);
    expect(noticeDaysFor(undefined)).toEqual([7, 1, 0]);
    expect(reminderSchedule(iso(local(2026, 10, 8)), now, noticeDaysFor("TREATMENT")).map((s) => s.daysBefore)).toEqual([0]);
  });

  it("there is no next reminder once the due day has passed (the daily overdue nag takes over)", () => {
    expect(nextReminder(iso(local(2026, 9, 30)), now)).toBeNull();
  });
});

describe("groupScheduledTasks", () => {
  const task = (id: string, cattleId: string, due: Date): HealthTask =>
    ({
      id,
      cattleId,
      title: "FMD booster",
      taskType: "VACCINATION",
      medicineName: null,
      doseAmount: null,
      doseUnit: null,
      route: null,
      instruction: null,
      dueDateTime: iso(due),
      status: "PENDING",
    }) as unknown as HealthTask;

  it("groups the same step on the same local day, and splits different days", () => {
    const groups = groupScheduledTasks([
      task("a", "c1", local(2026, 10, 4, 2)), // early morning local
      task("b", "c2", local(2026, 10, 4, 18)), // evening, same local day
      task("c", "c3", local(2026, 10, 5, 2)),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0].tasks.map((t) => t.id)).toEqual(["a", "b"]);
  });
});
