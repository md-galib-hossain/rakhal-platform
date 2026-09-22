"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query/keys";
import { notificationsApi } from "../api";
import type { NotificationStatusFilter, UpdatePreferencesInput } from "../types";

/** RFE-043's own AC: "poll 60s" for the bell badge — no WebSocket/SSE channel exists yet. */
const BELL_POLL_MS = 60_000;

export function useNotifications(status: NotificationStatusFilter, page = 1, perPage = 20) {
  return useQuery({
    queryKey: qk.notifications.list(status, page),
    queryFn: () => notificationsApi.list(status, page, perPage),
    refetchInterval: BELL_POLL_MS,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications", "list"] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications", "list"] });
    },
  });
}

export function useNotificationPreferences() {
  return useQuery({
    queryKey: qk.notifications.preferences(),
    queryFn: () => notificationsApi.getPreferences(),
  });
}

export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdatePreferencesInput) => notificationsApi.updatePreferences(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.notifications.preferences() });
    },
  });
}
