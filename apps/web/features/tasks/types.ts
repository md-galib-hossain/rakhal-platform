/** Mirrors the backend `TaskCategory` Prisma enum (`task.enums.prisma`). */
export type TaskCategory = "FEEDING" | "HEALTHCARE" | "BREEDING" | "MAINTENANCE" | "MILKING" | "CALF_CARE" | "GENERAL";

export type TaskPriority = "HIGH" | "MEDIUM" | "LOW";

/** Stored status. `displayStatus` below is the derived, presentation-ready value (PRD §17) — a
 * non-completed task past its due date always reads as "overdue" regardless of this field. */
export type TaskStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "BLOCKED";

export type TaskDisplayStatus = "pending" | "in_progress" | "completed" | "blocked" | "overdue";

export type TaskSource = "MANUAL" | "HEALTH_PLAN" | "SYSTEM_AUTO";

export type TaskRecurrence = "DAILY" | "WEEKLY" | "MONTHLY";

export type TaskListFilter = "my_tasks" | "all" | "overdue" | "blocked";

export interface TaskStep {
  id: string;
  text: string;
  completed: boolean;
}

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
  dueAt: string;
  overdueByHours: number | null;
  steps: TaskStep[];
  stepsTotal: number;
  stepsCompleted: number;
  recurring: boolean;
  recurrenceType: TaskRecurrence | null;
  recurrenceEndDate: string | null;
  safetyCritical: boolean;
  source: TaskSource;
  relatedCattleId: string | null;
  assignedToId: string | null;
  assignedTo: { id: string; name: string } | null;
  completionPhotoUrl: string | null;
  completedById: string | null;
  completedAt: string | null;
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

export interface TaskListFilters {
  filter?: TaskListFilter;
  category?: TaskCategory;
  priority?: TaskPriority;
  search?: string;
  /** Per-animal Task Hub view (unified animal-profile redesign, no ticket #) — filters on
   * `Task.relatedCattleId` server-side. */
  cattleId?: string;
}

/** Mirrors `CreateTaskDto`. */
export interface CreateTaskPayload {
  name: string;
  details?: string;
  category?: TaskCategory;
  priority?: TaskPriority;
  dueAt: string;
  assignedToId?: string;
  steps?: string[];
  recurring?: boolean;
  recurrenceType?: TaskRecurrence;
  recurrenceEndDate?: string;
  safetyCritical?: boolean;
  relatedCattleId?: string;
}

/** Mirrors `UpdateTaskDto` — reassign/reschedule/edit. Completion goes through `CompleteTaskPayload`. */
export interface UpdateTaskPayload {
  name?: string;
  details?: string;
  category?: TaskCategory;
  priority?: TaskPriority;
  status?: "PENDING" | "IN_PROGRESS" | "BLOCKED";
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

/** `GET /settings/team` row (active members only here — pending invites have no `id` usable as an
 * assignee, see `team.service.ts#listTeam`). */
export interface TaskAssigneeOption {
  id: string;
  name: string;
  status: "active" | "pending" | "expired";
}
