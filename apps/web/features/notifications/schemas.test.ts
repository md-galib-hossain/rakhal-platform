import { describe, expect, it } from "vitest";
import { SCHEDULE_VALIDATION_KEYS as K, scheduleSchema, toScheduleRequest } from "./schemas";
import type { CreateScheduleInput } from "./types";

const base: CreateScheduleInput = {
  title: "Check the fence",
  trigger: "DATE",
  date: "2026-11-10",
  time: "08:00",
  audience: { mode: "USER", user_id: "u1" },
};

function messages(input: unknown): string[] {
  const r = scheduleSchema.safeParse(input);
  return r.success ? [] : r.error.issues.map((i) => i.message);
}

describe("scheduleSchema", () => {
  it("accepts a valid DATE schedule", () => {
    expect(scheduleSchema.safeParse(base).success).toBe(true);
  });

  it("requires title, date for DATE and an audience target", () => {
    expect(messages({ ...base, title: "   " })).toContain(K.titleRequired);
    expect(messages({ ...base, date: undefined })).toContain(K.dateRequired);
    expect(messages({ ...base, audience: { mode: "ROLES", roles: [] } })).toContain(K.audienceRequired);
    expect(messages({ ...base, audience: { mode: "USERS", user_ids: ["a"] } })).toEqual([]);
  });

  it("requires anchor and offset for BEFORE/AFTER_EVENT but not a date", () => {
    const rel = { ...base, trigger: "BEFORE_EVENT" as const, date: undefined };
    expect(messages(rel)).toEqual(expect.arrayContaining([K.anchorRequired, K.offsetRequired]));
    expect(messages({ ...rel, anchor: { type: "TASK", id: "t1" }, offset_days: 0 })).toEqual([]);
  });

  it("requires interval for EVERY_N_DAYS and rejects bad formats and caps", () => {
    expect(messages({ ...base, repeat: { type: "EVERY_N_DAYS" } })).toContain(K.intervalRequired);
    expect(messages({ ...base, time: "8:00" })).toContain(K.invalidTime);
    expect(messages({ ...base, date: "10-11-2026" })).toContain(K.invalidDate);
    expect(messages({ ...base, lead_minutes: [0, 1, 2, 3, 4] })).toContain(K.tooManyLeads);
    expect(
      messages({ ...base, offset_days: 4000, trigger: "AFTER_EVENT", anchor: { type: "TASK", id: "t" } }).length,
    ).toBeGreaterThan(0);
  });
});

describe("toScheduleRequest", () => {
  it("drops fields the trigger does not use and empty optionals", () => {
    const out = toScheduleRequest({
      ...base,
      title: "  Check  ",
      body: "   ",
      anchor: { type: "TASK", id: "t1" },
      offset_days: 3,
      repeat: { type: "NEVER", interval: 7, end_date: "2027-01-01" },
      lead_minutes: [],
      animal_ids: [],
    });
    expect(out).toEqual({
      title: "Check",
      trigger: "DATE",
      date: "2026-11-10",
      time: "08:00",
      repeat: { type: "NEVER" },
      audience: { mode: "USER", user_id: "u1" },
    });
  });

  it("keeps anchor and offset (not date) for relative triggers, and only interval for EVERY_N_DAYS", () => {
    const out = toScheduleRequest({
      title: "t",
      trigger: "AFTER_EVENT",
      date: "2026-11-10",
      anchor: { type: "HEALTH_STEP", id: "h1" },
      offset_days: 2,
      repeat: { type: "WEEKLY", interval: 9, end_date: "2027-01-01" },
      lead_minutes: [0, 1440, 1440],
      audience: { mode: "ROLES", roles: ["Manager", "Manager"], user_id: "x" },
      animal_ids: ["a", "a", "b"],
    });
    expect(out.date).toBeUndefined();
    expect(out.anchor).toEqual({ type: "HEALTH_STEP", id: "h1" });
    expect(out.offset_days).toBe(2);
    expect(out.repeat).toEqual({ type: "WEEKLY", end_date: "2027-01-01" });
    expect(out.lead_minutes).toEqual([1440, 0]);
    expect(out.audience).toEqual({ mode: "ROLES", roles: ["Manager"] });
    expect(out.animal_ids).toEqual(["a", "b"]);
  });
});
