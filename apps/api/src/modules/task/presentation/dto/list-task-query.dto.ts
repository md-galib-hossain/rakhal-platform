import { Transform } from 'class-transformer';
import { IsEnum, IsIn, IsISO8601, IsOptional, IsString } from 'class-validator';
import { TaskCategory, TaskPriority } from '@prisma/client';
import { CursorPaginationQueryDto } from 'src/common/pagination';
import { trimString } from 'src/common/dto';

/** View filter for `GET /tasks` (PRD §17.2). */
export type TaskListFilter = 'my_tasks' | 'all' | 'overdue' | 'blocked';

export class ListTaskQueryDto extends CursorPaginationQueryDto {
  @IsOptional()
  @Transform(trimString)
  @IsIn(['my_tasks', 'all', 'overdue', 'blocked'])
  filter?: TaskListFilter;

  @IsOptional()
  @IsEnum(TaskCategory)
  category?: TaskCategory;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  /** Match on task reference (TSK-XXX) or name. */
  @IsOptional()
  @Transform(trimString)
  @IsString()
  search?: string;

  /** Per-animal Task Hub view (unified animal-profile redesign, no ticket #) — filters on
   * `Task.relatedCattleId`, already stored/returned but previously never filterable back out. */
  @IsOptional()
  @Transform(trimString)
  @IsString()
  cattleId?: string;

  /** Date filter tabs (user request, no ticket #) — `dueAt` range, inclusive start / exclusive end
   * (matches the `dayStart`/`dayEnd` convention `highlights()` already uses for "due today"). */
  @IsOptional()
  @Transform(trimString)
  @IsISO8601()
  dueFrom?: string;

  @IsOptional()
  @Transform(trimString)
  @IsISO8601()
  dueTo?: string;
}
