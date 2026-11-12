import { z } from "zod";
import type {
  CreateScheduleInput,
  NotificationSchedule,
  ScheduleAnchor,
  ScheduleRepeatType,
  UpdateScheduleInput,
} from "./types";
import { MAX_ANIMALS, MAX_AUDIENCE_USERS, MAX_BODY, MAX_LEADS, MAX_OFFSET_DAYS, MAX_TITLE, toScheduleRequest } from "./schemas";

/**
 * RFE-191 (NV2-F04) — manual notification composer model. The form speaks farm-local strings only
 * (`YYYY-MM-DD`, `HH:mm`); the server owns every UTC conversion (`POST /notifications/schedules/preview` shows the
 * result). Schema messages are keys under `notificationSheet.compose.errors`, translated by the component.
 */

export const COMPOSER_ROLES = ["Owner", "Manager", "Worker"] as const;
/** Lead chips in minutes before the moment. 60 needs a time (an all-day notice only moves in whole days). */
export const LEAD_MINUTES_OPTIONS = [0, 60, 1440, 10080] as const;
export const DEFAULT_TIMED_TIME = "09:00";

export type ComposerWhen = "date" | "before" | "after";
export type ComposerAudience = "me" | "roles" | "people";

export interface ComposerAnimal {
  id: string;
  tagNumber: string;
  name?: string | null;
}

/** What a caller (animal workspace, task, health step — F06) hands the composer: the thing the notice is relative to. */
export interface ComposerAnchor extends ScheduleAnchor {
  /** Human label shown in the form, e.g. "Insemination · COW-12". */
  label: string;
}

const HM = /^([01]\d|2[0-3]):[0-5]\d$/;
const YMD = /^\d{4}-\d{2}-\d{2}$/;

const wholeNumber = (min: number, max: number) => (v: string) =>
  /^\d+$/.test(v.trim()) && Number(v) >= min && Number(v) <= max;

export const composerSchema = z
  .object({
    title: z.string().trim().min(1, "titleRequired").max(MAX_TITLE, "titleTooLong"),
    notes: z.string().trim().max(MAX_BODY, "notesTooLong"),
    when: z.enum(["date", "before", "after"]),
    date: z.string(),
    allDay: z.boolean(),
    time: z.string(),
    offsetDays: z.string(),
    repeat: z.enum(["NEVER", "EVERY_N_DAYS", "WEEKLY", "MONTHLY"]),
    intervalDays: z.string(),
    endDate: z.string(),
    leads: z.array(z.number().int().min(0)).max(MAX_LEADS, "tooManyLeads"),
    audience: z.enum(["me", "roles", "people"]),
    roles: z.array(z.string()),
    userIds: z.array(z.string()).max(MAX_AUDIENCE_USERS, "tooManyPeople"),
    animals: z.array(z.object({ id: z.string(), tagNumber: z.string(), name: z.string().nullish() })).max(MAX_ANIMALS, "tooManyAnimals"),
  })
  .superRefine((v, ctx) => {
    const bad = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
    if (v.when === "date") {
      if (!YMD.test(v.date)) bad("date", "dateRequired");
    } else if (!wholeNumber(0, MAX_OFFSET_DAYS)(v.offsetDays)) {
      bad("offsetDays", "offsetInvalid");
    }
    if (!v.allDay && !HM.test(v.time)) bad("time", "timeInvalid");
    if (v.repeat === "EVERY_N_DAYS" && !wholeNumber(1, 365)(v.intervalDays)) bad("intervalDays", "intervalInvalid");
    if (v.repeat !== "NEVER" && v.endDate) {
      if (!YMD.test(v.endDate)) bad("endDate", "dateRequired");
      else if (v.when === "date" && v.date && v.endDate < v.date) bad("endDate", "endBeforeStart");
    }
    if (v.leads.length === 0) bad("leads", "leadRequired");
    if (v.allDay && v.leads.some((m) => m % 1440 !== 0)) bad("leads", "leadNeedsTime");
    if (v.audience === "roles" && v.roles.length === 0) bad("roles", "rolesRequired");
    if (v.audience === "people" && v.userIds.length === 0) bad("userIds", "peopleRequired");
  });

export type ComposerValues = z.infer<typeof composerSchema>;

export function defaultComposerValues(opts: { today: string; anchor?: ComposerAnchor | null; animal?: ComposerAnimal }): ComposerValues {
  return {
    title: "",
    notes: "",
    when: opts.anchor ? "before" : "date",
    date: opts.today,
    allDay: true,
    time: DEFAULT_TIMED_TIME,
    offsetDays: opts.anchor ? "1" : "0",
    repeat: "NEVER",
    intervalDays: "7",
    endDate: "",
    leads: [0],
    audience: "me",
    roles: [],
    userIds: [],
    animals: opts.animal ? [opts.animal] : [],
  };
}

/** Lead chips that are valid for the current time mode. */
export function leadOptions(allDay: boolean): number[] {
  return LEAD_MINUTES_OPTIONS.filter((m) => !allDay || m % 1440 === 0);
}

/** Switching to "All day" drops the chips an all-day notice cannot use (never leaves it empty). */
export function leadsForAllDay(leads: number[], allDay: boolean): number[] {
  if (!allDay) return leads;
  const kept = leads.filter((m) => m % 1440 === 0);
  return kept.length ? kept : [0];
}

