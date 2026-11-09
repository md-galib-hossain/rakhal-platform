import { TaskStatus } from '@prisma/client';
export declare function displayStatus(status: TaskStatus, dueAt: Date, now?: Date): 'pending' | 'in_progress' | 'completed' | 'blocked' | 'cancelled' | 'overdue';
