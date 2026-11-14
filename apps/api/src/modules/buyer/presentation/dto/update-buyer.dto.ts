import { Transform } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { BuyerType } from '@prisma/client';
import { trimString } from 'src/common/dto';

/** Partial update of a milk buyer (PRD §11.1). */
export class UpdateBuyerDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  contactPerson?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  phone?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  email?: string;

  @IsOptional()
  @IsEnum(BuyerType)
  buyerType?: BuyerType;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(0)
  paymentTermsDays?: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0)
  basePricePerLitre?: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0)
  baseFatPct?: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0)
  fatBonusPer01Pct?: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(0)
  sccThreshold?: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0)
  sccPenaltyPer100k?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  collectionDays?: string[];

  @IsOptional()
  @Transform(trimString)
  @IsString()
  collectionTime?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  bankDetails?: string;
}
