import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';
import { SaleLineType } from '@prisma/client';
import { trimString } from 'src/common/dto';

/**
 * One line of `POST /sales` (RAKHAL-339). `type` selects which of the
 * type-specific optional fields below is required — see
 * `validateSaleLineDetailShape` (`domain/sale-line-shape.ts`) for the exact rule
 * `SaleService` enforces.
 */
export class CreateSaleLineDto {
  @IsEnum(SaleLineType)
  type!: SaleLineType;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsNumber()
  @IsPositive()
  quantity!: number;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  unitId?: string;

  @IsNumber()
  @Min(0)
  unitPrice!: number;

  /** Required, and only meaningful, when `type === ANIMAL`. */
  @IsOptional()
  @Transform(trimString)
  @IsString()
  cattleId?: string;

  /** Exactly one of `medicineId`/`feedItemId`/`equipmentId` required when
   * `type === INVENTORY`. */
  @IsOptional()
  @Transform(trimString)
  @IsString()
  medicineId?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  feedItemId?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  equipmentId?: string;

  /** Optional free-text note, only meaningful when `type === MANURE` (RD-058 —
   * manure sale is revenue-first, no stock tracking). */
  @IsOptional()
  @Transform(trimString)
  @IsString()
  manureNotes?: string;
}
