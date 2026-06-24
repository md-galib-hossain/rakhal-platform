import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { EquipmentType } from '@prisma/client';
import { trimString } from 'src/common/dto';

/**
 * Partial update of an equipment item, including direct stock correction
 * (`currentStock`) — equipment has no separate movement-audit table.
 */
export class UpdateEquipmentDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  assetId?: string;

  @IsOptional()
  @IsEnum(EquipmentType)
  type?: EquipmentType;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  unit?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  currentStock?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  costPerUnit?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  lowStockThreshold?: number;

  @IsOptional()
  @IsISO8601()
  purchaseDate?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  notes?: string;
}
