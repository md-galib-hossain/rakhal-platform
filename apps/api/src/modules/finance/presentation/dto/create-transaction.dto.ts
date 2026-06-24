import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import {
  FinanceCategory,
  FinancePaymentMethod,
  FinancePaymentType,
  FinanceTxnType,
} from '@prisma/client';
import { trimString } from 'src/common/dto';

/**
 * Record-transaction wizard (PRD §16.8). One DTO covers all four types; the
 * service validates the type-specific fields it needs.
 */
export class CreateTransactionDto {
  @IsEnum(FinanceTxnType)
  type!: FinanceTxnType;

  @IsEnum(FinanceCategory)
  category!: FinanceCategory;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  subType?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  entityName?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  notes?: string;

  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0)
  amount!: number;

  @IsOptional()
  @IsEnum(FinancePaymentType)
  paymentType?: FinancePaymentType;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0)
  paidNow?: number;

  @IsOptional()
  @IsEnum(FinancePaymentMethod)
  paymentMethod?: FinancePaymentMethod;

  @IsOptional()
  @IsDateString()
  paymentDate?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  // ---- type-specific (all optional) ----------------------------------------

  @IsOptional()
  @Transform(trimString)
  @IsString()
  buyerId?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  cattleId?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  inventoryItemName?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0)
  quantity?: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0)
  costPerUnit?: number;

  @IsOptional()
  @IsBoolean()
  updateInventory?: boolean;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0)
  litresSold?: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0)
  pricePerLitre?: number;

  // Debt / loan
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0)
  monthlyEmi?: number;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(0)
  durationMonths?: number;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  loanId?: string;
}
