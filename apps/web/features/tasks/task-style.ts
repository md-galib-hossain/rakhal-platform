import type { TaskCategory, TaskDisplayStatus, TaskPriority } from "./types";
import type { ChipProps } from "@rakhal/ui/ui/chip";

/** Priority → `Chip` color, matching Figma's tinted "Subtle" priority pill exactly (High=rose,
 * Medium=amber, Low=green — 1039:48550/48730). */
export const PRIORITY_CHIP_VARIANT: Record<TaskPriority, NonNullable<ChipProps["variant"]>> = {
  HIGH: "destructive",
  MEDIUM: "warning",
  LOW: "primary",
};

export const CATEGORY_ORDER: TaskCategory[] = [
  "FEEDING",
  "HEALTHCARE",
  "BREEDING",
  "MAINTENANCE",
  "MILKING",
  "CALF_CARE",
  "GENERAL",
];

export const DISPLAY_STATUS_CHIP_VARIANT: Record<TaskDisplayStatus, NonNullable<ChipProps["variant"]>> = {
  overdue: "destructive",
  blocked: "warning",
  in_progress: "info",
  pending: "muted",
  completed: "primary",
  cancelled: "muted",
};
