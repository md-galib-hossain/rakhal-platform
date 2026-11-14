import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { trimString } from 'src/common/dto';
import { CreatePurchaseLineDto } from './create-purchase-line.dto';

/**
 * `POST /purchasing/purchases` (RAKHAL-348, `FINANCE_V2_DESIGN.md` §5.1).
 * Tenant (`farmId`) comes from the access token via `FarmContextGuard` —
 * never accepted in the body.
 *
 * `totalAmount` is **not** accepted here — `PurchaseService` computes it
 * from `lines` (never trusts a client-supplied total), same convention as
 * `CreateSaleDto`.
 *
 * **Payment fields are DTO-only, not `Purchase` columns** — `paidAmount`
 * (default 0) is how much of the computed total is paid immediately from
 * `financialAccountId`; the remainder (if any) raises a `Payable`. This
 * mirrors the ticket's own worked AC example ("৳30,000 feed purchase,
 * ৳20,000 paid from Bank → Payable 10,000") without inventing a stored
 * "amount paid" column on `Purchase` itself — same reasoning `Sale` keeps no
 * payment-shape columns of its own, leaving that to `Receivable`/`Payment`.
 */
export class CreatePurchaseDto {
  /** RAKHAL-365: real `Supplier` FK, validated via `PurchaseService.
   * assertSupplierBelongsToFarm` before create. */
  @IsOptional()
  @Transform(trimString)
  @IsString()
  supplierId?: string;

  @IsDateString()
  purchaseDate!: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseLineDto)
  lines!: CreatePurchaseLineDto[];

  /** How much of the computed total is paid immediately. Omitted/0 means the
   * full total is raised as a `Payable`. Required together with
   * `financialAccountId` whenever it is greater than zero. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  paidAmount?: number;

  /** The `FinancialAccount` `paidAmount` is paid from. Required whenever
   * `paidAmount` is greater than zero. */
  @IsOptional()
  @Transform(trimString)
  @IsString()
  financialAccountId?: string;

  /** Optional due date for the `Payable` raised when the purchase isn't
   * fully paid at creation. */
  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
