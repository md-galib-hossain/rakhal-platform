"use client";

import { apiFetch, apiFetchPage } from "@/lib/api/client";
import type { CursorPage } from "@/types/api";
import type {
  CancelScheduleResult,
  CreateScheduleInput,
  ListSchedulesQuery,
  NotificationSchedule,
  SchedulePreview,
  UpcomingItem,
  UpcomingQuery,
  UpdateScheduleInput,
  NotificationListResult,
  NotificationPreferencesResult,
  NotificationStatusFilter,
  TelegramConnectSessionResult,
  TelegramLinkTokenResult,
  TelegramStatusResult,
  UpdatePreferencesInput,
} from "./types";

/** `/notifications` — bell feed + preferences (PRD §20, RAKHAL-098/099). List/read/read-all need only
 * `notification.read` (every role, own bell); preferences write needs `notification.update`. */
export const notificationsApi = {
  list(status: NotificationStatusFilter, page: number, perPage: number): Promise<NotificationListResult> {
    return apiFetch<NotificationListResult>("/notifications", {
      searchParams: { status, page, per_page: perPage },
    });
  },
  markRead(id: string): Promise<{ id: string; read: boolean }> {
    return apiFetch<{ id: string; read: boolean }>(`/notifications/${id}/read`, { method: "POST" });
  },
  markAllRead(): Promise<{ updated: number }> {
    return apiFetch<{ updated: number }>("/notifications/read-all", { method: "POST" });
  },
  getPreferences(): Promise<NotificationPreferencesResult> {
    return apiFetch<NotificationPreferencesResult>("/notifications/preferences");
  },
  updatePreferences(input: UpdatePreferencesInput): Promise<NotificationPreferencesResult> {
    return apiFetch<NotificationPreferencesResult>("/notifications/preferences", {
      method: "PATCH",
      body: input,
    });
  },
  getTelegramConnectSession(): Promise<TelegramConnectSessionResult> {
    return apiFetch<TelegramConnectSessionResult>("/notifications/telegram/connect-session");
  },
  getTelegramLinkToken(): Promise<TelegramLinkTokenResult> {
    return apiFetch<TelegramLinkTokenResult>("/notifications/telegram/link-token");
  },
  getTelegramStatus(): Promise<TelegramStatusResult> {
    return apiFetch<TelegramStatusResult>("/notifications/telegram/status");
  },
  unlinkTelegram(): Promise<{ unlinked: boolean }> {
    return apiFetch<{ unlinked: boolean }>("/notifications/telegram/link", {
      method: "DELETE",
    });
  },

  // --- Notifications v2 (RAKHAL-494): manual schedules, preview, Upcoming -------------------------------------
  /** `GET /notifications/upcoming` — occurrences still to fire that target the caller; cursor paged. */
  upcoming(query: UpcomingQuery, cursor: string | undefined, limit: number): Promise<CursorPage<UpcomingItem>> {
    return apiFetchPage<UpcomingItem>("/notifications/upcoming", {
      searchParams: { from: query.from, to: query.to, sortOrder: query.sortOrder, cursor, limit },
    });
  },
  /** `GET /notifications/schedules` — USER schedules only (`scope=farm` needs `notification.manage`). */
  listSchedules(
    query: ListSchedulesQuery,
    cursor: string | undefined,
    limit: number,
  ): Promise<CursorPage<NotificationSchedule>> {
    return apiFetchPage<NotificationSchedule>("/notifications/schedules", {
      searchParams: { scope: query.scope, status: query.status, cursor, limit },
    });
  },
  getSchedule(id: string): Promise<NotificationSchedule> {
    return apiFetch<NotificationSchedule>(`/notifications/schedules/${id}`);
  },
  createSchedule(input: CreateScheduleInput): Promise<NotificationSchedule> {
    return apiFetch<NotificationSchedule>("/notifications/schedules", { method: "POST", body: input });
  },
  updateSchedule(id: string, input: UpdateScheduleInput): Promise<NotificationSchedule> {
    return apiFetch<NotificationSchedule>(`/notifications/schedules/${id}`, { method: "PATCH", body: input });
  },
  pauseSchedule(id: string): Promise<NotificationSchedule> {
    return apiFetch<NotificationSchedule>(`/notifications/schedules/${id}/pause`, { method: "POST" });
  },
  resumeSchedule(id: string): Promise<NotificationSchedule> {
    return apiFetch<NotificationSchedule>(`/notifications/schedules/${id}/resume`, { method: "POST" });
  },
  cancelSchedule(id: string): Promise<CancelScheduleResult> {
    return apiFetch<CancelScheduleResult>(`/notifications/schedules/${id}`, { method: "DELETE" });
  },
  /** `POST /notifications/schedules/preview` — same body as create, no write; farm-local next fires + recipient count. */
  previewSchedule(input: CreateScheduleInput): Promise<SchedulePreview> {
    return apiFetch<SchedulePreview>("/notifications/schedules/preview", { method: "POST", body: input });
  },
};
