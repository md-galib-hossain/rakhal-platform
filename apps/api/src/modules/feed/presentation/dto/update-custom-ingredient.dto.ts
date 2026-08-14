import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { FeedNutrientGroup } from '@prisma/client';
import { trimString } from 'src/common/dto';

/** `PATCH /feed/ingredients/custom/:id` — partial update of a farm's own quick-added ingredient
 * (`CreateCustomIngredientDto`'s edit counterpart, same field set, everything optional). Rejects
 * (in the service) any row this farm doesn't own — the global catalogue and other farms' rows are
 * out of reach here. */
export class UpdateCustomIngredientDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsEnum(FeedNutrientGroup)
  nutrientGroup?: FeedNutrientGroup;

  @IsOptional()
  @IsNumber()
  @Min(0)
  pricePerKg?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  dmPct?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  cpPct?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  meMjPerKgDm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  fatPct?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  ndfPct?: number;

  /** % of CP, not % of DM. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  rdpPct?: number;

  /** % of CP, not % of DM. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  rupPct?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  starchPct?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  adfPct?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  calciumPct?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  phosphorusPct?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  tdnPct?: number;
}
