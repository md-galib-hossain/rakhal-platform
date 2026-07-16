"use client";

import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query/keys";
import { tasksApi } from "../api";
import type { CompleteTaskPayload, CreateTaskPayload, TaskHighlights, TaskListFilters, UpdateTaskPayload } from "../types";

const STALE_TIME = 30_000;

interface PagerState {
  filtersKey: string;
  pageIndex: number;
  cursors: (string | undefined)[];
}

function initialPagerState(filtersKey: string): PagerState {
  return { filtersKey, pageIndex: 0, cursors: [undefined] };
}

const EMPTY_HIGHLIGHTS: TaskHighlights = { dueToday: 0, overdue: 0, blocked: 0, lateCompletionRatePct: 0 };

/** Same honest-frontier numbered-page adapter as `useActivityPagedList`/`useSickBayPagedList`, over
 * the cursor-only `GET /tasks` — the backend never returns a total/offset, so `totalPages` only ever
 * grows by 1 as the user actually pages past the discovered frontier. `meta.highlights` is farm-wide
 * (not scoped to the current page/filter), returned by every page fetch. */
export function useTaskPagedList(filters: TaskListFilters) {
  const filtersKey = JSON.stringify(filters);
  const [state, setState] = useState<PagerState>(() => initialPagerState(filtersKey));
  if (state.filtersKey !== filtersKey) {
    setState(initialPagerState(filtersKey));
  }

  const { pageIndex, cursors } = state;
  const cursor = cursors[pageIndex];

  const query = useQuery({
    queryKey: [...qk.tasks.list(filters as Record<string, string | undefined>), cursor],
    queryFn: () => tasksApi.list(filters, cursor),
    staleTime: STALE_TIME,
    placeholderData: keepPreviousData,
  });

  const atFrontier = pageIndex === cursors.length - 1;
  const hasUndiscoveredNext = atFrontier && Boolean(query.data?.meta.hasNextPage);
  const totalPages = Math.max(cursors.length + (hasUndiscoveredNext ? 1 : 0), 1);

  function goToPage(page: number) {
    const idx = page - 1;
    if (idx < 0 || idx === pageIndex) return;
    if (idx < cursors.length) {
      setState((s) => ({ ...s, pageIndex: idx }));
      return;
    }
    if (idx === cursors.length && hasUndiscoveredNext) {
      const nextCursor = query.data?.meta.endCursor ?? undefined;
      setState((s) => ({ ...s, pageIndex: idx, cursors: [...s.cursors, nextCursor] }));
    }
  }

  return {
    items: query.data?.items ?? [],
    highlights: query.data?.meta.highlights ?? EMPTY_HIGHLIGHTS,
    page: pageIndex + 1,
    totalPages,
    isLoading: query.isLoading,
    isError: query.isError,
    isFetching: query.isFetching,
    refetch: query.refetch,
    goToPage,
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
  return () => void queryClient.invalidateQueries({ queryKey: ["tasks", "list"] });
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

export function useCheckTaskStep() {
  const invalidate = useInvalidateTasks();
  return useMutation({
    mutationFn: ({ id, stepId, completed }: { id: string; stepId: string; completed: boolean }) =>
      tasksApi.checkStep(id, stepId, completed),
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
