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

