import { Transform } from 'class-transformer';
import { IsEnum, IsIn, IsNumber, IsOptional, IsString } from 'class-validator';
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

  /** `PURCHASE` is not accepted over HTTP: it would raise stock with no Finance posting. Stock bought
   * in goes through `POST /purchasing/purchases` (which calls the service in-process). */
  @IsEnum(MedicineStockMovementReason)
  @IsIn(
    Object.values(MedicineStockMovementReason).filter(
      (r) => r !== MedicineStockMovementReason.PURCHASE,
    ),
    {
      message:
        'reason PURCHASE is not allowed on a manual adjustment — record a purchase instead',
    },
  )
  reason!: MedicineStockMovementReason;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  notes?: string;

  /** Names the `SaleLine` that caused this adjustment — set only by
   * `SellInventoryUseCase` (RAKHAL-346) when `reason === SALE`. Not meant to
   * be supplied over HTTP by a human-facing adjustment; kept as a normal
   * optional/validated field (rather than omitted from the DTO) so the
   * `ValidationPipe`'s `whitelist` doesn't strip it when the use case calls
   * this service in-process with the field set. */
  @IsOptional()
  @IsString()
  saleLineId?: string;
}
