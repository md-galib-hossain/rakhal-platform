import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import {
  CattleGender,
  CattlePurpose,
  CattleSourceType,
  CattleStatus,
} from '@prisma/client';
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
