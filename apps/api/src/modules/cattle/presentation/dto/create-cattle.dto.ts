import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsNotEmpty,
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
  ReproductionState,
} from '@prisma/client';
import { BCS_ALLOWED_SCORES } from '../../domain/cattle.constants';
import { trimString } from './common.dto';

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

  @IsOptional()
  @IsEnum(ReproductionState)
  reproductiveStatus?: ReproductionState;

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
