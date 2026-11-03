import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
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
  TaskKind,
  TaskPriority,
  TaskRecurrence,
} from '@prisma/client';
import { toBoolean, trimString } from 'src/common/dto';

/** Create a task (source = MANUAL). Tenant comes from the token. */
export class CreateTaskDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  details?: string;

  /** Topic only. The deprecated value REMINDER is accepted as an alias for kind=REMINDER. */
  @IsOptional()
  @IsEnum(TaskCategory)
  category?: TaskCategory;

  /** RAKHAL-491: TASK (default) or REMINDER (needs dueAt, or sourceEventId + offsetDays). */
  @IsOptional()
  @IsEnum(TaskKind)
  kind?: TaskKind;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsOptional()
  @IsISO8601()
  scheduledAt?: string;

  /** Required, except a REMINDER linked to an event (`sourceEventId` + `offsetDays`). */
  @IsOptional()
  @IsISO8601()
  dueAt?: string;

  // ---- RAKHAL-487: custom reminders (kind REMINDER) -----------------------------------------

  /** Lead notice: also notify this many days before the due date (the day itself is always notified). */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(90)
  remindDaysBefore?: number;

  /** Roles notified when no assignee / named users are given. Empty = Owner + Manager. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  notifyRoleNames?: string[];

  /** Named farm members to notify (Q8). */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  recipientUserIds?: string[];

  /** Link to an animal event: the reminder is due that event's date + `offsetDays` and follows it. */
  @IsOptional()
  @Transform(trimString)
  @IsString()
  sourceEventId?: string;

  @IsOptional()
  @IsInt()
  @Min(-3650)
  @Max(3650)
  offsetDays?: number;

  /** With `recurrenceType: EVERY_N_DAYS`. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  recurrenceIntervalDays?: number;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  assignedToId?: string;

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

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  safetyCritical?: boolean;

  /** Single-cow target. Mutually exclusive with `cattleIds` — the service rejects both set. */
  @IsOptional()
  @Transform(trimString)
  @IsString()
  relatedCattleId?: string;

  /** Multi-cow target (user request, no ticket #) — a manual task can target several cows via the
   * new `TaskCattle` join. Mutually exclusive with `relatedCattleId`. */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsString({ each: true })
  cattleIds?: string[];
}
