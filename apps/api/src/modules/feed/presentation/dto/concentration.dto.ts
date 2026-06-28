import { Transform, Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { FeedTargetType } from '@prisma/client';
import { trimString } from 'src/common/dto';

/** One ingredient line in a concentration formula. */
export class ConcentrationItemDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  ingredientId!: string;

  @IsNumber()
  @Min(0)
  amountKg!: number;
}

/** `POST /feed/concentrations` — create a concentration template (RAKHAL-082, §12.4). */
export class CreateConcentrationDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  durationDays?: number;

  @IsOptional()
  @IsEnum(FeedTargetType)
  targetType?: FeedTargetType;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  feedGroupId?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  cattleId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  targetWeightKg?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  targetMilkL?: number;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ConcentrationItemDto)
  items!: ConcentrationItemDto[];
}

/** `PATCH /feed/concentrations/:id` — partial update; `items` replaces the lines if present. */
export class UpdateConcentrationDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  durationDays?: number;

  @IsOptional()
  @IsEnum(FeedTargetType)
  targetType?: FeedTargetType;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  feedGroupId?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  cattleId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  targetWeightKg?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  targetMilkL?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConcentrationItemDto)
  items?: ConcentrationItemDto[];
}

/** `POST /feed/concentrations/normalize` — scale a draft formula to meet requirements. */
export class NormalizeConcentrationDto {
  @IsNumber()
  @Min(1)
  weightKg!: number;

  @IsNumber()
  @Min(0)
  milkTargetL!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  milkFatPct?: number;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ConcentrationItemDto)
  items!: ConcentrationItemDto[];
}
