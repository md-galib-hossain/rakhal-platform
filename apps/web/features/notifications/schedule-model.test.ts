import { describe, expect, it } from "vitest";
import {
  allowedAudiences,
  buildScheduleRequest,
  buildUpdateRequest,
  composerSchema,
  defaultComposerValues,
  leadOptions,
  leadsForAllDay,
  mapServerFieldErrors,
  toggleLead,
  valuesFromSchedule,
  type ComposerAnchor,
  type ComposerValues,
} from "./schedule-model";
import type { NotificationSchedule } from "./types";

const ctx = { meId: "u1", canManage: true };
const anchor: ComposerAnchor = { type: "ANIMAL_EVENT", id: "ev1", label: "AI · COW-1" };

function values(over: Partial<ComposerValues> = {}): ComposerValues {
  return { ...defaultComposerValues({ today: "2026-11-10" }), title: "Check fence", ...over };
}
const issues = (v: ComposerValues) => {
  const r = composerSchema.safeParse(v);
  return r.success ? [] : r.error.issues.map((i) => `${String(i.path[0])}:${i.message}`);
};

describe("composerSchema", () => {
  it("accepts the default draft with a title", () => {
    expect(issues(values())).toEqual([]);
  });

  it("requires a title and caps its length", () => {
    expect(issues(values({ title: "  " }))).toContain("title:titleRequired");
    expect(issues(values({ title: "x".repeat(121) }))).toContain("title:titleTooLong");
  });

  it("requires a valid time only when not all-day", () => {
    expect(issues(values({ allDay: false, time: "" }))).toContain("time:timeInvalid");
    expect(issues(values({ allDay: false, time: "25:00" }))).toContain("time:timeInvalid");
    expect(issues(values({ allDay: false, time: "14:30" }))).toEqual([]);
    expect(issues(values({ allDay: true, time: "" }))).toEqual([]);
  });

  it("requires a date for DATE and an offset for anchored modes", () => {
    expect(issues(values({ date: "" }))).toContain("date:dateRequired");
    expect(issues(values({ when: "before", offsetDays: "" }))).toContain("offsetDays:offsetInvalid");
    expect(issues(values({ when: "after", offsetDays: "3651" }))).toContain("offsetDays:offsetInvalid");
    expect(issues(values({ when: "after", offsetDays: "10" }))).toEqual([]);
  });

  it("validates repeat interval and end date", () => {
    expect(issues(values({ repeat: "EVERY_N_DAYS", intervalDays: "0" }))).toContain("intervalDays:intervalInvalid");
    expect(issues(values({ repeat: "WEEKLY", endDate: "2026-11-01" }))).toContain("endDate:endBeforeStart");
    expect(issues(values({ repeat: "MONTHLY", endDate: "2027-01-01" }))).toEqual([]);
  });

  it("limits leads to 4, at least 1, whole days when all-day", () => {
    expect(issues(values({ leads: [] }))).toContain("leads:leadRequired");
    expect(issues(values({ leads: [10080, 1440, 60, 0, 5] }))).toContain("leads:tooManyLeads");
    expect(issues(values({ allDay: true, leads: [60] }))).toContain("leads:leadNeedsTime");
    expect(issues(values({ allDay: false, time: "09:00", leads: [60, 0] }))).toEqual([]);
  });

  it("needs recipients for roles / people", () => {
    expect(issues(values({ audience: "roles" }))).toContain("roles:rolesRequired");
    expect(issues(values({ audience: "people" }))).toContain("userIds:peopleRequired");
  });
});

describe("lead helpers", () => {
  it("hides the 1-hour chip for all-day", () => {
    expect(leadOptions(true)).toEqual([0, 1440, 10080]);
    expect(leadOptions(false)).toEqual([0, 60, 1440, 10080]);
  });
  it("drops sub-day leads on switching to all-day, never leaving none", () => {
    expect(leadsForAllDay([1440, 60], true)).toEqual([1440]);
    expect(leadsForAllDay([60], true)).toEqual([0]);
    expect(leadsForAllDay([60], false)).toEqual([60]);
  });
  it("toggles chips, sorted descending", () => {
    expect(toggleLead([0], 1440)).toEqual([1440, 0]);
    expect(toggleLead([1440, 0], 0)).toEqual([1440]);
  });
});

