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

/**
 * Partial update of a forage item, including direct stock correction
 * (`currentStock`). Forage is lower-stakes than medicine, so it has no separate
 * movement-audit table — edits are logged via the application logger.
 */
export class UpdateForageDto {
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
  @IsEnum(ForageType)
  type?: ForageType;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  category?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  unit?: string;

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
