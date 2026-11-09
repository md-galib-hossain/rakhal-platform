"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useInfiniteCursorList } from "@/lib/hooks/use-infinite-cursor-list";
import { qk } from "@/lib/query/keys";
import { notificationsApi } from "../api";
import { toScheduleRequest } from "../schemas";
import type {
  CreateScheduleInput,
  ListSchedulesQuery,
  NotificationSchedule,
  UpdateScheduleInput,
} from "../types";

const PAGE_SIZE = 20;

/** A schedule change moves both the schedules lists and the Upcoming feed (occurrences are recomputed server-side). */
export function invalidateScheduleViews(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: qk.notifications.schedulesAll() });
  void queryClient.invalidateQueries({ queryKey: qk.notifications.upcomingAll() });
}

/** Cursor-paged USER schedules (`scope=mine` default; `farm` needs `notification.manage`). */
export function useSchedules(query: ListSchedulesQuery = {}, options: { enabled?: boolean } = {}) {
  const scope = query.scope ?? "mine";
  return useInfiniteCursorList<NotificationSchedule>(
    qk.notifications.schedules({ scope, status: query.status }),
    (cursor, limit) => notificationsApi.listSchedules({ ...query, scope }, cursor, limit),
    { pageSize: PAGE_SIZE, enabled: options.enabled, staleTime: 30_000 },
  );
}

export function useSchedule(id: string | null | undefined) {
  return useQuery({
    queryKey: qk.notifications.schedule(id ?? ""),
    queryFn: () => notificationsApi.getSchedule(id as string),
    enabled: !!id,
  });
}

/** Writes the fresh server copy into the detail cache so an open editor never shows the pre-mutation row. */
function cacheSchedule(queryClient: QueryClient, schedule: NotificationSchedule) {
  queryClient.setQueryData(qk.notifications.schedule(schedule.id), schedule);
}

export function useCreateSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateScheduleInput) => notificationsApi.createSchedule(toScheduleRequest(input)),
    onSuccess: (schedule) => {
      cacheSchedule(queryClient, schedule);
      invalidateScheduleViews(queryClient);
    },
  });
}

export function useUpdateSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateScheduleInput }) =>
      notificationsApi.updateSchedule(id, input),
    onSuccess: (schedule) => {
      cacheSchedule(queryClient, schedule);
      invalidateScheduleViews(queryClient);
    },
  });
}

export function usePauseSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationsApi.pauseSchedule(id),
    onSuccess: (schedule) => {
      cacheSchedule(queryClient, schedule);
      invalidateScheduleViews(queryClient);
    },
  });
}

export function useResumeSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationsApi.resumeSchedule(id),
    onSuccess: (schedule) => {
      cacheSchedule(queryClient, schedule);
      invalidateScheduleViews(queryClient);
    },
  });
}

export function useCancelSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationsApi.cancelSchedule(id),
    onSuccess: ({ id }) => {
      queryClient.removeQueries({ queryKey: qk.notifications.schedule(id) });
      invalidateScheduleViews(queryClient);
    },
  });
}

/**
 * `POST /notifications/schedules/preview` — the composer's live "this will send on …" line. A mutation (POST,
 * no write); the caller debounces and fires it when the draft changes, and reads `data`/`isPending`/`error`.
 */
export function usePreviewSchedule() {
  return useMutation({
    mutationFn: (input: CreateScheduleInput) => notificationsApi.previewSchedule(toScheduleRequest(input)),
  });
}
