import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';
import { SaleLineType, SaleStatus } from '@prisma/client';
import { CursorPaginationQueryDto } from 'src/common/pagination';
import { trimString, toBoolean } from 'src/common/dto';
import { ReceivableStatus } from 'src/modules/finance-v2/receivables/domain/receivable-status';

/**
 * `GET /sales` v2 (RAKHAL-368, MILESTONE 22 — `BUSINESS_IA_PRD.md` §5.9,
 * §6.4). Cursor-paginated per house convention. `paymentStatus` reuses
 * `ReceivableStatus` (`UNPAID`/`PARTIALLY_PAID`/`PAID`/`OVERDUE`) rather than
 * inventing a parallel enum — it's the exact same four-state derivation
 * `ReceivableService.getStatus` already owns, just expressed as a SQL
 * `where` here instead of a per-row read (`SaleService.buildPaymentStatusWhere`).
 */
export class ListSalesQueryDto extends CursorPaginationQueryDto {
  /** Only sales on/after this date (ISO 8601). */
  @IsOptional()
  @IsDateString()
  from?: string;

  /** Only sales on/before this date (ISO 8601). */
  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsEnum(SaleStatus)
  status?: SaleStatus;

  /** Derived payment status — see this class's own doc comment. */
  @IsOptional()
  @IsEnum(ReceivableStatus)
  paymentStatus?: ReceivableStatus;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsEnum(SaleLineType)
  lineType?: SaleLineType;

  /** Free-text search over `saleNumber` and each line's `description`. */
  @IsOptional()
  @Transform(trimString)
  @IsString()
  q?: string;

  /** Include DRAFT sales — excluded by default (never posted, nothing to show a farmer). */
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  includeDrafts = false;
}
