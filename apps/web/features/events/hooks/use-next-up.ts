"use client"; // TanStack Query hooks

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { tasksApi } from "@/features/tasks/api";

/**
 * Snooze and Skip for a Next-up row. Both use the existing Task Hub endpoints (no new routes): snooze reschedules the
 * task (`PATCH /tasks/:id { dueAt }`), skip cancels it with the reason as its note (`POST /tasks/:id/cancel { notes }`).
 * Either way the animal's upcoming list and the Task Hub are refetched, so the row disappears or reappears on its new day.
 */
export function useNextUpActions() {
  const queryClient = useQueryClient();
  const refresh = () => {
    for (const key of ["cattle", "tasks", "health"]) void queryClient.invalidateQueries({ queryKey: [key] });
  };
  const snooze = useMutation({
    mutationFn: ({ taskId, dueAt }: { taskId: string; dueAt: string }) => tasksApi.update(taskId, { dueAt }),
    onSuccess: refresh,
  });
  const skip = useMutation({
    mutationFn: ({ taskId, reason }: { taskId: string; reason?: string }) => tasksApi.cancel(taskId, reason ? { notes: reason } : {}),
    onSuccess: refresh,
  });
  return { snooze, skip };
}
