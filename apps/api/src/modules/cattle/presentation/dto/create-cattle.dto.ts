import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
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
import {
  IntakeHealthConditionDto,
  IntakeLactationDto,
  IntakePregnancyDto,
} from './intake.dto';

export class CreateCattleDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  name?: string;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  tagNumber!: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  image?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  breedId?: string;

  @IsEnum(CattleGender)
  gender!: CattleGender;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsEnum(CattlePurpose)
  purpose!: CattlePurpose;

  @IsOptional()
  @IsEnum(CattleStatus)
  status?: CattleStatus;

  @IsOptional()
  @IsEnum(ProductionStatus)
  productionStatus?: ProductionStatus;

  /** RAKHAL-307: "she is already pregnant" at intake — creates a synthetic
   * `PregnancyDiagnosis` (`method: PURCHASE_INTAKE`) + `Pregnancy` inline in
   * `create()`'s transaction, so the reproductive status is derived from a
   * real event row, not a raw enum the caller could set arbitrarily
   * (superseding the old `reproductiveStatus` field, removed). */
  @IsOptional()
  @ValidateNested()
  @Type(() => IntakePregnancyDto)
  intakePregnancy?: IntakePregnancyDto;

  /** RAKHAL-307: "she is already milking" at intake — reuses
   * `createPurchasedLactation`'s exact start-date precedence (DIM > estimated
   * calving date > now) to create an `isEstimated` `PURCHASED_LACTATING`
   * `Lactation`. Preferred over the older bare `lactationStartDate` field
   * below when both are supplied. */
  @IsOptional()
  @ValidateNested()
  @Type(() => IntakeLactationDto)
  intakeLactation?: IntakeLactationDto;

  /** RAKHAL-307: "she has a current health condition" at intake — creates an
   * open `HealthCase` inline so the derived health chip is correct from the
   * very first read, not just after a separate Report Sickness call. */
  @IsOptional()
  @ValidateNested()
  @Type(() => IntakeHealthConditionDto)
  intakeHealthCondition?: IntakeHealthConditionDto;

  /** RAKHAL-291: required when `productionStatus` is `MILKING` at intake and
   * no active `Lactation` exists yet (a fresh cattle row never has one) —
   * `CattleService.create()` uses it to create a `Lactation` row with
   * `startReason: PURCHASED_LACTATING` (renamed from `PURCHASE_IMPORT` by
   * RAKHAL-281), mirroring `updateStatus()`'s own rule. */
  @IsOptional()
  @IsDateString()
  lactationStartDate?: string;

  /** Lets intake record a cow's real prior calving history — e.g. a purchased
   * already-calved cow — instead of always defaulting to 0 via
   * `ReproductionProfile`'s Prisma schema default. Required (alongside
   * `lactationStartDate`) to register a cow straight into `MILKING`: a
   * heifer (0 calvings) can never be Milking. When supplied, `create()`
   * seeds `ReproductionProfile.totalCalvings` with this value. */
  @IsOptional()
  @IsInt()
  @Min(1)
  priorCalvings?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2000)
  weightKg?: number;

  @IsOptional()
  @IsNumber()
  @IsIn(BCS_ALLOWED_SCORES)
  bcs?: number;

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
}
