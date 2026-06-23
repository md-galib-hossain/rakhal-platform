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
import { ForageType } from '@prisma/client';
import { trimString } from 'src/common/dto';

/** Create a forage / feed inventory item. Tenant comes from the token. */
export class CreateForageDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEnum(ForageType)
  type!: ForageType;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  category?: string;

  /** Stock unit label, e.g. "bag", "kg", "sack". */
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  unit!: string;

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
