import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsIn, IsOptional, IsString } from 'class-validator';
import {
  CattleGender,
  CattlePurpose,
  CattleStatus,
  ProductionStatus,
  ReproductiveStatus,
} from '@prisma/client';
import { CursorPaginationQueryDto } from 'src/common/pagination';
import { toBoolean, trimString } from 'src/common/dto';

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
  @IsEnum(CattleStatus)
  status?: CattleStatus;

  @IsOptional()
  @IsEnum(ProductionStatus)
  productionStatus?: ProductionStatus;

  @IsOptional()
  @IsEnum(ReproductiveStatus)
  reproductiveStatus?: ReproductiveStatus;

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
