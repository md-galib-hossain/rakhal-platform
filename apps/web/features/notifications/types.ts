/** `GET /notifications` row (`notification.service.ts#list` — `type` is really the event's
 * `category`, kept as `type` to match the wire field name). */
export interface NotificationListItem {
  id: string;
  type: string;
  priority: "critical" | "high" | "medium" | "low";
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  created_at: string;
}

export interface NotificationListResult {
  unread_count: number;
  notifications: NotificationListItem[];
  meta: { page: number; per_page: number; total: number };
}

export type NotificationStatusFilter = "unread" | "all";

/** `GET /notifications/preferences` — `NOTIFICATION_EVENTS` catalogue (PRD §20.2) merged with the
 * user's own per-event overrides. `label` is the backend's English catalogue label — no per-event
 * i18n catalogue exists on the frontend, mirrored as-is like RFE-048's `SupportCategory`. */
export interface NotificationChannels {
  in_app: boolean;
  push: boolean;
  sms: boolean;
  whatsapp: boolean;
  telegram: boolean;
  email: boolean;
}

export type NotificationCategory =
  | "health_safety"
  | "reproduction"
  | "operational"
  | "financial"
  | "inventory";

export interface NotificationPreferenceItem {
  event_key: string;
  label: string;
  category: NotificationCategory;
  can_disable: boolean;
  enabled: boolean;
  channels: NotificationChannels;
}

export interface QuietHours {
  start: string | null;
  end: string | null;
}

export interface NotificationPreferencesResult {
  quiet_hours: QuietHours;
  preferences: NotificationPreferenceItem[];
}

/** `PATCH /notifications/preferences` body. */
export interface UpdatePreferencesInput {
  quiet_hours?: { start: string; end: string };
  preferences?: Array<{
    event_key: string;
    enabled?: boolean;
    channels?: NotificationChannels;
  }>;
}

export interface TelegramLinkTokenResult {
  configured: boolean;
  deepLink: string | null;
}

export interface TelegramConnectSessionResult {
  configured: boolean;
  botUsername: string | null;
  code: string | null;
  expiresIn: number;
  deepLink: string | null;
  qrPayload: string | null;
}

export interface TelegramStatusResult {
  configured: boolean;
  linked: boolean;
  count: number;
  chats?: Array<{ id: string; createdAt: string }>;
}


// ---------------------------------------------------------------------------------------------------------------
// Notifications v2 — manual schedules, preview and Upcoming (RAKHAL-494, `docs/EPIC_NOTIFICATIONS_V2.md` §4).
// Typed from `notification-schedule.controller.ts` + `create-notification-schedule.dto.ts` + the service views.
// Dates/times are farm-local strings (`YYYY-MM-DD`, `HH:mm`) — never UTC instants built in the browser.
// ---------------------------------------------------------------------------------------------------------------

export const SCHEDULE_TRIGGERS = ["DATE", "BEFORE_EVENT", "AFTER_EVENT"] as const;
export type ScheduleTrigger = (typeof SCHEDULE_TRIGGERS)[number];

export const SCHEDULE_ANCHOR_TYPES = ["ANIMAL_EVENT", "TASK", "HEALTH_STEP"] as const;
export type ScheduleAnchorType = (typeof SCHEDULE_ANCHOR_TYPES)[number];

export const SCHEDULE_REPEAT_TYPES = ["NEVER", "EVERY_N_DAYS", "WEEKLY", "MONTHLY"] as const;
export type ScheduleRepeatType = (typeof SCHEDULE_REPEAT_TYPES)[number];

export const SCHEDULE_AUDIENCE_MODES = ["USER", "ROLES", "USERS"] as const;
export type ScheduleAudienceMode = (typeof SCHEDULE_AUDIENCE_MODES)[number];

export const SCHEDULE_STATUSES = ["ACTIVE", "PAUSED", "DONE", "CANCELLED"] as const;
export type ScheduleStatus = (typeof SCHEDULE_STATUSES)[number];