export function toggleLead(leads: number[], minutes: number): number[] {
  if (leads.includes(minutes)) return leads.filter((m) => m !== minutes);
  return [...leads, minutes].sort((a, b) => b - a);
}

/** A Worker can only notify themself; roles / people need `notification.manage`. */
export function allowedAudiences(canManage: boolean): ComposerAudience[] {
  return canManage ? ["me", "roles", "people"] : ["me"];
}

export interface BuildContext {
  meId: string;
  canManage: boolean;
  anchor?: ComposerAnchor | null;
}

/** Form → `POST /notifications/schedules` (and `/preview`) body. Pure: farm-local strings pass straight through. */
export function buildScheduleRequest(v: ComposerValues, ctx: BuildContext): CreateScheduleInput {
  const audience: ComposerAudience = ctx.canManage ? v.audience : "me";
  const repeatType: ScheduleRepeatType = v.repeat;
  const draft: CreateScheduleInput = {
    title: v.title,
    body: v.notes,
    trigger: v.when === "date" ? "DATE" : v.when === "before" ? "BEFORE_EVENT" : "AFTER_EVENT",
    audience:
      audience === "me"
        ? { mode: "USER", user_id: ctx.meId }
        : audience === "roles"
          ? { mode: "ROLES", roles: v.roles }
          : { mode: "USERS", user_ids: v.userIds },
    lead_minutes: v.leads,
    repeat: {
      type: repeatType,
      ...(repeatType === "EVERY_N_DAYS" ? { interval: Number(v.intervalDays) } : {}),
      ...(repeatType !== "NEVER" && v.endDate ? { end_date: v.endDate } : {}),
    },
    animal_ids: v.animals.map((a) => a.id),
  };
  if (!v.allDay) draft.time = v.time;
  if (v.when === "date") {
    draft.date = v.date;
  } else {
    if (ctx.anchor) draft.anchor = { type: ctx.anchor.type, id: ctx.anchor.id };
    draft.offset_days = Number(v.offsetDays);
  }
  return toScheduleRequest(draft);
}

/** PATCH body: the same fields, plus an explicit `time: null` when the notice is all-day (an omitted time keeps the old one). */
export type ComposerUpdateBody = Omit<UpdateScheduleInput, "time"> & { time?: string | null };

export function buildUpdateRequest(v: ComposerValues, ctx: BuildContext): ComposerUpdateBody {
  const body: ComposerUpdateBody = buildScheduleRequest(v, ctx);
  if (v.allDay) body.time = null;
  return body;
}

/** Saved schedule → form values for edit. A single-person audience that is not you shows as "people". */
export function valuesFromSchedule(s: NotificationSchedule, meId: string): ComposerValues {
  const mode = s.audience.mode;
  const solo = mode === "USER" && s.audience.user_ids.length === 1 && s.audience.user_ids[0] === meId;
  return {
    title: s.title,
    notes: s.body ?? "",
    when: s.trigger === "DATE" ? "date" : s.trigger === "BEFORE_EVENT" ? "before" : "after",
    date: s.date ?? "",
    allDay: s.all_day,
    time: s.time ?? DEFAULT_TIMED_TIME,
    offsetDays: String(s.offset_days ?? 0),
    repeat: s.repeat.type,
    intervalDays: String(s.repeat.interval ?? 7),
    endDate: s.repeat.end_date ?? "",
    leads: s.lead_minutes.length ? [...s.lead_minutes] : [0],
    audience: mode === "ROLES" ? "roles" : solo ? "me" : "people",
    roles: s.audience.roles,
    userIds: mode === "ROLES" || solo ? [] : s.audience.user_ids,
    // The view carries ids only; the picker shows these as "N animals" until the user re-picks.
    animals: s.animal_ids.map((id) => ({ id, tagNumber: "", name: null })),
  };
}

export function anchorFromSchedule(s: NotificationSchedule): ComposerAnchor | null {
  return s.anchor ? { ...s.anchor, label: "" } : null;
}

const FIELD_ALIASES: Record<string, keyof ComposerValues> = {
  title: "title",
  body: "notes",
  date: "date",
  time: "time",
  offset_days: "offsetDays",
  lead_minutes: "leads",
  animal_ids: "animals",
  audience: "userIds",
  "repeat.interval": "intervalDays",
  "repeat.end_date": "endDate",
  repeat: "repeat",
  anchor: "offsetDays",
};

/** Server 400/422 `details` (`{ field: message | message[] }`, nested keys flattened with dots) → form fields. Unknown keys are dropped. */
export function mapServerFieldErrors(details: Record<string, unknown> | undefined): Array<{ field: keyof ComposerValues; message: string }> {
  if (!details) return [];
  const out: Array<{ field: keyof ComposerValues; message: string }> = [];
  for (const [key, raw] of Object.entries(details)) {
    const field = FIELD_ALIASES[key] ?? FIELD_ALIASES[key.split(".")[0]];
    const message = Array.isArray(raw) ? raw.find((m) => typeof m === "string") : raw;
    if (field && typeof message === "string") out.push({ field, message });
  }
  return out;
}
