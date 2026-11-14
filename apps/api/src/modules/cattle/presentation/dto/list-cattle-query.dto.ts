import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsIn, IsOptional, IsString } from 'class-validator';
import {
  CattleGender,
  HerdStatus,
  ProductionStatus,
  ReproductionState,
} from '@prisma/client';
import { CursorPaginationQueryDto } from 'src/common/pagination';
import {
  CATTLE_CATEGORIES,
  type CattleCategory,
} from 'src/modules/animal-events/domain/eligibility/categories';
import { toBoolean, trimString } from 'src/common/dto';
import {
  ANIMAL_CATEGORIES,
  type AnimalCategory,
} from '../../domain/animal-category';
import {
  DUE_FILTERS,
  type DueFilter,
} from '../../domain/animal-upcoming-events';
import {
  LIFECYCLE_SUB_STAGES,
  type LifecycleSubStage,
} from '../../domain/lifecycle-bands';

/** Derived health-status filter values (PRD §8.1; health is not stored). */
export const HEALTH_STATUS_FILTERS = [
  'HEALTHY',
  'SICK',
  'IN_TREATMENT',
  'WITHHOLDING',
  'QUARANTINE',
] as const;
export type HealthStatusFilter = (typeof HEALTH_STATUS_FILTERS)[number];

export class ListCattleQueryDto extends CursorPaginationQueryDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  search?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  breedId?: string;

  @IsOptional()
  @IsEnum(CattleGender)
  gender?: CattleGender;

  @IsOptional()
  @IsEnum(HerdStatus)
  status?: HerdStatus;

  @IsOptional()
  @IsEnum(ProductionStatus)
  productionStatus?: ProductionStatus;

  @IsOptional()
  @IsEnum(ReproductionState)
  reproductiveStatus?: ReproductionState;

  /** Derived read-model category filter (RAKHAL-289, PRD §8.1) — never
   * stored, computed in `CattleService.animalCategoryWhere()` mirroring
   * `deriveAnimalCategory()` exactly. Replaces the frontend's old fallback of
   * filtering `reproductiveStatus=NOT_ELIGIBLE`, which missed heifers with no
   * `ReproductionProfile` row at all (a null relation, not `NOT_ELIGIBLE`). */
  @IsOptional()
  @Transform(trimString)
  @IsIn(ANIMAL_CATEGORIES)
  animalCategory?: AnimalCategory;

  /** RAKHAL-480 (MILESTONE 31): the 13 event/bulk chips (all, male, female, cow,
   * heifer, weaned, calf, pregnant, milking, dry, fresh, open, fattening),
   * generated from the same table as event eligibility. Case-insensitive. */
  @IsOptional()
  @Transform(({ value }: { value: unknown }): unknown =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsIn(CATTLE_CATEGORIES)
  category?: CattleCategory;

  @IsOptional()
  @Transform(trimString)
  @IsIn(HEALTH_STATUS_FILTERS)
  healthStatus?: HealthStatusFilter;

  /** Derived read-model lifecycle sub-stage filter (RAKHAL-401) — never
   * stored, computed the same way `animalCategory` above is: mirrored exactly
   * by `CattleService`'s `buildLifecycleSubStageWhere()` call. */
  @IsOptional()
  @Transform(trimString)
  @IsIn(LIFECYCLE_SUB_STAGES)
  lifecycleSubStage?: LifecycleSubStage;

  /** RAKHAL-475: animals with an actionable upcoming event — overdue / due today / due within a week
   * (`DUE_FILTERS`). Mirrors `AnimalUpcomingEventsService.dueFilterWhere()`. */
  @IsOptional()
  @Transform(trimString)
  @IsIn(DUE_FILTERS)
  dueFilter?: DueFilter;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  shedId?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  animalGroupId?: string;

  /** RAKHAL-400: renamed from `includeArchived` — this flag only ever
   * controlled whether soft-deleted rows (`deletedAt`) were included; it had
   * nothing to do with `HerdStatus`/disposition, which `status` above already
   * filters independently. The old name conflated the two, and the old
   * behavior (when true, drop every other scope filter including the
   * default `herdStatus=ACTIVE`) let a soft-deleted row leak into a
   * status-filtered read. */
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  includeDeleted = false;
}
