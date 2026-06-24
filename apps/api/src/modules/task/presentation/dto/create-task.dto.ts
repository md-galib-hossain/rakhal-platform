import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
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

  @IsOptional()
  @IsEnum(TaskCategory)
  category?: TaskCategory;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsISO8601()
  dueAt!: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  assignedToId?: string;

  /** Checklist sub-steps as plain strings; ids are assigned server-side. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  steps?: string[];

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

  @IsOptional()
  @Transform(trimString)
  @IsString()
  relatedCattleId?: string;
}