describe("buildScheduleRequest", () => {
  it("sends the user's exact time as a farm-local string, never a UTC instant", () => {
    const req = buildScheduleRequest(values({ allDay: false, time: "14:30", date: "2026-11-12" }), ctx);
    expect(req).toMatchObject({ trigger: "DATE", date: "2026-11-12", time: "14:30" });
    expect(JSON.stringify(req)).not.toMatch(/Z"|T\d\d:/);
  });

  it("omits time for an all-day notice (server default 08:00)", () => {
    expect(buildScheduleRequest(values({ allDay: true }), ctx)).not.toHaveProperty("time");
  });

  it("maps anchored modes to BEFORE_EVENT / AFTER_EVENT with offset and anchor, no date", () => {
    const before = buildScheduleRequest(values({ when: "before", offsetDays: "7" }), { ...ctx, anchor });
    expect(before).toMatchObject({ trigger: "BEFORE_EVENT", offset_days: 7, anchor: { type: "ANIMAL_EVENT", id: "ev1" } });
    expect(before).not.toHaveProperty("date");
    const after = buildScheduleRequest(values({ when: "after", offsetDays: "10" }), { ...ctx, anchor });
    expect(after.trigger).toBe("AFTER_EVENT");
  });

  it("maps repeat, leads and animals", () => {
    const req = buildScheduleRequest(
      values({ repeat: "EVERY_N_DAYS", intervalDays: "3", endDate: "2027-01-01", leads: [0, 1440], animals: [{ id: "a1", tagNumber: "T1" }] }),
      ctx,
    );
    expect(req.repeat).toEqual({ type: "EVERY_N_DAYS", interval: 3, end_date: "2027-01-01" });
    expect(req.lead_minutes).toEqual([1440, 0]);
    expect(req.animal_ids).toEqual(["a1"]);
  });

  it("maps audiences", () => {
    expect(buildScheduleRequest(values(), ctx).audience).toEqual({ mode: "USER", user_id: "u1" });
    expect(buildScheduleRequest(values({ audience: "roles", roles: ["Manager"] }), ctx).audience).toEqual({ mode: "ROLES", roles: ["Manager"] });
    expect(buildScheduleRequest(values({ audience: "people", userIds: ["u2", "u2", "u3"] }), ctx).audience).toEqual({ mode: "USERS", user_ids: ["u2", "u3"] });
  });

  it("forces 'me' for a user without notification.manage even if values say otherwise", () => {
    const worker = { meId: "u9", canManage: false };
    expect(allowedAudiences(false)).toEqual(["me"]);
    expect(buildScheduleRequest(values({ audience: "people", userIds: ["u2"] }), worker).audience).toEqual({ mode: "USER", user_id: "u9" });
  });
});

describe("buildUpdateRequest", () => {
  it("sends time null when the edit turns the notice all-day", () => {
    expect(buildUpdateRequest(values({ allDay: true }), ctx).time).toBeNull();
    expect(buildUpdateRequest(values({ allDay: false, time: "10:15" }), ctx).time).toBe("10:15");
  });
});

describe("valuesFromSchedule", () => {
  const base: NotificationSchedule = {
    id: "s1", title: "T", body: null, status: "ACTIVE", trigger: "DATE", date: "2026-11-10", time: "14:30", all_day: false,
    anchor: null, offset_days: null, repeat: { type: "WEEKLY", interval: null, end_date: null }, lead_minutes: [1440, 0],
    audience: { mode: "USER", user_ids: ["u1"], roles: [] }, animal_ids: ["a1"], created_by: "u1", next_fire_at: null,
    created_at: "", can_edit: true,
  };
  it("round-trips a timed one-off for me", () => {
    const v = valuesFromSchedule(base, "u1");
    expect(v).toMatchObject({ when: "date", allDay: false, time: "14:30", audience: "me", repeat: "WEEKLY", leads: [1440, 0] });
    expect(issues(v)).toEqual([]);
  });
  it("shows another single user as people, roles as roles", () => {
    expect(valuesFromSchedule(base, "u2")).toMatchObject({ audience: "people", userIds: ["u1"] });
    expect(valuesFromSchedule({ ...base, audience: { mode: "ROLES", user_ids: [], roles: ["Manager"] } }, "u1")).toMatchObject({ audience: "roles", roles: ["Manager"] });
  });
});

describe("mapServerFieldErrors", () => {
  it("maps wire fields to form fields and drops unknown keys", () => {
    expect(mapServerFieldErrors({ body: ["too long"], offset_days: "bad", "repeat.interval": ["x"], nope: "y" })).toEqual([
      { field: "notes", message: "too long" },
      { field: "offsetDays", message: "bad" },
      { field: "intervalDays", message: "x" },
    ]);
    expect(mapServerFieldErrors(undefined)).toEqual([]);
  });
});
