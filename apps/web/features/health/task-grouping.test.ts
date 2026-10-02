import { describe, expect, it } from "vitest";
import { countTaskBuckets, dayKeyOf, daysFromToday, groupScheduledTasks, nextReminder, reminderSchedule } from "./task-grouping";
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

describe("reminderSchedule / nextReminder (mirrors the backend 7-3-1-day-of cadence)", () => {
  const now = local(2026, 10, 1, 9);

  it("a step a week out has all four reminders still to come", () => {
    const slots = reminderSchedule(iso(local(2026, 10, 8)), now);
    expect(slots.map((s) => s.daysBefore)).toEqual([7, 3, 1, 0]);
    expect(slots.every((s) => s.willFire)).toBe(true);
    expect(dayKeyOf(iso(slots[0].date))).toBe("2026-10-01");
    expect(dayKeyOf(iso(slots[3].date))).toBe("2026-10-08");
  });

  it("stages already behind us are skipped, never back-filled", () => {
    // due in 2 days: the 7-day and 3-day reminders would have been in the past
    const slots = reminderSchedule(iso(local(2026, 10, 3)), now);
    expect(slots.map((s) => s.willFire)).toEqual([false, false, true, true]);
  });

  it("next reminder is the earliest one still to come", () => {
    expect(nextReminder(iso(local(2026, 10, 8)), now)?.daysBefore).toBe(7);
    expect(nextReminder(iso(local(2026, 10, 6)), now)?.daysBefore).toBe(3);
    expect(nextReminder(iso(local(2026, 10, 3)), now)?.daysBefore).toBe(1);
    expect(nextReminder(iso(local(2026, 10, 1)), now)?.daysBefore).toBe(0); // today counts
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

describe("countTaskBuckets (the Schedule pills and the attention strip share it)", () => {
  const now = local(2026, 10, 10, 9);
  const mk = (id: string, title: string, due: Date, status: string) =>
    ({
      id,
      cattleId: id,
      title,
      taskType: "MEDICINE",
      medicineName: null,
      dueDateTime: iso(due),
      status,
    }) as unknown as HealthTask;

  it("counts overdue, today and upcoming cards, one per grouped step", () => {
    const groups = groupScheduledTasks([
      mk("a", "Late dose", local(2026, 10, 8), "PENDING"),
      mk("b", "Late dose", local(2026, 10, 8), "PENDING"), // same card as "a"
      mk("c", "Today dose", local(2026, 10, 10, 18), "PENDING"),
      mk("d", "Later dose", local(2026, 10, 14), "PENDING"),
    ]);
    expect(countTaskBuckets(groups, now)).toEqual({ overdue: 1, today: 1, upcoming: 1 });
  });

  it("a finished card with a past due date is done — in no bucket", () => {
    const groups = groupScheduledTasks([mk("a", "Done dose", local(2026, 10, 8), "COMPLETED")]);
    expect(countTaskBuckets(groups, now)).toEqual({ overdue: 0, today: 0, upcoming: 0 });
  });
});
