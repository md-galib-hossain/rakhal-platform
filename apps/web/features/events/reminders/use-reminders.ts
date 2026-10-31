"use client"; // TanStack Query hooks

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { tasksApi } from "@/features/tasks/api";
import type { CreateTaskPayload, UpdateTaskPayload } from "@/features/tasks/types";
import { eventsApi } from "../api";

/** A reminder shows up in Next up (the animal's `cattle` queries), the Task Hub (`tasks`) and Health, so all are refreshed. */
function useRefresh() {
  const queryClient = useQueryClient();
  return () => {
    for (const key of ["cattle", "tasks", "health"]) void queryClient.invalidateQueries({ queryKey: [key] });
  };
}

export function useCreateReminder() {
  const refresh = useRefresh();
  return useMutation({ mutationFn: (dto: CreateTaskPayload) => tasksApi.create(dto), onSuccess: refresh });
}

export function useUpdateReminder() {
  const refresh = useRefresh();
  return useMutation({ mutationFn: ({ id, dto }: { id: string; dto: UpdateTaskPayload }) => tasksApi.update(id, dto), onSuccess: refresh });
}

export function useCancelReminder() {
  const refresh = useRefresh();
  return useMutation({ mutationFn: ({ id, reason }: { id: string; reason?: string }) => tasksApi.cancel(id, reason ? { notes: reason } : {}), onSuccess: refresh });
}

/** The animal's recent recorded events: the "N days after …" anchors (`GET /cattle/:id/events`, voided ones excluded). */
export function useAnchorEvents(cattleId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["cattle", "reminder-anchor-events", cattleId],
    queryFn: () => eventsApi.timeline(cattleId as string, { group: null, includeVoided: false }, undefined, 50),
    enabled: enabled && Boolean(cattleId),
    staleTime: 30_000,
    select: (page) => page.items.filter((e) => e.status === "ACTIVE"),
  });
}

export function useReminderTask(id: string | undefined) {
  return useQuery({
    queryKey: ["tasks", "detail", id],
    queryFn: () => tasksApi.get(id as string),
    enabled: Boolean(id),
    staleTime: 30_000,
  });
}
