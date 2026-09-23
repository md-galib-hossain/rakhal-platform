import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { FeedClass, FeedSubType } from '@prisma/client';
import { trimString } from 'src/common/dto';
import { NutritionInputDto } from './nutrition-input.dto';

/** Create a feed inventory item (purchased stock — forage, concentrate, mineral,
 * vitamin or additive; feed is the umbrella, `feedClass` is the scientific
 * class). Tenant comes from the token. `ingredientId` links this stock row to
 * its Feed Formulator nutrition/price catalogue counterpart — required so
 * stock decrement and price-sync can resolve a real FK instead of a name
 * match. */
export class CreateFeedItemDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEnum(FeedClass)
  feedClass!: FeedClass;

  @IsOptional()
  @IsEnum(FeedSubType)
  feedSubType?: FeedSubType;

  /** Optional since MILESTONE 26: provenance / copy-from / price-sync target, no longer the nutrition
   * source. Either this or `nutrition` must be supplied — with only this, nutrition is copied once
   * from the catalogue (+ the farm's override). */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  ingredientId?: string;

  /** This first lot's nutrition profile, typed by hand. Takes precedence over copying from `ingredientId`. */
  @IsOptional()
  @ValidateNested()
  @Type(() => NutritionInputDto)
  nutrition?: NutritionInputDto;

  /** Free-text lot code for the first batch (indexed, recall lookup). */
  @IsOptional()
  @Transform(trimString)
  @IsString()
  batchCode?: string;

  /** Unit catalog id (`Unit.id`, `GET /inventory/units`) — replaces the old free-text unit label. */
  @IsString()
  @IsNotEmpty()
  unitId!: string;

  /** Kg per unit, for bag → kg equivalent display. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  kgPerUnit?: number;

  @IsNumber()
  @Min(0)
  currentStock!: number;

  @IsNumber()
  @Min(0)
  costPerUnit!: number;

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

  @IsISO8601()
  purchaseDate!: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  notes?: string;
}
