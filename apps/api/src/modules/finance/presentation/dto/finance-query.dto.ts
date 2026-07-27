import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import {
  FinanceCategory,
  FinanceTxnStatus,
  ReceivableStatus,
} from '@prisma/client';
import { CursorPaginationQueryDto } from 'src/common/pagination';
import { trimString } from 'src/common/dto';

/** Query for `GET /finance/ledger` — cursor-paginated. */
export class LedgerQueryDto extends CursorPaginationQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsEnum(FinanceCategory)
  category?: FinanceCategory;

  @IsOptional()
  @IsEnum(FinanceTxnStatus)
  status?: FinanceTxnStatus;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  search?: string;
}

/** Query for `GET /finance/transactions/export` — same filters as the ledger, no pagination. */
export class ExportTransactionsQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsEnum(FinanceCategory)
  category?: FinanceCategory;

  @IsOptional()
  @IsEnum(FinanceTxnStatus)
  status?: FinanceTxnStatus;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  search?: string;
}

/** Query for `GET /finance/receivables` and `/finance/payables`. */
export class ReceivableQueryDto extends CursorPaginationQueryDto {
  @IsOptional()
  @IsEnum(ReceivableStatus)
  status?: ReceivableStatus;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  search?: string;
}
