"use client";

import { apiFetch } from "@/lib/api/client";
import type {
  NotificationListResult,
  NotificationPreferencesResult,
  NotificationStatusFilter,
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
};
