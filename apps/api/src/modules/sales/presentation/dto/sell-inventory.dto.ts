import { PaymentMethod } from '@prisma/client';
import {
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';
import type { SellInventoryItemType } from '../../application/use-cases/sell-inventory/sell-inventory.types';

/**
 * `POST /sales/inventory` (RAKHAL-376, MILESTONE 22, `BUSINESS_IA_PRD.md`
 * §16.8). HTTP-layer validation for `SellInventoryUseCase.execute`'s
 * existing `SellInventoryItemInput` shape (RAKHAL-346) — this ticket adds
 * no use-case logic, only the class-validator surface the controller
 * passes straight through.
 */
export class SellInventoryDto {
  @IsIn(['MEDICINE', 'FEED_ITEM', 'EQUIPMENT'])
  itemType!: SellInventoryItemType;

  @IsString()
  itemId!: string;

  @IsPositive()
  quantity!: number;

  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsDateString()
  saleDate!: string;

  @IsOptional()
  @IsString()
  financialAccountId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  amountReceived?: number;

  @IsOptional()
  @IsIn(Object.values(PaymentMethod))
  paymentMethod?: PaymentMethod;
}
