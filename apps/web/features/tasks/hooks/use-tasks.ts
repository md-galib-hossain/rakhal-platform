"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query/keys";
import { useCursorPager } from "@/lib/hooks/use-cursor-pager";
import { useInfiniteCursorList } from "@/lib/hooks/use-infinite-cursor-list";
import { tasksApi } from "../api";
import type { CancelTaskPayload, CompleteTaskPayload, CreateTaskPayload, ReminderHighlights, TaskHighlights, TaskListFilters, UpdateTaskPayload } from "../types";

const STALE_TIME = 30_000;

const EMPTY_HIGHLIGHTS: TaskHighlights = { dueToday: 0, overdue: 0, blocked: 0, lateCompletionRatePct: 0 };
const EMPTY_REMINDER_HIGHLIGHTS: ReminderHighlights = { upcoming: 0, overdue: 0, repeating: 0 };

/** Shared-pager adapter (`useCursorPager`) over the cursor-only `GET /tasks`. `meta.highlights` is
 * farm-wide (not scoped to the current page/filter), returned by every page fetch. */
export function useTaskPagedList(filters: TaskListFilters) {
  const pager = useCursorPager(
    qk.tasks.list(filters as Record<string, string | undefined>),
    (cursor, limit) => tasksApi.list(filters, cursor, limit),
    { staleTime: STALE_TIME },
  );
  return { ...pager, highlights: pager.meta?.highlights ?? EMPTY_HIGHLIGHTS };
}

/** Append-forever variant (infinite scroll) of `useTaskPagedList`. `highlights` comes from the
 * first page's meta — farm-wide and refreshed on every invalidation. */
export function useTaskInfiniteList(filters: TaskListFilters) {
  const list = useInfiniteCursorList(
    qk.tasks.list(filters as Record<string, string | undefined>),
    (cursor, limit) => tasksApi.list(filters, cursor, limit),
    { staleTime: STALE_TIME },
  );
  return {
    ...list,
    highlights: list.meta?.highlights ?? EMPTY_HIGHLIGHTS,
    reminderHighlights: list.meta?.reminderHighlights ?? EMPTY_REMINDER_HIGHLIGHTS,
  };
}

export function useTaskAssignees() {
  return useQuery({
    queryKey: qk.tasks.teamMembers(),
    queryFn: () => tasksApi.teamMembers(),
    staleTime: 60_000,
    select: (data) => data.members.filter((m) => m.status === "active"),
  });
}

function useInvalidateTasks() {
  const queryClient = useQueryClient();
  // A task/reminder also drives an animal's Next up (`cattle`), Health and the dashboard, so all are refreshed.
  return () => {
    void queryClient.invalidateQueries({ queryKey: ["tasks", "list"] });
    // Single-task reads (Next up's reminder edit) must not serve a stale row after an edit/complete/cancel.
    void queryClient.invalidateQueries({ queryKey: ["tasks", "detail"] });
    for (const key of ["cattle", "health", "dashboard"]) void queryClient.invalidateQueries({ queryKey: [key] });
  };
}

export function useCreateTask() {
  const invalidate = useInvalidateTasks();
  return useMutation({
    mutationFn: (dto: CreateTaskPayload) => tasksApi.create(dto),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateTask() {
  const invalidate = useInvalidateTasks();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateTaskPayload }) => tasksApi.update(id, dto),
    onSuccess: () => invalidate(),
  });
}

export function useCompleteTask() {
  const invalidate = useInvalidateTasks();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: CompleteTaskPayload }) => tasksApi.complete(id, dto),
    onSuccess: () => invalidate(),
  });
}

export function useReopenTask() {
  const invalidate = useInvalidateTasks();
  return useMutation({
    mutationFn: (id: string) => tasksApi.reopen(id),
    onSuccess: () => invalidate(),
  });
}

export function useCancelTask() {
  const invalidate = useInvalidateTasks();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: CancelTaskPayload }) => tasksApi.cancel(id, dto),
    onSuccess: () => invalidate(),
  });
}

export function useDeleteTask() {
  const invalidate = useInvalidateTasks();
  return useMutation({
    mutationFn: (id: string) => tasksApi.remove(id),
    onSuccess: () => invalidate(),
  });
}
