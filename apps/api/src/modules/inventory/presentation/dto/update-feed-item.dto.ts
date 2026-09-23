import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { FeedClass, FeedSubType } from '@prisma/client';
import { trimString } from 'src/common/dto';

/**
 * Partial update of a feed item, including direct stock correction
 * (`currentStock`). Lower-stakes than medicine, so it has no separate
 * movement-audit table — edits are logged via the application logger.
 */
export class UpdateFeedItemDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  currentStock?: number;

  @IsOptional()
  @IsEnum(FeedClass)
  feedClass?: FeedClass;

  @IsOptional()
  @IsEnum(FeedSubType)
  feedSubType?: FeedSubType;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  ingredientId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  unitId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  kgPerUnit?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  costPerUnit?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  lowStockThreshold?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  moisturePct?: number;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  supplier?: string;

  @IsOptional()
  @IsISO8601()
  purchaseDate?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  notes?: string;
}
