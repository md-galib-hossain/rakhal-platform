import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { NutritionSource } from '@prisma/client';
import { trimString } from 'src/common/dto';

/** `PATCH /feed/stock/:id/nutrition` (RAKHAL-327). Lets a farm correct a produced batch's nutrient
 * snapshot once real data comes back (e.g. a lab report) — every field optional/partial, only
 * what's supplied is updated. Same 12-nutrient set as `FeedIngredient` (rdp/rup are % of CP,
 * everything else % of DM). `nutritionSource` defaults to `LAB` in the service if omitted here. */
export class UpdateStockNutritionDto {
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

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  rdpPct?: number;

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

  @IsOptional()
  @IsEnum(NutritionSource)
  nutritionSource?: NutritionSource;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  sourceRef?: string;
}
