import { TaskStatus } from '@prisma/client';

/** Derived display status: a non-completed task past its due date reads as "overdue" (PRD §17). */
export function displayStatus(
  status: TaskStatus,
  dueAt: Date,
  now: Date = new Date(),
):
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'blocked'
  | 'cancelled'
  | 'overdue' {
  if (status === TaskStatus.COMPLETED) return 'completed';
  if (status === TaskStatus.CANCELLED) return 'cancelled';
  if (status === TaskStatus.BLOCKED) return 'blocked';
  if (dueAt.getTime() < now.getTime()) return 'overdue';
  return status === TaskStatus.IN_PROGRESS ? 'in_progress' : 'pending';
}
