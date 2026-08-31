/** Mirrors the backend `TaskCategory` Prisma enum (`task.enums.prisma`). */
export type TaskCategory = "FEEDING" | "HEALTHCARE" | "BREEDING" | "MAINTENANCE" | "MILKING" | "CALF_CARE" | "GENERAL";

export type TaskPriority = "HIGH" | "MEDIUM" | "LOW";

/** Stored status. `displayStatus` below is the derived, presentation-ready value (PRD §17) — a
 * non-completed task past its due date always reads as "overdue" regardless of this field. */
export type TaskStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "BLOCKED" | "CANCELLED";

export type TaskDisplayStatus = "pending" | "in_progress" | "completed" | "blocked" | "cancelled" | "overdue";

export type TaskSource = "MANUAL" | "HEALTH_PLAN" | "SYSTEM_AUTO";

export type TaskRecurrence = "DAILY" | "WEEKLY" | "MONTHLY";

export type TaskListFilter = "my_tasks" | "all" | "overdue" | "blocked";

/** `GET /tasks` row / `GET /tasks/:id`, as presented by `TaskService#present`. */
export interface Task {
  id: string;
  reference: string;
  name: string;
  details: string | null;
  category: TaskCategory;
  priority: TaskPriority;
  status: TaskStatus;
  displayStatus: TaskDisplayStatus;
  scheduledAt: string | null;
  dueAt: string;
  overdueByHours: number | null;
  recurring: boolean;
  recurrenceType: TaskRecurrence | null;
  recurrenceEndDate: string | null;
  safetyCritical: boolean;
  source: TaskSource;
  /** Present on `SYSTEM_AUTO` tasks only (e.g. a repro-protocol step) — the domain event that
   * created this task, paired with `sourceEventId`. Raw pass-through from `TaskService#present`'s
   * `...task` spread (Prisma column), not previously typed. */
  sourceEventType: string | null;
  sourceEventId: string | null;
  /** Single-cow target — set for a system-generated task or a manual single-cow task. Null when
   * the task targets multiple cows (see `cattleIds`) or none at all. */
  relatedCattleId: string | null;
  /** Multi-cow target (user request, no ticket #) — always an array, empty when the task has no
   * cow target or uses `relatedCattleId` instead. */
  cattleIds: string[];
  /** Cow-name display (user request, no ticket #) — `relatedCattleId` joined to its tag/name by
   * the backend. Null when there's no single-cow target, or that cow no longer exists. */
  relatedCattle: { id: string; tagNumber: string; name: string | null } | null;
  /** Same join as `relatedCattle`, for `cattleIds` — may be shorter than `cattleIds` if a cow was
   * deleted since the task was created. */
  cattleTags: { id: string; tagNumber: string; name: string | null }[];
  /** Activity/history section (user request, no ticket #) — oldest first. `"CREATED"` is always
   * the first entry, synthesized by the backend from `createdBy`/`createdAt` (never a stored row). */
  history: {
    id: string;
    action: "CREATED" | "UPDATED" | "COMPLETED" | "REOPENED" | "CANCELLED";
    actorId: string | null;
    actorName: string | null;
    note: string | null;
    createdAt: string;
  }[];
  assignedToId: string | null;
  assignedTo: { id: string; name: string } | null;
  completionPhotoUrl: string | null;
  completedById: string | null;
  completedAt: string | null;
  completionNote: string | null;
  cancelledAt: string | null;
  cancelledById: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/** `meta.highlights` on `GET /tasks` (`TaskService#highlights`) — farm-wide, not scoped to the
 * current filter/page. */
export interface TaskHighlights {
  dueToday: number;
  overdue: number;
  blocked: number;
  lateCompletionRatePct: number;
}

export type TaskDatePreset = "today" | "week" | "month" | "all";

export interface TaskListFilters {
  filter?: TaskListFilter;
  category?: TaskCategory;
  priority?: TaskPriority;
  search?: string;
  /** Per-animal Task Hub view (unified animal-profile redesign, no ticket #) — filters on
   * `Task.relatedCattleId` server-side. */
  cattleId?: string;
  /** Date filter tabs (user request, no ticket #) — `dueAt` range, ISO date strings. Mirrors
   * `ListTaskQueryDto.dueFrom`/`.dueTo` (inclusive start / exclusive end). */
  dueFrom?: string;
  dueTo?: string;
}

/** Mirrors `CreateTaskDto`. */
export interface CreateTaskPayload {
  name: string;
  details?: string;
  category?: TaskCategory;
  priority?: TaskPriority;
  scheduledAt?: string;
  dueAt: string;
  assignedToId?: string;
  recurring?: boolean;
  recurrenceType?: TaskRecurrence;
  recurrenceEndDate?: string;
  safetyCritical?: boolean;
  /** Mutually exclusive with `cattleIds` — the backend rejects both set. */
  relatedCattleId?: string;
  /** Multi-cow target (user request, no ticket #). Mutually exclusive with `relatedCattleId`. */
  cattleIds?: string[];
}

/** Mirrors `UpdateTaskDto` — reassign/reschedule/edit. Completion goes through `CompleteTaskPayload`. */
export interface UpdateTaskPayload {
  name?: string;
  details?: string;
  category?: TaskCategory;
  priority?: TaskPriority;
  status?: "PENDING" | "IN_PROGRESS" | "BLOCKED";
  scheduledAt?: string;
  dueAt?: string;
  assignedToId?: string;
  safetyCritical?: boolean;
}

/** Mirrors `CompleteTaskDto`. `completionPhotoUrl` has no matching upload endpoint on this
 * controller (unlike the aspirational API doc's `/tasks/upload-completion-photo`) — left unset by
 * the UI, see `task-details-sheet.tsx`. */
export interface CompleteTaskPayload {
  completionPhotoUrl?: string;
  notes?: string;
}

/** Mirrors `CancelTaskDto`. User-initiated abandonment — distinct from completing a task. */
export interface CancelTaskPayload {
  notes?: string;
}

/** `GET /settings/team` row (active members only here — pending invites have no `id` usable as an
 * assignee, see `team.service.ts#listTeam`). */
export interface TaskAssigneeOption {
  id: string;
  name: string;
  status: "active" | "pending" | "expired";
}
