import { Type, Transform } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { CalfBirthStatus, CalvingEase, CattleGender } from '@prisma/client';
import { toBoolean, trimString } from './common.dto';

export class CreateCalfBirthDto {
  @IsEnum(CattleGender)
  gender!: CattleGender;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  tagNumber?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  name?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0)
  birthWeight?: number;

  @IsEnum(CalfBirthStatus)
  status!: CalfBirthStatus;
}

export class CreateCalvingEventDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  cattleId!: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  pregnancyId?: string;

  @IsDateString()
  calvingDate!: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  calvingNumber?: number;

  @IsEnum(CalvingEase)
  calvingEase!: CalvingEase;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  calfCount?: number;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  placentaExpelled?: boolean;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  retainedPlacenta?: boolean;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  complications?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateCalfBirthDto)
  calves?: CreateCalfBirthDto[];
}
