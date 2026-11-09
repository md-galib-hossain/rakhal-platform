import { TaskCategory, TaskPriority, TaskRecurrence, TaskStatus } from '@prisma/client';
export declare class UpdateTaskDto {
    name?: string;
    details?: string;
    category?: TaskCategory;
    priority?: TaskPriority;
    status?: TaskStatus;
    scheduledAt?: string;
    dueAt?: string;
    assignedToId?: string;
    safetyCritical?: boolean;
    remindDaysBefore?: number;
    notifyRoleNames?: string[];
    recipientUserIds?: string[];
    offsetDays?: number;
    recurring?: boolean;
    recurrenceType?: TaskRecurrence;
    recurrenceIntervalDays?: number;
    recurrenceEndDate?: string;
}
