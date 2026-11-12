import { z } from "zod";
import {
  SCHEDULE_ANCHOR_TYPES,
  SCHEDULE_AUDIENCE_MODES,
  SCHEDULE_REPEAT_TYPES,
  SCHEDULE_TRIGGERS,
  type CreateScheduleInput,
} from "./types";

/**
 * Mirrors the backend `CreateNotificationScheduleDto` (RAKHAL-494). Every `message` is an i18n key under
 * the root translator (`t("notificationSheet.validation.…")`) — the composer (RFE-191) adds the copy.
 */
export const SCHEDULE_VALIDATION_KEYS = {
  titleRequired: "notificationSheet.validation.titleRequired",
  invalidDate: "notificationSheet.validation.invalidDate",
  invalidTime: "notificationSheet.validation.invalidTime",
  dateRequired: "notificationSheet.validation.dateRequired",
  anchorRequired: "notificationSheet.validation.anchorRequired",
  offsetRequired: "notificationSheet.validation.offsetRequired",
  intervalRequired: "notificationSheet.validation.intervalRequired",
  audienceRequired: "notificationSheet.validation.audienceRequired",
  tooManyLeads: "notificationSheet.validation.tooManyLeads",
  tooManyAnimals: "notificationSheet.validation.tooManyAnimals",
} as const;

const K = SCHEDULE_VALIDATION_KEYS;

export const MAX_TITLE = 120;
export const MAX_BODY = 1000;
export const MAX_LEADS = 4;
export const MAX_ANIMALS = 100;
export const MAX_AUDIENCE_USERS = 100;
export const MAX_OFFSET_DAYS = 3650;
export const MAX_LEAD_MINUTES = 90 * 24 * 60;

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const HM = /^([01]\d|2[0-3]):[0-5]\d$/;

export const scheduleSchema = z
  .object({
    title: z.string().trim().min(1, K.titleRequired).max(MAX_TITLE),
    body: z.string().trim().max(MAX_BODY).optional(),
    trigger: z.enum(SCHEDULE_TRIGGERS),
    date: z.string().regex(YMD, K.invalidDate).optional(),
    time: z.string().regex(HM, K.invalidTime).optional(),
    anchor: z.object({ type: z.enum(SCHEDULE_ANCHOR_TYPES), id: z.string().min(1).max(64) }).optional(),
    offset_days: z.number().int().min(0, K.offsetRequired).max(MAX_OFFSET_DAYS).optional(),
    repeat: z
      .object({
        type: z.enum(SCHEDULE_REPEAT_TYPES),
        interval: z.number().int().min(1).max(365).optional(),
        end_date: z.string().regex(YMD, K.invalidDate).optional(),
      })
      .optional(),
    lead_minutes: z.array(z.number().int().min(0).max(MAX_LEAD_MINUTES)).max(MAX_LEADS, K.tooManyLeads).optional(),
    audience: z.object({
      mode: z.enum(SCHEDULE_AUDIENCE_MODES),
      user_id: z.string().max(64).optional(),
      roles: z.array(z.string()).max(20).optional(),
      user_ids: z.array(z.string()).max(MAX_AUDIENCE_USERS).optional(),
    }),
    animal_ids: z.array(z.string()).max(MAX_ANIMALS, K.tooManyAnimals).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.trigger === "DATE") {
      if (!v.date) ctx.addIssue({ code: "custom", path: ["date"], message: K.dateRequired });
    } else {
      if (!v.anchor) ctx.addIssue({ code: "custom", path: ["anchor"], message: K.anchorRequired });
      if (v.offset_days === undefined) ctx.addIssue({ code: "custom", path: ["offset_days"], message: K.offsetRequired });
    }
    if (v.repeat?.type === "EVERY_N_DAYS" && v.repeat.interval === undefined) {
      ctx.addIssue({ code: "custom", path: ["repeat", "interval"], message: K.intervalRequired });
    }
    const a = v.audience;
    const ok =
      (a.mode === "USER" && !!a.user_id) ||
      (a.mode === "ROLES" && (a.roles?.length ?? 0) > 0) ||
      (a.mode === "USERS" && (a.user_ids?.length ?? 0) > 0);
    if (!ok) ctx.addIssue({ code: "custom", path: ["audience"], message: K.audienceRequired });
  });

/**
 * Shapes a validated draft into the wire body: keeps only the fields the chosen trigger / repeat / audience
 * mode uses (the backend ignores the rest, but a clean body keeps `PATCH` from overlaying stale values),
 * trims text and drops empty optionals. Pure — farm-local strings pass through untouched (no timezone math).
 */
export function toScheduleRequest(draft: CreateScheduleInput): CreateScheduleInput {
  const body = draft.body?.trim();
  const out: CreateScheduleInput = {
    title: draft.title.trim(),
    trigger: draft.trigger,
    audience: toAudience(draft.audience),
  };
  if (body) out.body = body;
  if (draft.time) out.time = draft.time;
  if (draft.trigger === "DATE") {
    if (draft.date) out.date = draft.date;
  } else {
    if (draft.anchor) out.anchor = { type: draft.anchor.type, id: draft.anchor.id };
    if (draft.offset_days !== undefined) out.offset_days = draft.offset_days;
  }
  if (draft.repeat && draft.repeat.type !== "NEVER") {
    out.repeat = { type: draft.repeat.type };
    if (draft.repeat.type === "EVERY_N_DAYS" && draft.repeat.interval !== undefined) {
      out.repeat.interval = draft.repeat.interval;
    }
    if (draft.repeat.end_date) out.repeat.end_date = draft.repeat.end_date;
  } else if (draft.repeat) {
    out.repeat = { type: "NEVER" };
  }
  if (draft.lead_minutes?.length) out.lead_minutes = [...new Set(draft.lead_minutes)].sort((a, b) => b - a);
  if (draft.animal_ids?.length) out.animal_ids = [...new Set(draft.animal_ids)];
  return out;
}

function toAudience(a: CreateScheduleInput["audience"]): CreateScheduleInput["audience"] {
  if (a.mode === "USER") return { mode: "USER", user_id: a.user_id };
  if (a.mode === "ROLES") return { mode: "ROLES", roles: [...new Set(a.roles ?? [])] };
  return { mode: "USERS", user_ids: [...new Set(a.user_ids ?? [])] };
}
