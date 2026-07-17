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
import { FeedConcentrationKind, FeedTargetType } from '@prisma/client';
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
  /** Explicit "Concentrate Mixer" vs "Feed Mixture" discriminator (user request 2026-07-18) — see
   * `FeedConcentration.kind`'s Prisma doc comment. The service nulls out every target field below
   * when this is `CONCENTRATE_TEMPLATE`, regardless of what the caller sends. */
  @IsEnum(FeedConcentrationKind)
  kind!: FeedConcentrationKind;

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

/** `POST /feed/concentrations/bulk-delete` — multi-select delete (user request 2026-07-18); soft-deletes
 * every id that belongs to the caller's farm and is still active, silently ignoring any id that
 * doesn't (another farm's row, already-archived, or unknown) rather than erroring the whole batch. */
export class BulkDeleteConcentrationDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  ids!: string[];
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
