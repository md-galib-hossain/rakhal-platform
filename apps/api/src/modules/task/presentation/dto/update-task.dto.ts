import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
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

  // ---- RAKHAL-487: reminders ------------------------------------------------------------------

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(90)
  remindDaysBefore?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  notifyRoleNames?: string[];

  /** Replaces the whole named-recipient list. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  recipientUserIds?: string[];

  /** Linked reminder only: re-derives the due date from the event date + this offset. */
  @IsOptional()
  @IsInt()
  @Min(-3650)
  @Max(3650)
  offsetDays?: number;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  recurring?: boolean;

  @IsOptional()
  @IsEnum(TaskRecurrence)
  recurrenceType?: TaskRecurrence;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  recurrenceIntervalDays?: number;

  @IsOptional()
  @IsISO8601()
  recurrenceEndDate?: string;
}
