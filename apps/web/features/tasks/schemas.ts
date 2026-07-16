import { z } from "zod";

/** "Create New Task" (Figma 1039:48550). Mirrors `CreateTaskDto`. `priority` defaults to `"HIGH"` to
 * reproduce the mock's pre-selected red-bordered "High" pill exactly (`create-task-sheet.tsx`
 * `toFormDefaults`) — the backend's own default if omitted is `MEDIUM`, but this form always submits
 * an explicit value so that default never applies. The mock has no interval selector for the
 * "Recurring Task" toggle even though `recurrenceType` is required for the backend to actually spawn
 * a next occurrence on complete (`TaskService#maybeCreateNextRecurrence` no-ops without it) — a small
 * "Repeats" select is shown only once the toggle is on, a minimal non-Figma addition so the toggle
 * isn't a dead control, not an invented field on the wire.
 */
export const createTaskSchema = z
  .object({
    name: z.string().trim().min(1, "Task name is required"),
    details: z.string().trim().optional(),
    category: z.enum(["FEEDING", "HEALTHCARE", "BREEDING", "MAINTENANCE", "MILKING", "CALF_CARE", "GENERAL"]).optional(),
    priority: z.enum(["HIGH", "MEDIUM", "LOW"]),
    dueAt: z.string().min(1, "Due date is required"),
    assignedToId: z.string().trim().optional(),
    recurring: z.boolean(),
    recurrenceType: z.enum(["DAILY", "WEEKLY", "MONTHLY"]).optional(),
    safetyCritical: z.boolean(),
  })
  .refine((values) => !values.recurring || Boolean(values.recurrenceType), {
    message: "Pick how often this task repeats",
    path: ["recurrenceType"],
  });
export type CreateTaskFormInput = z.infer<typeof createTaskSchema>;
