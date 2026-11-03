import { describe, expect, it } from "vitest";
import type { Task } from "@/features/tasks/types";
import {
  buildCreatePayload,
  buildUpdatePayload,
  defaultReminderValues,
  dueFromEvent,
  localToIso,
  reminderSchema,
  valuesFromTask,
  type ReminderFormValues,
} from "./reminder-model";

const LALI = { id: "c1", tagNumber: "A-12", name: "Lali" };

function values(patch: Partial<ReminderFormValues> = {}): ReminderFormValues {
  return { ...defaultReminderValues({ today: "2026-11-02", assigneeId: "u1", animal: LALI }), title: "Check hoof", ...patch };
}

function errors(v: ReminderFormValues): Record<string, string> {
  const result = reminderSchema.safeParse(v);
  if (result.success) return {};
  return Object.fromEntries(result.error.issues.map((i) => [String(i.path[0]), i.message]));
}

describe("reminderSchema", () => {
  it("accepts a dated reminder for me with one animal", () => {
    expect(errors(values())).toEqual({});
  });

  it("needs a title, a date and an assignee", () => {
    expect(errors(values({ title: "  ", date: "", assigneeId: "" }))).toEqual({
      title: "titleRequired",
      date: "dateRequired",
      assigneeId: "assigneeRequired",
    });
  });

  it("'after an event' needs exactly one animal, an event and a whole-day offset", () => {
    expect(errors(values({ when: "afterEvent", animals: [], eventId: "", offsetDays: "x" }))).toEqual({
      animals: "oneAnimalForEvent",
      eventId: "eventRequired",
      offsetDays: "offsetInvalid",
    });
    expect(errors(values({ when: "afterEvent", eventId: "e1", offsetDays: "10" }))).toEqual({});
  });

  it("every-N-days needs 1..365, and an end date cannot precede the start", () => {
    expect(errors(values({ repeat: "EVERY_N_DAYS", intervalDays: "0" })).intervalDays).toBe("intervalInvalid");
    expect(errors(values({ repeat: "EVERY_N_DAYS", intervalDays: "366" })).intervalDays).toBe("intervalInvalid");
    expect(errors(values({ repeat: "WEEKLY", endDate: "2026-11-01" })).endDate).toBe("endBeforeStart");
  });

  it("roles and named people must not be empty when chosen", () => {
    expect(errors(values({ audience: "roles" })).roles).toBe("rolesRequired");
    expect(errors(values({ audience: "people" })).userIds).toBe("peopleRequired");
  });
});

describe("buildCreatePayload", () => {
  it("a dated one-animal reminder", () => {
    expect(buildCreatePayload(values({ notes: " look at the left hind " }))).toEqual({
      name: "Check hoof",
      details: "look at the left hind",
      kind: "REMINDER", category: "GENERAL",
      recurring: false,
      assignedToId: "u1",
      dueAt: localToIso("2026-11-02", ""),
      relatedCattleId: "c1",
    });
  });

  it("several animals go as cattleIds, none as neither", () => {
    const two = buildCreatePayload(values({ animals: [LALI, { id: "c2", tagNumber: "A-13" }] }));
    expect(two.cattleIds).toEqual(["c1", "c2"]);
    expect(two.relatedCattleId).toBeUndefined();
    const none = buildCreatePayload(values({ animals: [] }));
    expect(none.cattleIds).toBeUndefined();
    expect(none.relatedCattleId).toBeUndefined();
  });

  it("'10 days after a treatment' sends the event and offset, never a date or animals", () => {
    const payload = buildCreatePayload(values({ when: "afterEvent", eventId: "evt-9", offsetDays: "10" }));
    expect(payload).toMatchObject({ sourceEventId: "evt-9", offsetDays: 10, kind: "REMINDER", category: "GENERAL" });
    expect(payload.dueAt).toBeUndefined();
    expect(payload.relatedCattleId).toBeUndefined();
    expect(payload.cattleIds).toBeUndefined();
  });

  it("repeat, lead notice and audience map to the DTO fields", () => {
    const payload = buildCreatePayload(
      values({ repeat: "EVERY_N_DAYS", intervalDays: "14", endDate: "2026-12-31", leadDays: "3", audience: "roles", roles: ["Manager"] }),
    );
    expect(payload).toMatchObject({
      recurring: true,
      recurrenceType: "EVERY_N_DAYS",
      recurrenceIntervalDays: 14,
      remindDaysBefore: 3,
      notifyRoleNames: ["Manager"],
    });
    expect(payload.recurrenceEndDate).toBeDefined();
    expect(payload.assignedToId).toBeUndefined();
    expect(buildCreatePayload(values({ audience: "people", userIds: ["u2", "u3"] })).recipientUserIds).toEqual(["u2", "u3"]);
  });
});

const TASK = {
  id: "t1",
  name: "Check hoof",
  details: null,
  dueAt: new Date(2026, 10, 12, 8, 0).toISOString(),
  recurring: false,
  recurrenceType: null,
  recurrenceEndDate: null,
  sourceEventId: "evt-9",
  reminderOffsetDays: 10,
  relatedCattle: LALI,
  cattleTags: [],
  assignedToId: "u1",
  notifyRoleNames: [],
  recipientUserIds: [],
} as unknown as Task;

describe("edit", () => {
  it("round-trips an event-linked reminder and reschedules through the offset", () => {
    const v = valuesFromTask(TASK);
    expect(v).toMatchObject({ when: "afterEvent", offsetDays: "10", eventId: "evt-9", time: "", animals: [LALI] });
    const payload = buildUpdatePayload({ ...v, offsetDays: "14" }, TASK);
    expect(payload.offsetDays).toBe(14);
    expect(payload.dueAt).toBeUndefined();
  });

  it("a plain reminder is rescheduled with dueAt", () => {
    const plain = { ...TASK, sourceEventId: null, reminderOffsetDays: null } as Task;
    const payload = buildUpdatePayload({ ...valuesFromTask(plain), date: "2026-11-20" }, plain);
    expect(payload.dueAt).toBe(localToIso("2026-11-20", ""));
    expect(payload.offsetDays).toBeUndefined();
  });

  it("reads a daily repeat as every 1 day and keeps roles / named people", () => {
    const v = valuesFromTask({ ...TASK, recurring: true, recurrenceType: "DAILY", notifyRoleNames: ["Worker"] } as Task);
    expect(v).toMatchObject({ repeat: "EVERY_N_DAYS", intervalDays: "1", audience: "roles", roles: ["Worker"] });
  });
});

describe("dueFromEvent", () => {
  it("is the event day plus the offset, in local days", () => {
    expect(dueFromEvent(new Date(2026, 9, 26, 10, 0).toISOString(), 10)).toBe("2026-11-05");
  });
});
