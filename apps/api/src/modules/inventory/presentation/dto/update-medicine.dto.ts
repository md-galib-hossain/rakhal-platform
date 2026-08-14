import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsISO8601,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { MedicineCategory, MedicineType } from '@prisma/client';
import { trimString } from 'src/common/dto';

/**
 * Partial update of a medicine's descriptive fields. **Stock is not editable
 * here** — use `POST /inventory/medicines/:id/adjust-stock` so every change is
 * audited (PRD business rule INV-02).
 */
export class UpdateMedicineDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsEnum(MedicineType)
  type?: MedicineType;

  @IsOptional()
  @IsEnum(MedicineCategory)
  category?: MedicineCategory;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  manufacturer?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  batchId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  unitId?: string;

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
  @IsISO8601()
  expiryDate?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  milkWithdrawalDays?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  meatWithdrawalDays?: number;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  notes?: string;
}
