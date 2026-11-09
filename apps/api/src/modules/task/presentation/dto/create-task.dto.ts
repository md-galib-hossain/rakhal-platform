import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { TaskCategory, TaskPriority, TaskRecurrence } from '@prisma/client';
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

  /** Topic only. */
  @IsOptional()
  @IsEnum(TaskCategory)
  category?: TaskCategory;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsOptional()
  @IsISO8601()
  scheduledAt?: string;

  @IsISO8601()
  dueAt!: string;

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
