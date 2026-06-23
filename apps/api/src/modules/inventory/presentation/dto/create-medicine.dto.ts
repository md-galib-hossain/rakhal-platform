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
 * Create a medicine batch. Tenant (`farmId`) comes from the access token via
 * `FarmContextGuard` — it is never accepted in the body.
 */
export class CreateMedicineDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  imageUrl?: string;

  @IsEnum(MedicineType)
  type!: MedicineType;

  @IsEnum(MedicineCategory)
  category!: MedicineCategory;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  manufacturer?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  batchId?: string;

  /** Stock unit label, e.g. "doses", "ml", "g". */
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  unit!: string;

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

  @IsISO8601()
  purchaseDate!: string;

  @IsISO8601()
  expiryDate!: string;

  /** Days milk must be withheld after treatment — drives cattle withholding. */
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
