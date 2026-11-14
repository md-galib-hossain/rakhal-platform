import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import {
  TaskCategory,
  TaskPriority,
  TaskRecurrence,
  TaskStatus,
} from '@prisma/client';
import { toBoolean, trimString } from 'src/common/dto';

/**
 * Update a task — edit details, reschedule (`dueAt`), reassign (`assignedToId`),
 * or move status to/from BLOCKED/IN_PROGRESS. Completion goes through
 * `POST /tasks/:id/complete`.
 */
export class UpdateTaskDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  details?: string;

  @IsOptional()
  @IsEnum(TaskCategory)
  category?: TaskCategory;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  /** Only PENDING / IN_PROGRESS / BLOCKED here — use the complete endpoint to finish. */
  @IsOptional()
  @IsEnum([TaskStatus.PENDING, TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED])
  status?: TaskStatus;

  @IsOptional()
  @IsISO8601()
  scheduledAt?: string;

  @IsOptional()
  @IsISO8601()
  dueAt?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  assignedToId?: string;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  safetyCritical?: boolean;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  recurring?: boolean;

  @IsOptional()
  @IsEnum(TaskRecurrence)
  recurrenceType?: TaskRecurrence;

  @IsOptional()
  @IsISO8601()
  recurrenceEndDate?: string;
}
