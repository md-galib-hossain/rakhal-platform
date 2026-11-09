import { TaskCategory, TaskKind, TaskPriority, TaskRecurrence } from '@prisma/client';
export declare class CreateTaskDto {
    name: string;
    details?: string;
    category?: TaskCategory;
    kind?: TaskKind;
    priority?: TaskPriority;
    scheduledAt?: string;
    dueAt?: string;
    remindDaysBefore?: number;
    notifyRoleNames?: string[];
    recipientUserIds?: string[];
    sourceEventId?: string;
    offsetDays?: number;
    recurrenceIntervalDays?: number;
    assignedToId?: string;
    recurring?: boolean;
    recurrenceType?: TaskRecurrence;
    recurrenceEndDate?: string;
    safetyCritical?: boolean;
    relatedCattleId?: string;
    cattleIds?: string[];
}
