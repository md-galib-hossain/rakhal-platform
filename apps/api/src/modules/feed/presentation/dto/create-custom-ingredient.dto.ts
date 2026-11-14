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

/** `POST /feed/ingredients/custom` — a farm's own ingredient. `name`/`pricePerKg` are the only
 * required fields (the original "quick-add" shape — no nutrition breakdown, `dmPct` defaults to
 * 100 and every other nutrient to 0, see `FeedIngredient`'s Prisma doc comment). `nutrientGroup`
 * is optional — it was a display-only Protein/Energy/Fiber tag that nothing in the app actually
 * renders (user request 2026-07-17: dropped from the "Add Custom Ingredient" form since a farm
 * has no way to know what to answer for it and it fed no calculation). Every nutrition field
 * below is optional on top of that: a farm with real lab values can supply a full profile (same
 * 12-nutrient set as the catalogue/override — rdp/rup are % of CP, everything else % of DM) and
 * it's used exactly like a catalogue ingredient everywhere downstream. */
export class CreateCustomIngredientDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsEnum(FeedNutrientGroup)
  nutrientGroup?: FeedNutrientGroup;

  @IsNumber()
  @Min(0)
  pricePerKg!: number;

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
