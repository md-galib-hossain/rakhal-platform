"use client";

import { apiFetch, apiFetchPage } from "@/lib/api/client";
import type { CursorMeta, CursorPage } from "@/types/api";
import type {
  CancelTaskPayload,
  CompleteTaskPayload,
  CreateTaskPayload,
  Task,
  TaskAssigneeOption,
  TaskHighlights,
  TaskListFilters,
  UpdateTaskPayload,
} from "./types";

export type TaskListPage = CursorPage<Task> & { meta: CursorMeta & { highlights: TaskHighlights } };

/** `/tasks` — real backend routes (`task.controller.ts`), `task.*`-gated. */
export const tasksApi = {
  list(filters: TaskListFilters, cursor?: string, limit = 20): Promise<TaskListPage> {
    return apiFetchPage<Task>("/tasks", {
      searchParams: {
        filter: filters.filter,
        category: filters.category,
        priority: filters.priority,
        search: filters.search,
        cattleId: filters.cattleId,
        dueFrom: filters.dueFrom,
        dueTo: filters.dueTo,
        status: filters.status,
        recurring: filters.recurring,
        cursor,
        limit,
        sortOrder: filters.sortOrder ?? "asc",
      },
    }) as Promise<TaskListPage>;
  },
  get(id: string): Promise<Task> {
    return apiFetch<Task>(`/tasks/${id}`);
  },
  create(dto: CreateTaskPayload): Promise<Task> {
    return apiFetch<Task>("/tasks", { method: "POST", body: dto });
  },
  update(id: string, dto: UpdateTaskPayload): Promise<Task> {
    return apiFetch<Task>(`/tasks/${id}`, { method: "PATCH", body: dto });
  },
  complete(id: string, dto: CompleteTaskPayload): Promise<Task & { nextRecurrenceCreated: boolean; nextTaskId: string | null }> {
    return apiFetch(`/tasks/${id}/complete`, { method: "POST", body: dto });
  },
  /** `POST /tasks/:id/reopen` (`task.update`-gated) — undo a mistaken `complete()`. */
  reopen(id: string): Promise<Task> {
    return apiFetch<Task>(`/tasks/${id}/reopen`, { method: "POST" });
  },
  /** `POST /tasks/:id/cancel` (`task.update`-gated) — user-initiated abandonment, 400 from COMPLETED
   * or already-CANCELLED (RAKHAL-405). */
  cancel(id: string, dto: CancelTaskPayload): Promise<Task> {
    return apiFetch<Task>(`/tasks/${id}/cancel`, { method: "POST", body: dto });
  },
  remove(id: string): Promise<{ deleted: boolean }> {
    return apiFetch(`/tasks/${id}`, { method: "DELETE" });
  },
  /** `GET /settings/team` (`team.read`-gated) — same route `inventoryApi.teamMembersForMilkAudit`
   * hits, duplicated per this app's established feature-local siloing convention. Includes pending
   * invites in the raw response; only `status === "active"` rows are real assignable users. */
  teamMembers(): Promise<{ members: TaskAssigneeOption[] }> {
    return apiFetch<{ members: TaskAssigneeOption[] }>("/settings/team");
  },
};
