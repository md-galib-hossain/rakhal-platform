import { Transform } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';
import { trimString } from 'src/common/dto';

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

  @IsNumber()
  @IsPositive()
  quantity!: number;

  @IsNumber()
  @Min(0)
  unitCost!: number;
}
