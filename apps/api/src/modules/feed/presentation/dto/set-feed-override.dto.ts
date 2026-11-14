import { Transform } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { trimString } from 'src/common/dto';

/** Set a farm-level price/nutrition override for an ingredient (PRD §12.1, RAKHAL-080). */
export class SetFeedOverrideDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  customPricePerKg?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  customDmPct?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  customCpPct?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  customMeMjPerKgDm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  customFatPct?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  customNdfPct?: number;

  /** % of CP, not % of DM — see `FeedIngredient`'s Prisma doc comment. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  customRdpPct?: number;

  /** % of CP, not % of DM — see `FeedIngredient`'s Prisma doc comment. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  customRupPct?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  customStarchPct?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  customAdfPct?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  customCalciumPct?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  customPhosphorusPct?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  customTdnPct?: number;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  notes?: string;
}
