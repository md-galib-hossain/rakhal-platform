import { addDays, format } from "date-fns";
import { z } from "zod";
import type { CreateTaskPayload, Task, UpdateTaskPayload } from "@/features/tasks/types";

/**
 * RFE-164 — custom reminder form model (03 §8.1). A reminder is a Task Hub task with `category: "REMINDER"`
 * (RAKHAL-487), so this file only maps the form to `CreateTaskDto` / `UpdateTaskDto` and back. Error messages in the
 * schema are `events.reminders.errors.*` keys, translated by the component.
 */

export const REMINDER_ROLES = ["Owner", "Manager", "Worker"] as const;
export const REMINDER_LEAD_DAYS = [0, 1, 3, 7] as const;
export const DEFAULT_REMINDER_TIME = "08:00";

export type ReminderWhen = "date" | "afterEvent";
export type ReminderRepeat = "NEVER" | "EVERY_N_DAYS" | "WEEKLY" | "MONTHLY";
export type ReminderAudience = "assignee" | "roles" | "people";

const animalSchema = z.object({ id: z.string(), tagNumber: z.string(), name: z.string().nullish() });
export type ReminderAnimal = z.infer<typeof animalSchema>;

const wholeDays = (min: number, max: number) =>
  z
    .string()
    .trim()
    .refine((v) => /^\d+$/.test(v) && Number(v) >= min && Number(v) <= max);

export const reminderSchema = z
  .object({
    title: z.string().trim().min(1, "titleRequired").max(200, "titleTooLong"),
    notes: z.string().trim().max(2000, "notesTooLong"),
    when: z.enum(["date", "afterEvent"]),
    date: z.string(),
    time: z.string(),
    offsetDays: z.string(),
    eventId: z.string(),
    repeat: z.enum(["NEVER", "EVERY_N_DAYS", "WEEKLY", "MONTHLY"]),
    intervalDays: z.string(),
    endDate: z.string(),
    leadDays: z.string(),
    audience: z.enum(["assignee", "roles", "people"]),
    assigneeId: z.string(),
    roles: z.array(z.string()),
    userIds: z.array(z.string()),
    animals: z.array(animalSchema),
  })
  .superRefine((v, ctx) => {
    const bad = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
    if (v.when === "date") {
      if (!v.date) bad("date", "dateRequired");
      if (v.time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(v.time)) bad("time", "timeInvalid");
    } else {
      if (v.animals.length !== 1) bad("animals", "oneAnimalForEvent");
      if (!v.eventId) bad("eventId", "eventRequired");
      if (!wholeDays(0, 3650).safeParse(v.offsetDays).success) bad("offsetDays", "offsetInvalid");
    }
    if (v.repeat === "EVERY_N_DAYS" && !wholeDays(1, 365).safeParse(v.intervalDays).success) bad("intervalDays", "intervalInvalid");
    if (v.repeat !== "NEVER" && v.endDate && v.when === "date" && v.date && v.endDate < v.date) bad("endDate", "endBeforeStart");
    if (v.audience === "assignee" && !v.assigneeId) bad("assigneeId", "assigneeRequired");
    if (v.audience === "roles" && v.roles.length === 0) bad("roles", "rolesRequired");
    if (v.audience === "people" && v.userIds.length === 0) bad("userIds", "peopleRequired");
  });

export type ReminderFormValues = z.infer<typeof reminderSchema>;

export function defaultReminderValues(opts: { today: string; assigneeId?: string; animal?: ReminderAnimal }): ReminderFormValues {
  return {
    title: "",
    notes: "",
    when: "date",
    date: opts.today,
    time: "",
    offsetDays: "10",
    eventId: "",
    repeat: "NEVER",
    intervalDays: "7",
    endDate: "",
    leadDays: "0",
    audience: "assignee",
    assigneeId: opts.assigneeId ?? "",
    roles: [],
    userIds: [],
    animals: opts.animal ? [opts.animal] : [],
  };
}

/** Local `YYYY-MM-DD` / `HH:mm` → the instant the farmer means (their clock, not UTC). */
export function localToIso(date: string, time: string): string {
  return new Date(`${date}T${time || DEFAULT_REMINDER_TIME}:00`).toISOString();
}

/** Where a reminder "N days after" an event will land — shown live so the farmer sees the real date before saving. */
export function dueFromEvent(eventAt: string, offsetDays: number): string {
  return format(addDays(new Date(eventAt), offsetDays), "yyyy-MM-dd");
}

