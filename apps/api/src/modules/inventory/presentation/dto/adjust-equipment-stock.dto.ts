import { Transform } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { EquipmentStockMovementReason } from '@prisma/client';
import { trimString } from 'src/common/dto';

/**
 * Manual stock adjustment for Equipment — mirrors `AdjustStockDto` (Medicine).
 *
 * `adjustment` is signed: positive adds stock (a top-up), negative removes it
 * (disposal/correction). The resulting balance may not go below zero.
 * Every adjustment writes an EquipmentStockMovement audit row.
 */
export class AdjustEquipmentStockDto {
  /** Signed delta to apply to current stock (e.g. -1 to dispose 1 unit). */
  @IsNumber()
  adjustment!: number;

  @IsEnum(EquipmentStockMovementReason)
  reason!: EquipmentStockMovementReason;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  notes?: string;

  /** Names the `SaleLine` that caused this adjustment — set only by
   * `SellInventoryUseCase` (RAKHAL-346) when `reason === SALE`. See
   * `AdjustStockDto.saleLineId` (Medicine) for why this stays a validated
   * DTO field rather than being omitted. */
  @IsOptional()
  @IsString()
  saleLineId?: string;
}
