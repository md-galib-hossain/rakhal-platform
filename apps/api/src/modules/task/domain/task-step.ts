import { randomUUID } from 'crypto';
import { TaskStatus } from '@prisma/client';

/** A checklist sub-step stored in `Task.steps` (JSON). */
export interface TaskStep {
  id: string;
  text: string;
  completed: boolean;
}

/** Build step objects (with ids) from raw text inputs at task-create time. */
export function buildSteps(texts?: string[]): TaskStep[] {
  return (texts ?? []).map((text) => ({
    id: randomUUID(),
    text,
    completed: false,
  }));
}

/** Read `Task.steps` JSON back into typed steps. */
export function parseSteps(value: unknown): TaskStep[] {
  if (!Array.isArray(value)) return [];
  return value as TaskStep[];
}

/** Derived display status: a non-completed task past its due date reads as "overdue" (PRD §17). */
export function displayStatus(
  status: TaskStatus,
  dueAt: Date,
  now: Date = new Date(),
): 'pending' | 'in_progress' | 'completed' | 'blocked' | 'overdue' {
  if (status === TaskStatus.COMPLETED) return 'completed';
  if (status === TaskStatus.BLOCKED) return 'blocked';
  if (dueAt.getTime() < now.getTime()) return 'overdue';
  return status === TaskStatus.IN_PROGRESS ? 'in_progress' : 'pending';
}
