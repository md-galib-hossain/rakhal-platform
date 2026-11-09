import { TaskCategory, TaskPriority, TaskStatus } from '@prisma/client';
import { CursorPaginationQueryDto } from 'src/common/pagination';
export type TaskListFilter = 'my_tasks' | 'all' | 'overdue' | 'upcoming' | 'blocked';
export declare class ListTaskQueryDto extends CursorPaginationQueryDto {
    filter?: TaskListFilter;
    kind?: 'task' | 'reminder';
    status?: TaskStatus[];
    recurring?: boolean;
    category?: TaskCategory;
    priority?: TaskPriority;
    search?: string;
    cattleId?: string;
    dueFrom?: string;
    dueTo?: string;
}