export type ScheduleOrigin = "USER" | "SYSTEM";

export interface ScheduleAnchor {
  type: ScheduleAnchorType;
  id: string;
}

export interface ScheduleRepeatInput {
  type: ScheduleRepeatType;
  /** EVERY_N_DAYS only (1..365). */
  interval?: number;
  /** Inclusive farm-local `YYYY-MM-DD`. */
  end_date?: string;
}

export interface ScheduleAudienceInput {
  mode: ScheduleAudienceMode;
  /** mode USER. */
  user_id?: string;
  /** mode ROLES — role names. */
  roles?: string[];
  /** mode USERS (max 100). */
  user_ids?: string[];
}

/** `POST /notifications/schedules` and `/preview` body; `PATCH` takes any subset (`UpdateScheduleInput`). */
export interface CreateScheduleInput {
  title: string;
  body?: string;
  trigger: ScheduleTrigger;
  /** DATE only. */
  date?: string;
  /** With a time the notice is exact-minute; without, it is all-day (08:00). */
  time?: string;
  /** BEFORE_EVENT / AFTER_EVENT only. */
  anchor?: ScheduleAnchor;
  /** BEFORE_EVENT / AFTER_EVENT only, 0..3650. */
  offset_days?: number;
  repeat?: ScheduleRepeatInput;
  /** Minutes before the anchor (max 4, each <= 90 days). Server default `[0]`. */
  lead_minutes?: number[];
  audience: ScheduleAudienceInput;
  /** Max 100. */
  animal_ids?: string[];
}

export type UpdateScheduleInput = Partial<CreateScheduleInput>;

/** `GET /notifications/schedules[/:id]`, create/update/pause/resume response (`NotificationScheduleService#view`).
 * Note: the view's `audience` carries `user_ids` for every mode (mode USER = a one-element list); it has no `user_id`. */
export interface NotificationSchedule {
  id: string;
  title: string;
  body: string | null;
  status: ScheduleStatus;
  trigger: ScheduleTrigger;
  date: string | null;
  time: string | null;
  all_day: boolean;
  anchor: ScheduleAnchor | null;
  offset_days: number | null;
  repeat: { type: ScheduleRepeatType; interval: number | null; end_date: string | null };
  lead_minutes: number[];
  audience: { mode: ScheduleAudienceMode; user_ids: string[]; roles: string[] };
  animal_ids: string[];
  created_by: string;
  next_fire_at: string | null;
  created_at: string;
  can_edit: boolean;
}

export interface CancelScheduleResult {
  id: string;
  status: "CANCELLED";
}

export interface SchedulePreviewFire {
  /** UTC ISO instant. */
  fire_at: string;
  /** Farm-local `YYYY-MM-DDTHH:mm`. */
  local: string;
  lead_minutes: number;
}

/** `POST /notifications/schedules/preview` — the next 5 fires in farm-local time; no write. */
export interface SchedulePreview {
  timezone: string;
  all_day: boolean;
  next_fire_times: SchedulePreviewFire[];
  recipient_count: number;
}

export interface ListSchedulesQuery {
  scope?: "mine" | "farm";
  status?: ScheduleStatus;
}

/** `GET /notifications/upcoming` row. `repeat` is the schedule's repeat type (`NONE` is normalised to `NEVER`). */
export interface UpcomingItem {
  occurrence_id: string;
  schedule_id: string;
  /** UTC ISO instant. */
  fire_at: string;
  /** Farm-local `YYYY-MM-DDTHH:mm`. */
  fire_at_local: string;
  title: string;
  body: string | null;
  origin: ScheduleOrigin;
  category: string;
  priority: string;
  link: string | null;
  animals_count: number;
  repeat: ScheduleRepeatType;
  can_edit: boolean;
}

export interface UpcomingQuery {
  /** Farm-local `YYYY-MM-DD`; server default today. */
  from?: string;
  /** Farm-local `YYYY-MM-DD`; server default from+14 days, max window 90 days. */
  to?: string;
  sortOrder?: "asc" | "desc";
}
