import { Transform, Type } from 'class-transformer';
import {
  IsISO8601,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { trimString } from 'src/common/dto';
import { PurchaseNewItemDto } from './purchase-new-item.dto';

/**
 * One line of `POST /purchasing/purchases` (RAKHAL-348). Exactly one of
 * `medicineId`/`feedItemId`/`equipmentId` is required — see
 * `validatePurchaseLineDetailShape` (`domain/purchase-line-shape.ts`) for the
 * exact rule `PurchaseService` enforces. Mirrors `CreateSaleLineDto`'s
 * `INVENTORY` case (`sales/presentation/dto/create-sale-line.dto.ts`).
 */
export class CreatePurchaseLineDto {
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

  /** Create the item with this purchase instead of pointing at an existing one — exactly one of
   * `medicineId`/`feedItemId`/`equipmentId`/`newItem`. The item is born with zero stock; the line adds
   * the real lot in the same transaction. */
  @IsOptional()
  @ValidateNested()
  @Type(() => PurchaseNewItemDto)
  newItem?: PurchaseNewItemDto;

  @IsNumber()
  @IsPositive()
  quantity!: number;

  @IsNumber()
  @Min(0)
  unitCost!: number;

  /** RAKHAL-436 (`docs/EPIC_MEDICINE_BATCH_MODEL.md`) — required when
   * `medicineId` is set: this purchase line becomes its own `MedicineBatch`
   * (a real lot, not a mutated existing one), so it needs its own expiry. */
  @ValidateIf(
    (o: CreatePurchaseLineDto) =>
      !!o.medicineId || o.newItem?.kind === 'MEDICINE',
  )
  @IsISO8601()
  expiryDate?: string;

  /** Optional lot/batch label for the new `MedicineBatch` (medicine lines only). */
  @IsOptional()
  @Transform(trimString)
  @IsString()
  batchCode?: string;
}
