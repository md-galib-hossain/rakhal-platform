import { CreateCattleDto } from './create-cattle.dto';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import {
  CattleGender,
  CattlePurpose,
  CattleSourceType,
  CattleStatus,
  ProductionStatus,
} from '@prisma/client';
import { BCS_ALLOWED_SCORES } from '../../domain/cattle.constants';
import { trimString } from './common.dto';

export class UpdateCattleDto implements Partial<CreateCattleDto> {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  name?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  tagNumber?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  image?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  breedId?: string;

  @IsOptional()
  @IsEnum(CattleGender)
  gender?: CattleGender;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

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
  @IsNumber()
  @Min(0)
  @Max(2000)
  weightKg?: number;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  feedGroupId?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  shedId?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  motherId?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  fatherId?: string;

  @IsOptional()
  @IsEnum(CattleSourceType)
  sourceType?: CattleSourceType;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  color?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  notes?: string;

  /** RAKHAL-291 profile-edit counterpart: same field as `CreateCattleDto`/
   * `UpdateCattleStatusDto` — corrects/backfills real prior-calving history
   * (e.g. a purchased already-calved cow) so the derived `animalCategory`
   * (HEIFER→COW) reflects it. See `CattleService.update()`. */
  @IsOptional()
  @IsInt()
  @Min(1)
  priorCalvings?: number;

  /** RAKHAL-307: profile-edit counterpart to `CreateCattleDto.bcs` — writes a
   * new `BodyConditionScore` row + refreshes the denormalized `lastBcs`,
   * mirroring `create()`'s own BCS write instead of only updating the stored
   * snapshot value. */
  @IsOptional()
  @IsNumber()
  @IsIn(BCS_ALLOWED_SCORES)
  bcs?: number;

  /** RAKHAL-307: corrects/backfills the active lactation's start date after
   * the fact (e.g. a purchase-intake estimate later confirmed). 400 when the
   * cow has no ACTIVE `Lactation` — this is an edit, not an intake path; use
   * `productionStatus: MILKING` + this field together at create time, or
   * `POST /reproduction/cattle/:id/purchased-lactation` to start a new one. */
  @IsOptional()
  @IsDateString()
  lactationStartDate?: string;
}
