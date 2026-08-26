import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsIn, IsOptional, IsString } from 'class-validator';
import {
  CattleGender,
  CattlePurpose,
  HerdStatus,
  ProductionStatus,
  ReproductionState,
} from '@prisma/client';
import { CursorPaginationQueryDto } from 'src/common/pagination';
import { toBoolean, trimString } from 'src/common/dto';
import {
  ANIMAL_CATEGORIES,
  type AnimalCategory,
} from '../../domain/animal-category';

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
  @IsEnum(CattlePurpose)
  purpose?: CattlePurpose;

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

  @IsOptional()
  @Transform(trimString)
  @IsIn(HEALTH_STATUS_FILTERS)
  healthStatus?: HealthStatusFilter;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  shedId?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  feedGroupId?: string;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  includeArchived = false;
}
