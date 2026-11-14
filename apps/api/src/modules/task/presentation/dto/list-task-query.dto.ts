import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
} from 'class-validator';
import { TaskCategory, TaskPriority, TaskStatus } from '@prisma/client';
import { CursorPaginationQueryDto } from 'src/common/pagination';
import { toBoolean, trimString } from 'src/common/dto';

/** View filter for `GET /tasks` (PRD §17.2). */
export type TaskListFilter =
  | 'my_tasks'
  | 'all'
  | 'overdue'
  | 'upcoming'
  | 'blocked';

export class ListTaskQueryDto extends CursorPaginationQueryDto {
  /**
   * View filter. `overdue` = open (not COMPLETED/CANCELLED) with `dueAt < now`; `upcoming` = open with
   * `dueAt >= now` (the exact complement of `overdue` for open items, same server `now` per request,
   * same boundary).
   */
  @IsOptional()
  @Transform(trimString)
  @IsIn(['my_tasks', 'all', 'overdue', 'upcoming', 'blocked'])
  filter?: TaskListFilter;

  /**
   * RAKHAL-491 fix: comma-separated TaskStatus list, e.g. `COMPLETED,CANCELLED`. Exact server-side
   * filter (an unknown value is a 400). Combines with `filter`, search and the cursor.
   *
   * Response note: `meta.highlights` is computed on the FIRST page
   * only (no `cursor`); later pages omit it, so clients keep the first-page values.
   */
  @IsOptional()
  @Transform(({ value }: { value: unknown }): unknown =>
    typeof value === 'string'
      ? value
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : value,
  )
  @IsArray()
  @ArrayMaxSize(7)
  @IsEnum(TaskStatus, { each: true })
  status?: TaskStatus[];

  /** RAKHAL-491 fix: `true` = repeating items only (`recurring` flag); `false` = one-off only. */
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  recurring?: boolean;

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