function repeatFields(v: ReminderFormValues): Pick<CreateTaskPayload, "recurring" | "recurrenceType" | "recurrenceIntervalDays" | "recurrenceEndDate"> {
  if (v.repeat === "NEVER") return { recurring: false };
  return {
    recurring: true,
    recurrenceType: v.repeat,
    ...(v.repeat === "EVERY_N_DAYS" ? { recurrenceIntervalDays: Number(v.intervalDays) } : {}),
    ...(v.endDate ? { recurrenceEndDate: localToIso(v.endDate, "23:59") } : {}),
  };
}

function audienceFields(v: ReminderFormValues): Pick<CreateTaskPayload, "assignedToId" | "notifyRoleNames" | "recipientUserIds"> {
  if (v.audience === "assignee") return { assignedToId: v.assigneeId };
  if (v.audience === "roles") return { notifyRoleNames: v.roles };
  return { recipientUserIds: v.userIds };
}

export function buildCreatePayload(v: ReminderFormValues): CreateTaskPayload {
  const base: CreateTaskPayload = {
    name: v.title.trim(),
    ...(v.notes.trim() ? { details: v.notes.trim() } : {}),
    category: "REMINDER",
    ...(Number(v.leadDays) > 0 ? { remindDaysBefore: Number(v.leadDays) } : {}),
    ...repeatFields(v),
    ...audienceFields(v),
  };
  if (v.when === "afterEvent") {
    // The server takes the animal from the event, so no cattle fields go with a linked reminder.
    return { ...base, sourceEventId: v.eventId, offsetDays: Number(v.offsetDays) };
  }
  const animals = v.animals.map((a) => a.id);
  return {
    ...base,
    dueAt: localToIso(v.date, v.time),
    ...(animals.length === 1 ? { relatedCattleId: animals[0] } : animals.length > 1 ? { cattleIds: animals } : {}),
  };
}

/**
 * Edit: `PATCH /tasks/:id` cannot change the animals or the linked event, so only the rest is sent. An event-linked
 * reminder is rescheduled through `offsetDays` (it keeps following the event); a plain one through `dueAt`.
 */
export function buildUpdatePayload(v: ReminderFormValues, task: Pick<Task, "sourceEventId" | "reminderOffsetDays">): UpdateTaskPayload {
  const linked = isLinkedReminder(task);
  const repeat = repeatFields(v);
  return {
    name: v.title.trim(),
    details: v.notes.trim(),
    remindDaysBefore: Number(v.leadDays) > 0 ? Number(v.leadDays) : undefined,
    ...(linked ? { offsetDays: Number(v.offsetDays) } : { dueAt: localToIso(v.date, v.time) }),
    recurring: repeat.recurring,
    recurrenceType: repeat.recurrenceType,
    recurrenceIntervalDays: repeat.recurrenceIntervalDays,
    recurrenceEndDate: repeat.recurrenceEndDate,
    ...audienceFields(v),
  };
}

export function isLinkedReminder(task: Pick<Task, "sourceEventId" | "reminderOffsetDays">): boolean {
  return task.reminderOffsetDays != null && Boolean(task.sourceEventId);
}

/** Task → form values for the edit sheet. Daily repeats show as "every 1 day". */
export function valuesFromTask(task: Task): ReminderFormValues {
  const due = new Date(task.dueAt);
  const linked = isLinkedReminder(task);
  const roles = task.notifyRoleNames ?? [];
  const people = task.recipientUserIds ?? [];
  const repeat: ReminderRepeat = !task.recurring
    ? "NEVER"
    : task.recurrenceType === "WEEKLY" || task.recurrenceType === "MONTHLY"
      ? task.recurrenceType
      : "EVERY_N_DAYS";
  const animals = [
    ...(task.relatedCattle ? [task.relatedCattle] : []),
    ...task.cattleTags,
  ].map((c) => ({ id: c.id, tagNumber: c.tagNumber, name: c.name }));
  return {
    title: task.name,
    notes: task.details ?? "",
    when: linked ? "afterEvent" : "date",
    date: format(due, "yyyy-MM-dd"),
    time: format(due, "HH:mm") === DEFAULT_REMINDER_TIME ? "" : format(due, "HH:mm"),
    offsetDays: String(task.reminderOffsetDays ?? 10),
    eventId: task.sourceEventId ?? "",
    repeat,
    intervalDays: String(task.recurrenceType === "DAILY" ? 1 : (task.recurrenceIntervalDays ?? 7)),
    endDate: task.recurrenceEndDate ? format(new Date(task.recurrenceEndDate), "yyyy-MM-dd") : "",
    leadDays: String(task.remindDaysBefore ?? 0),
    audience: people.length > 0 ? "people" : roles.length > 0 ? "roles" : "assignee",
    assigneeId: task.assignedToId ?? "",
    roles,
    userIds: people,
    animals,
  };
}
