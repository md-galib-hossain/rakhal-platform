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

/**
 * Nutrition profile as typed by the user (MILESTONE 26, RAKHAL-444). Every value is **% of dry
 * matter** except `rdpPct`/`rupPct` (% of CP) and `meMjPerKgDm` (MJ/kg DM). DM, CP and ME are required;
 * every other nutrient may be omitted or `null` = not measured (never zero). Cross-field rules (NDF >=
 * ADF, sums, ME band) are enforced by `validateNutrition` in the service so the errors read as a list.
 */
export class NutritionInputDto {
  @IsNumber()
  @Min(0)
  @Max(100)
  dmPct!: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  cpPct!: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  meMjPerKgDm!: number;

  @IsOptional()
  @IsNumber()
  fatPct?: number | null;

  @IsOptional()
  @IsNumber()
  ndfPct?: number | null;

  @IsOptional()
  @IsNumber()
  adfPct?: number | null;

  @IsOptional()
  @IsNumber()
  rdpPct?: number | null;

  @IsOptional()
  @IsNumber()
  rupPct?: number | null;

  @IsOptional()
  @IsNumber()
  starchPct?: number | null;

  @IsOptional()
  @IsNumber()
  sugarsPct?: number | null;

  @IsOptional()
  @IsNumber()
  calciumPct?: number | null;

  @IsOptional()
  @IsNumber()
  phosphorusPct?: number | null;

  @IsOptional()
  @IsNumber()
  tdnPct?: number | null;

  @IsOptional()
  @IsEnum(NutritionSource)
  nutritionSource?: NutritionSource;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  sourceRef?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  note?: string;
}
