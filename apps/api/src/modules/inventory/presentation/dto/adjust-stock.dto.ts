import { Transform } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { MedicineStockMovementReason } from '@prisma/client';
import { trimString } from 'src/common/dto';

/**
 * Manual stock adjustment for `POST /inventory/medicines/:id/adjust-stock`.
 *
 * `adjustment` is signed: positive adds stock (a top-up), negative removes it
 * (disposal/correction). The resulting balance may not go below zero (INV-02).
 * Every adjustment writes a MedicineStockMovement audit row.
 */
export class AdjustStockDto {
  /** Signed delta to apply to current stock (e.g. -5 to dispose 5 doses). */
  @IsNumber()
  adjustment!: number;

  @IsEnum(MedicineStockMovementReason)
  reason!: MedicineStockMovementReason;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  notes?: string;
}
