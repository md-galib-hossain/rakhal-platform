import { Transform } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { FeedItemStockMovementReason } from '@prisma/client';
import { trimString } from 'src/common/dto';

/**
 * Manual stock adjustment for FeedItem — mirrors `AdjustStockDto` (Medicine).
 *
 * `adjustment` is signed: positive adds stock (a top-up), negative removes it
 * (distribution/correction). The resulting balance may not go below zero.
 * Every adjustment writes a FeedItemStockMovement audit row.
 */
export class AdjustFeedItemStockDto {
  /** Signed delta to apply to current stock (e.g. -5 to record 5 units consumed). */
  @IsNumber()
  adjustment!: number;

  @IsEnum(FeedItemStockMovementReason)
  reason!: FeedItemStockMovementReason;

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

  /** Pin the adjustment to one specific lot (RAKHAL-444; callers wire it in RAKHAL-445/446). When
   * absent, a negative adjustment draws FIFO across lots and a positive one credits the newest lot. */
  @IsOptional()
  @IsString()
  batchId?: string;
}
