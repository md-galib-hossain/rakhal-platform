import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';
import { CursorPaginationQueryDto } from 'src/common/pagination';

/**
 * RAKHAL-370 (MILESTONE 22). `type` filters on the raw `JournalTransaction.
 * sourceType` string (not a Prisma enum — see `domain/transaction-source.ts`),
 * so it stays a plain string, not `@IsIn` against a closed list that would
 * drift the moment a new source type is added elsewhere in the codebase.
 */
export class ListTransactionsQueryDto extends CursorPaginationQueryDto {
  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsString()
  financialAccountId?: string;

  @IsOptional()
  @IsIn(['POSTED', 'REVERSED'])
  status?: 'POSTED' | 'REVERSED';
}
