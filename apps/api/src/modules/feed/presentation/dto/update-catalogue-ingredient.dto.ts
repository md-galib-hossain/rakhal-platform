import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { FeedClass, FeedSubType, NutritionSource } from '@prisma/client';
import { trimString } from 'src/common/dto';

/** `PATCH /admin/feed-ingredients/:id` (RAKHAL-233 / PRD ADM-13/14, admin-only). Partial update of an
 * existing **global catalogue** row — every field optional. Rejects (in the service, not here) a
 * farm-owned row (custom quick-add or promoted-from-concentration ingredient); this endpoint only
 * touches `farmId: null` rows. A `currentPricePerKg` change bumps `priceUpdatedAt` (ADM-14 "a price
 * update refreshes farm formula costs" — the effective-price resolution already reads this row live
 * on every formula computation, so farms see the new price immediately, no separate refresh needed). */
export class UpdateCatalogueIngredientDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  nameEn?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  nameBn?: string;

  @IsOptional()
  @IsEnum(FeedClass)
  feedClass?: FeedClass;

  @IsOptional()
  @IsEnum(FeedSubType)
  feedSubType?: FeedSubType;

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

  @IsOptional()
  @IsNumber()
  @Min(0)
  currentPricePerKg?: number;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  nutritionSourceNote?: string;

  @IsOptional()
  @IsEnum(NutritionSource)
  nutritionSource?: NutritionSource;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  sourceRef?: string;

  @IsOptional()
  @IsBoolean()
  isAvailableBd?: boolean;
}
