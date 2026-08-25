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
import { CreateSaleLineDto } from './create-sale-line.dto';

/**
 * `POST /sales` (RAKHAL-339, `FINANCE_V2_DESIGN.md` §4.3, §5.1). Tenant (`farmId`)
 * comes from the access token via `FarmContextGuard` — never accepted in the body.
 *
 * `subtotal`/`totalAmount` are **not** accepted here — `SaleService` computes both
 * from `lines` (never trusts a client-supplied total), consistent with `discount
 * Amount` being the only money figure the caller actually chooses.
 */
export class CreateSaleDto {
  /** See `Sale`'s own schema doc comment for why this is a plain optional string,
   * not a validated FK — no generic Customer entity exists yet. */
  @IsOptional()
  @Transform(trimString)
  @IsString()
  customerId?: string;

  @IsDateString()
  saleDate!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateSaleLineDto)
  lines!: CreateSaleLineDto[];
}
